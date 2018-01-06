<template>
    <div @mouseover="onMouseOver" id="page" style="position:relative;padding:5px 10px 10px">
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
                    <input class="form-control" type="password" id="password" v-model="password" @keypress.enter="login"/>
                </div>
                <div class="form-group" v-show="showAdvanced">
                    <label class="control-label" for="host">{{l('login.host')}}</label>
                    <input class="form-control" id="host" v-model="settings.host" @keypress.enter="login"/>
                </div>
                <div class="form-group">
                    <label for="advanced"><input type="checkbox" id="advanced" v-model="showAdvanced"/> {{l('login.advanced')}}</label>
                </div>
                <div class="form-group">
                    <label for="save"><input type="checkbox" id="save" v-model="saveLogin"/> {{l('login.save')}}</label>
                </div>
                <div class="form-group text-right" style="margin:0">
                    <button class="btn btn-primary" @click="login" :disabled="loggingIn">
                        {{l(loggingIn ? 'login.working' : 'login.submit')}}
                    </button>
                </div>
            </div>
        </div>
        <chat v-else :ownCharacters="characters" :defaultCharacter="defaultCharacter" ref="chat"></chat>
        <div ref="linkPreview" class="link-preview"></div>
        <modal :action="l('importer.importing')" ref="importModal" :buttons="false">
            {{l('importer.importingNote')}}
            <div class="progress" style="margin-top:5px">
                <div class="progress-bar" :style="{width: importProgress * 100 + '%'}"></div>
            </div>
        </modal>
        <modal :buttons="false" ref="profileViewer" dialogClass="profile-viewer">
            <character-page :authenticated="true" :oldApi="true" :name="profileName" :image-preview="true"></character-page>
            <template slot="title">{{profileName}} <a class="btn fa fa-external-link" @click="openProfileInBrowser"></a></template>
        </modal>
    </div>
</template>

<script lang="ts">
    import Axios from 'axios';
    import * as electron from 'electron';
    import * as fs from 'fs';
    import * as path from 'path';
    import * as qs from 'querystring';
    import * as Raven from 'raven-js';
    import {promisify} from 'util';
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import Chat from '../chat/Chat.vue';
    import {Settings} from '../chat/common';
    import core, {init as initCore} from '../chat/core';
    import l from '../chat/localize';
    import {init as profileApiInit} from '../chat/profile_api';
    import Socket from '../chat/WebSocket';
    import Modal from '../components/Modal.vue';
    import Connection from '../fchat/connection';
    import CharacterPage from '../site/character_page/character_page.vue';
    import {GeneralSettings, nativeRequire} from './common';
    import {Logs, SettingsStore} from './filesystem';
    import * as SlimcatImporter from './importer';
    import Notifications from './notifications';

    declare module '../chat/interfaces' {
        interface State {
            generalSettings?: GeneralSettings
        }
    }

    const webContents = electron.remote.getCurrentWebContents();
    const parent = electron.remote.getCurrentWindow().webContents;

    /*tslint:disable:no-any*///because this is hacky
    const keyStore = nativeRequire<{
        getPassword(account: string): Promise<string>
        setPassword(account: string, password: string): Promise<void>
        deletePassword(account: string): Promise<void>
        [key: string]: (...args: any[]) => Promise<any>
    }>('keytar/build/Release/keytar.node');
    for(const key in keyStore) keyStore[key] = promisify(<(...args: any[]) => any>keyStore[key].bind(keyStore, 'fchat'));
    //tslint:enable

    @Component({
        components: {chat: Chat, modal: Modal, characterPage: CharacterPage}
    })
    export default class Index extends Vue {
        //tslint:disable:no-null-keyword
        showAdvanced = false;
        saveLogin = false;
        loggingIn = false;
        password = '';
        character: string | undefined;
        characters: string[] | null = null;
        error = '';
        defaultCharacter: string | null = null;
        l = l;
        settings: GeneralSettings;
        importProgress = 0;
        profileName = '';

        async created(): Promise<void> {
            if(this.settings.account.length > 0) this.saveLogin = true;
            keyStore.getPassword(this.settings.account)
                .then((value: string) => this.password = value, (err: Error) => this.error = err.message);

            Vue.set(core.state, 'generalSettings', this.settings);

            electron.ipcRenderer.on('settings', (_: Event, settings: GeneralSettings) => core.state.generalSettings = this.settings = settings);
            electron.ipcRenderer.on('open-profile', (_: Event, name: string) => {
                const profileViewer = <Modal>this.$refs['profileViewer'];
                this.profileName = name;
                profileViewer.show();
            });

            window.addEventListener('beforeunload', () => {
                if(this.character !== undefined) electron.ipcRenderer.send('disconnect', this.character);
            });
        }

        async login(): Promise<void> {
            if(this.loggingIn) return;
            this.loggingIn = true;
            try {
                if(!this.saveLogin) await keyStore.deletePassword(this.settings.account);
                const data = <{ticket?: string, error: string, characters: {[key: string]: number}, default_character: number}>
                    (await Axios.post('https://www.f-list.net/json/getApiTicket.php', qs.stringify({
                        account: this.settings.account, password: this.password, no_friends: true, no_bookmarks: true,
                        new_character_list: true
                    }))).data;
                if(data.error !== '') {
                    this.error = data.error;
                    return;
                }
                if(this.saveLogin) electron.ipcRenderer.send('save-login', this.settings.account, this.settings.host);
                Socket.host = this.settings.host;
                const connection = new Connection(`F-Chat 3.0 (${process.platform})`, electron.remote.app.getVersion(), Socket,
                    this.settings.account, this.password);
                connection.onEvent('connecting', async() => {
                    if(!electron.ipcRenderer.sendSync('connect', core.connection.character) && process.env.NODE_ENV === 'production') {
                        alert(l('login.alreadyLoggedIn'));
                        return core.connection.close();
                    }
                    this.character = core.connection.character;
                    if((await core.settingsStore.get('settings')) === undefined &&
                        SlimcatImporter.canImportCharacter(core.connection.character)) {
                        if(!confirm(l('importer.importGeneral'))) return core.settingsStore.set('settings', new Settings());
                        (<Modal>this.$refs['importModal']).show(true);
                        await SlimcatImporter.importCharacter(core.connection.character, (progress) => this.importProgress = progress);
                        (<Modal>this.$refs['importModal']).hide();
                    }
                });
                connection.onEvent('connected', () => {
                    core.watch(() => core.conversations.hasNew, (newValue) => parent.send('has-new', webContents.id, newValue));
                    parent.send('connect', webContents.id, core.connection.character);
                    Raven.setUserContext({username: core.connection.character});
                });
                connection.onEvent('closed', () => {
                    this.character = undefined;
                    electron.ipcRenderer.send('disconnect', connection.character);
                    parent.send('disconnect', webContents.id);
                    Raven.setUserContext();
                });
                initCore(connection, Logs, SettingsStore, Notifications);
                const charNames = Object.keys(data.characters);
                this.characters = charNames.sort();
                this.defaultCharacter = charNames.find((x) => data.characters[x] === data.default_character)!;
                profileApiInit(data.characters);
            } catch(e) {
                this.error = l('login.error');
                if(process.env.NODE_ENV !== 'production') throw e;
            } finally {
                this.loggingIn = false;
            }
        }

        onMouseOver(e: MouseEvent): void {
            const preview = (<HTMLDivElement>this.$refs.linkPreview);
            if((<HTMLElement>e.target).tagName === 'A') {
                const target = <HTMLAnchorElement>e.target;
                if(target.hostname !== '') {
                    //tslint:disable-next-line:prefer-template
                    preview.className = 'link-preview ' +
                        (e.clientX < window.innerWidth / 2 && e.clientY > window.innerHeight - 150 ? ' right' : '');
                    preview.textContent = target.href;
                    preview.style.display = 'block';
                    return;
                }
            }
            preview.textContent = '';
            preview.style.display = 'none';
        }

        openProfileInBrowser(): void {
            electron.remote.shell.openExternal(`https://www.f-list.net/c/${this.profileName}`);
        }

        get styling(): string {
            try {
                return `<style>${fs.readFileSync(path.join(__dirname, `themes/${this.settings.theme}.css`))}</style>`;
            } catch(e) {
                if((<Error & {code: string}>e).code === 'ENOENT' && this.settings.theme !== 'default') {
                    this.settings.theme = 'default';
                    return this.styling;
                }
                throw e;
            }
        }
    }
</script>

<style>
    html, body, #page {
        height: 100%;
    }
</style>