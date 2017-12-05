<template>
    <div id="page" style="position: relative; padding: 10px;" v-if="settings">
        <div v-html="styling"></div>
        <div v-if="!characters" style="display:flex; align-items:center; justify-content:center; height: 100%;">
            <div class="well well-lg" style="width: 400px;">
                <h3 style="margin-top:0">{{l('title')}}</h3>
                <div class="alert alert-danger" v-show="error">
                    {{error}}
                </div>
                <div class="form-group">
                    <label class="control-label" for="account">{{l('login.account')}}</label>
                    <input class="form-control" id="account" v-model="settings.account" @keypress.enter="login"/>
                </div>
                <div class="form-group">
                    <label class="control-label" for="password">{{l('login.password')}}</label>
                    <input class="form-control" type="password" id="password" v-model="settings.password" @keypress.enter="login"/>
                </div>
                <div class="form-group" v-show="showAdvanced">
                    <label class="control-label" for="host">{{l('login.host')}}</label>
                    <input class="form-control" id="host" v-model="settings.host" @keypress.enter="login"/>
                </div>
                <div class="form-group">
                    <label class="control-label" for="theme">{{l('settings.theme')}}</label>
                    <select class="form-control" id="theme" v-model="settings.theme">
                        <option>default</option>
                        <option>dark</option>
                        <option>light</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="advanced"><input type="checkbox" id="advanced" v-model="showAdvanced"/> {{l('login.advanced')}}</label>
                </div>
                <div class="form-group">
                    <label for="save"><input type="checkbox" id="save" v-model="saveLogin"/> {{l('login.save')}}</label>
                </div>
                <div class="form-group">
                    <button class="btn btn-primary" @click="login" :disabled="loggingIn">
                        {{l(loggingIn ? 'login.working' : 'login.submit')}}
                    </button>
                </div>
            </div>
        </div>
        <chat v-else :ownCharacters="characters" :defaultCharacter="defaultCharacter" ref="chat"></chat>
        <modal action="Profile" :buttons="false" ref="profileViewer" dialogClass="profile-viewer">
            <character-page :authenticated="false" :hideGroups="true" :name="profileName"></character-page>
        </modal>
    </div>
</template>

<script lang="ts">
    import Axios from 'axios';
    import * as qs from 'qs';
    import * as Raven from 'raven-js';
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import Chat from '../chat/Chat.vue';
    import core, {init as initCore} from '../chat/core';
    import l from '../chat/localize';
    import {init as profileApiInit} from '../chat/profile_api';
    import Socket from '../chat/WebSocket';
    import Modal from '../components/Modal.vue';
    import Connection from '../fchat/connection';
    import CharacterPage from '../site/character_page/character_page.vue';
    import {GeneralSettings, getGeneralSettings, Logs, setGeneralSettings, SettingsStore} from './filesystem';
    import Notifications from './notifications';

    function confirmBack(): void {
        if(confirm(l('chat.confirmLeave'))) (<Navigator & {app: {exitApp(): void}}>navigator).app.exitApp();
    }

    profileApiInit();

    @Component({
        components: {chat: Chat, modal: Modal, characterPage: CharacterPage}
    })
    export default class Index extends Vue {
        //tslint:disable:no-null-keyword
        showAdvanced = false;
        saveLogin = false;
        loggingIn = false;
        characters: ReadonlyArray<string> | null = null;
        error = '';
        defaultCharacter: string | null = null;
        settingsStore = new SettingsStore();
        l = l;
        settings: GeneralSettings | null = null;
        importProgress = 0;
        profileName = '';

        async created(): Promise<void> {
            const oldOpen = window.open.bind(window);
            window.open = (url?: string, target?: string, features?: string, replace?: boolean) => {
                const profileMatch = url !== undefined ? url.match(/^https?:\/\/(www\.)?f-list.net\/c\/(.+)/) : null;
                if(profileMatch !== null) {
                    const profileViewer = <Modal>this.$refs['profileViewer'];
                    this.profileName = profileMatch[2];
                    profileViewer.show();
                    return null;
                } else return oldOpen(url, target, features, replace);
            };
            let settings = await getGeneralSettings();
            if(settings === undefined) settings = new GeneralSettings();
            if(settings.account.length > 0) this.saveLogin = true;
            this.settings = settings;
        }

        get styling(): string {
            //tslint:disable-next-line:no-require-imports
            return `<style>${require(`../less/themes/chat/${this.settings!.theme}.less`)}</style>`;
        }

        async login(): Promise<void> {
            if(this.loggingIn) return;
            this.loggingIn = true;
            try {
                const data = <{ticket?: string, error: string, characters: string[], default_character: string}>
                    (await Axios.post('https://www.f-list.net/json/getApiTicket.php', qs.stringify(
                        {account: this.settings!.account, password: this.settings!.password, no_friends: true, no_bookmarks: true})
                    )).data;
                if(data.error !== '') {
                    this.error = data.error;
                    return;
                }
                if(this.saveLogin)
                    await setGeneralSettings(this.settings!);
                Socket.host = this.settings!.host;
                const connection = new Connection(Socket, this.settings!.account, this.settings!.password);
                connection.onEvent('connected', () => {
                    Raven.setUserContext({username: core.connection.character});
                    document.addEventListener('backbutton', confirmBack);
                });
                connection.onEvent('closed', () => {
                    Raven.setUserContext();
                    document.removeEventListener('backbutton', confirmBack);
                });
                initCore(connection, Logs, SettingsStore, Notifications);
                this.characters = data.characters.sort();
                this.defaultCharacter = data.default_character;
            } catch(e) {
                this.error = l('login.error');
                if(process.env.NODE_ENV !== 'production') throw e;
            } finally {
                this.loggingIn = false;
            }
        }
    }
</script>

<style>
    html, body, #page {
        height: 100%;
    }
</style>