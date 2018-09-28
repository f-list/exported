<template>
    <div id="page" style="position: relative; padding: 10px;" v-if="settings">
        <div v-html="styling"></div>
        <div v-if="!characters" style="display:flex; align-items:center; justify-content:center; min-height: 100%;">
            <div class="card bg-light" style="width: 400px;">
                <h3 class="card-header" style="margin-top:0">{{l('title')}}</h3>
                <div class="card-body">
                    <div class="alert alert-danger" v-show="error">
                        {{error}}
                    </div>
                    <div class="form-group">
                        <label class="control-label" for="account">{{l('login.account')}}</label>
                        <input class="form-control" id="account" v-model="settings.account" @keypress.enter="login" :disabled="loggingIn"/>
                    </div>
                    <div class="form-group">
                        <label class="control-label" for="password">{{l('login.password')}}</label>
                        <input class="form-control" type="password" id="password" v-model="settings.password" @keypress.enter="login" :disabled="loggingIn"/>
                    </div>
                    <div class="form-group" v-show="showAdvanced">
                        <label class="control-label" for="host">{{l('login.host')}}</label>
                        <div class="input-group">
                            <input class="form-control" id="host" v-model="settings.host" @keypress.enter="login" :disabled="loggingIn"/>
                            <div class="input-group-append">
                                <button class="btn btn-outline-secondary" @click="resetHost"><span class="fas fa-undo-alt"></span></button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="control-label" for="theme">{{l('settings.theme')}}</label>
                        <select class="form-control custom-select" id="theme" v-model="settings.theme">
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
                    <div class="form-group" style="text-align:right">
                        <button class="btn btn-primary" @click="login" :disabled="loggingIn">
                            {{l(loggingIn ? 'login.working' : 'login.submit')}}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <chat v-else :ownCharacters="characters" :defaultCharacter="defaultCharacter" ref="chat"></chat>
        <modal :buttons="false" ref="profileViewer" dialogClass="profile-viewer">
            <character-page :authenticated="true" :oldApi="true" :name="profileName"></character-page>
            <template slot="title">{{profileName}} <a class="btn" @click="openProfileInBrowser"><i class="fa fa-external-link-alt"></i></a>
            </template>
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
    import {appVersion, GeneralSettings, getGeneralSettings, Logs, setGeneralSettings, SettingsStore} from './filesystem';
    import Notifications from './notifications';

    declare global {
        interface Window {
            NativeView: {
                setTheme(theme: string): void
            } | undefined;
        }

        const NativeBackground: {
            start(): void
            stop(): void
        };
    }

    function confirmBack(e: Event): void {
        if(!confirm(l('chat.confirmLeave'))) e.preventDefault();
    }

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
        profileName = '';

        async created(): Promise<void> {
            document.addEventListener('open-profile', (e: Event) => {
                const profileViewer = <Modal>this.$refs['profileViewer'];
                this.profileName = (<Event & {detail: string}>e).detail;
                profileViewer.show();
            });
            let settings = await getGeneralSettings();
            if(settings === undefined) settings = new GeneralSettings();
            if(settings.version !== appVersion) {
                settings.version = appVersion;
                await setGeneralSettings(settings);
            }
            if(settings.account.length > 0) this.saveLogin = true;
            this.settings = settings;
        }

        resetHost(): void {
            this.settings!.host = new GeneralSettings().host;
        }

        get styling(): string {
            if(window.NativeView !== undefined) window.NativeView.setTheme(this.settings!.theme);
            //tslint:disable-next-line:no-require-imports
            return `<style>${require('../scss/fa.scss')}${require(`../scss/themes/chat/${this.settings!.theme}.scss`)}</style>`;
        }

        async login(): Promise<void> {
            if(this.loggingIn) return;
            this.loggingIn = true;
            try {
                const data = <{ticket?: string, error: string, characters: {[key: string]: number}, default_character: number}>
                    (await Axios.post('https://www.f-list.net/json/getApiTicket.php', qs.stringify({
                        account: this.settings!.account, password: this.settings!.password, no_friends: true, no_bookmarks: true,
                        new_character_list: true
                    }))).data;
                if(data.error !== '') {
                    this.error = data.error;
                    return;
                }
                if(this.saveLogin) await setGeneralSettings(this.settings!);
                Socket.host = this.settings!.host;
                const connection = new Connection('F-Chat 3.0 (Mobile)', appVersion, Socket,
                    this.settings!.account, this.settings!.password);
                connection.onEvent('connected', () => {
                    Raven.setUserContext({username: core.connection.character});
                    document.addEventListener('backbutton', confirmBack);
                    NativeBackground.start();
                });
                connection.onEvent('closed', () => {
                    Raven.setUserContext();
                    document.removeEventListener('backbutton', confirmBack);
                    NativeBackground.stop();
                });
                initCore(connection, Logs, SettingsStore, Notifications);
                const charNames = Object.keys(data.characters);
                this.characters = charNames.sort();
                for(const character of charNames)
                    if(data.characters[character] === data.default_character) {
                        this.defaultCharacter = character;
                        break;
                    }
                profileApiInit(data.characters);
            } catch(e) {
                this.error = l('login.error');
                if(process.env.NODE_ENV !== 'production') throw e;
            } finally {
                this.loggingIn = false;
            }
        }

        openProfileInBrowser(): void {
            window.open(`profile://${this.profileName}`);
        }
    }
</script>

<style>
    html, body, #page {
        height: 100%;
    }

    html, .modal {
       padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
</style>
