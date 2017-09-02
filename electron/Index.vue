<template>
    <div @mouseover="onMouseOver" id="page" style="position: relative; padding: 10px;">
        <div v-html="styling"></div>
        <div v-if="!characters" style="display:flex; align-items:center; justify-content:center; height: 100%;">
            <div class="well well-lg" style="width: 400px;">
                <h3 style="margin-top:0">{{l('title')}}</h3>
                <div class="alert alert-danger" v-show="error">
                    {{error}}
                </div>
                <div class="form-group">
                    <label class="control-label" for="account">{{l('login.account')}}</label>
                    <input class="form-control" id="account" v-model="account" @keypress.enter="login"/>
                </div>
                <div class="form-group">
                    <label class="control-label" for="password">{{l('login.password')}}</label>
                    <input class="form-control" type="password" id="password" v-model="password" @keypress.enter="login"/>
                </div>
                <div class="form-group" v-show="showAdvanced">
                    <label class="control-label" for="host">{{l('login.host')}}</label>
                    <input class="form-control" id="host" v-model="host" @keypress.enter="login"/>
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
        <div ref="linkPreview" class="link-preview"></div>
        <modal :action="l('importer.importing')" ref="importModal" :buttons="false">
            {{l('importer.importingNote')}}
            <div class="progress" style="margin-top:5px">
                <div class="progress-bar" :style="{width: importProgress * 100 + '%'}"></div>
            </div>
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
    import Socket from '../chat/WebSocket';
    import Modal from '../components/Modal.vue';
    import Connection from '../fchat/connection';
    import {nativeRequire} from './common';
    import {GeneralSettings, getGeneralSettings, Logs, setGeneralSettings, SettingsStore} from './filesystem';
    import * as SlimcatImporter from './importer';
    import {createAppMenu, createContextMenu} from './menu';
    import Notifications from './notifications';
    import * as spellchecker from './spellchecker';

    const webContents = electron.remote.getCurrentWebContents();
    webContents.on('context-menu', (_, props: Electron.ContextMenuParams & {editFlags: {[key: string]: boolean}}) => {
        const menuTemplate = createContextMenu(props);
        if(props.misspelledWord !== '') {
            const corrections = spellchecker.getCorrections(props.misspelledWord);
            if(corrections.length > 0) {
                menuTemplate.unshift({type: 'separator'});
                menuTemplate.unshift(...corrections.map((correction: string) => ({
                    label: correction,
                    click: () => webContents.replaceMisspelling(correction)
                })));
            }
        }

        if(menuTemplate.length > 0) electron.remote.Menu.buildFromTemplate(menuTemplate).popup();
    });

    const defaultTrayMenu = [
        {label: l('action.open'), click: () => mainWindow!.show()},
        {
            label: l('action.quit'),
            click: () => {
                isClosing = true;
                mainWindow!.close();
                mainWindow = undefined;
            }
        }
    ];
    let trayMenu = electron.remote.Menu.buildFromTemplate(defaultTrayMenu);

    let isClosing = false;
    let mainWindow: Electron.BrowserWindow | undefined = electron.remote.getCurrentWindow(); //TODO
    //tslint:disable-next-line:no-require-imports
    const tray = new electron.remote.Tray(path.join(__dirname, <string>require('./build/icon.png')));
    tray.setToolTip(l('title'));
    tray.on('click', (_) => mainWindow!.show());
    tray.setContextMenu(trayMenu);

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
        components: {chat: Chat, modal: Modal}
    })
    export default class Index extends Vue {
        //tslint:disable:no-null-keyword
        showAdvanced = false;
        saveLogin = false;
        loggingIn = false;
        account: string;
        password = '';
        host: string;
        characters: string[] | null = null;
        error = '';
        defaultCharacter: string | null = null;
        settings = new SettingsStore();
        l = l;
        currentSettings: GeneralSettings;
        isConnected = false;
        importProgress = 0;

        constructor(options?: Vue.ComponentOptions<Index>) {
            super(options);
            let settings = getGeneralSettings();
            if(settings === undefined) {
                if(SlimcatImporter.canImportGeneral() && confirm(l('importer.importGeneral')))
                    settings = SlimcatImporter.importGeneral();
                settings = settings !== undefined ? settings : new GeneralSettings();
            }
            this.account = settings.account;
            this.host = settings.host;
            this.currentSettings = settings;
        }

        created(): void {
            if(this.currentSettings.account.length > 0) {
                keyStore.getPassword(this.currentSettings.account)
                    .then((value: string) => this.password = value, (err: Error) => this.error = err.message);
                this.saveLogin = true;
            }
            window.onbeforeunload = () => {
                if(process.env.NODE_ENV !== 'production' || isClosing || !this.isConnected) {
                    tray.destroy();
                    return;
                }
                if(!this.currentSettings.closeToTray)
                    return setImmediate(() => {
                        if(confirm(l('chat.confirmLeave'))) {
                            isClosing = true;
                            mainWindow!.close();
                        }
                    });
                mainWindow!.hide();
                return false;
            };

            const appMenu = createAppMenu();
            const themes = fs.readdirSync(path.join(__dirname, 'themes')).filter((x) => x.substr(-4) === '.css').map((x) => x.slice(0, -4));
            const setTheme = (theme: string) => {
                this.currentSettings.theme = theme;
                setGeneralSettings(this.currentSettings);
            };
            const spellcheckerMenu = new electron.remote.Menu();
            //tslint:disable-next-line:no-floating-promises
            this.addSpellcheckerItems(spellcheckerMenu);
            appMenu[0].submenu = [
                {
                    label: l('settings.closeToTray'), type: 'checkbox', checked: this.currentSettings.closeToTray,
                    click: (item: Electron.MenuItem) => {
                        this.currentSettings.closeToTray = item.checked;
                        setGeneralSettings(this.currentSettings);
                    }
                },
                {label: l('settings.spellcheck'), submenu: spellcheckerMenu},
                {
                    label: l('settings.theme'),
                    submenu: themes.map((x) => ({
                        checked: this.currentSettings.theme === x,
                        click: () => setTheme(x),
                        label: x,
                        type: <'radio'>'radio'
                    }))
                },
                {type: 'separator'},
                {role: 'minimize'},
                {
                    label: l('action.quit'),
                    click(): void {
                        isClosing = true;
                        mainWindow!.close();
                    }
                }
            ];
            electron.remote.Menu.setApplicationMenu(electron.remote.Menu.buildFromTemplate(appMenu));

            let hasUpdate = false;
            electron.ipcRenderer.on('updater-status', (_: Event, status: string) => {
                if(status !== 'update-downloaded' || hasUpdate) return;
                hasUpdate = true;
                const menu = electron.remote.Menu.getApplicationMenu();
                menu.append(new electron.remote.MenuItem({
                    label: l('action.updateAvailable'),
                    submenu: electron.remote.Menu.buildFromTemplate([{
                        label: l('action.update'),
                        click: () => {
                            if(!this.isConnected || confirm(l('chat.confirmLeave'))) {
                                isClosing = true;
                                electron.ipcRenderer.send('install-update');
                            }
                        }
                    }])
                }));
                electron.remote.Menu.setApplicationMenu(menu);
            });
        }

        async addSpellcheckerItems(menu: Electron.Menu): Promise<void> {
            const dictionaries = await spellchecker.getAvailableDictionaries();
            const selected = this.currentSettings.spellcheckLang;
            menu.append(new electron.remote.MenuItem({
                type: 'radio',
                label: l('settings.spellcheck.disabled'),
                click: this.setSpellcheck.bind(this, undefined)
            }));
            for(const lang of dictionaries)
                menu.append(new electron.remote.MenuItem({
                    type: 'radio',
                    label: lang,
                    checked: lang === selected,
                    click: this.setSpellcheck.bind(this, lang)
                }));
            electron.webFrame.setSpellCheckProvider('', false, {spellCheck: spellchecker.check});
            await spellchecker.setDictionary(selected);
        }

        async setSpellcheck(lang: string | undefined): Promise<void> {
            this.currentSettings.spellcheckLang = lang;
            setGeneralSettings(this.currentSettings);
            await spellchecker.setDictionary(lang);
        }

        async login(): Promise<void> {
            if(this.loggingIn) return;
            this.loggingIn = true;
            try {
                if(!this.saveLogin) await keyStore.deletePassword(this.account);
                const data = <{ticket?: string, error: string, characters: string[], default_character: string}>
                    (await Axios.post('https://www.f-list.net/json/getApiTicket.php',
                        qs.stringify({account: this.account, password: this.password, no_friends: true, no_bookmarks: true}))).data;
                if(data.error !== '') {
                    this.error = data.error;
                    return;
                }
                if(this.saveLogin) {
                    this.currentSettings.account = this.account;
                    await keyStore.setPassword(this.account, this.password);
                    this.currentSettings.host = this.host;
                    setGeneralSettings(this.currentSettings);
                }
                Socket.host = this.host;
                const connection = new Connection(Socket, this.account, this.getTicket.bind(this));
                connection.onEvent('connecting', async() => {
                    if((await this.settings.get('settings')) === undefined && SlimcatImporter.canImportCharacter(core.connection.character)) {
                        if(!confirm(l('importer.importGeneral'))) return this.settings.set('settings', new Settings());
                        (<Modal>this.$refs['importModal']).show(true);
                        await SlimcatImporter.importCharacter(core.connection.character, (progress) => this.importProgress = progress);
                        (<Modal>this.$refs['importModal']).hide();
                    }
                });
                connection.onEvent('connected', () => {
                    this.isConnected = true;
                    tray.setToolTip(document.title = `FChat 3.0 - ${core.connection.character}`);
                    Raven.setUserContext({username: core.connection.character});
                    trayMenu.insert(0, new electron.remote.MenuItem({label: core.connection.character, enabled: false}));
                    trayMenu.insert(1, new electron.remote.MenuItem({type: 'separator'}));
                });
                connection.onEvent('closed', () => {
                    this.isConnected = false;
                    tray.setToolTip(document.title = 'FChat 3.0');
                    Raven.setUserContext();
                    tray.setContextMenu(trayMenu = electron.remote.Menu.buildFromTemplate(defaultTrayMenu));
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

        async getTicket(): Promise<string> {
            const data = <{ticket?: string, error: string}>(await Axios.post('https://www.f-list.net/json/getApiTicket.php', qs.stringify(
                {account: this.account, password: this.password, no_friends: true, no_bookmarks: true, no_characters: true}))).data;
            if(data.ticket !== undefined) return data.ticket;
            throw new Error(data.error);
        }

        get styling(): string {
            try {
                return `<style>${fs.readFileSync(path.join(__dirname, `themes/${this.currentSettings.theme}.css`))}</style>`;
            } catch(e) {
                if(e.code === 'ENOENT' && this.currentSettings.theme !== 'default') {
                    this.currentSettings.theme = 'default';
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