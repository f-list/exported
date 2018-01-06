/**
 * @license
 * MIT License
 *
 * Copyright (c) 2017 F-List
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This license header applies to this file and all of the non-third-party assets it includes.
 * @file The entry point for the Electron main thread of F-Chat 3.0.
 * @copyright 2017 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import Axios from 'axios';
import * as electron from 'electron';
import log from 'electron-log'; //tslint:disable-line:match-default-export-name
import {autoUpdater} from 'electron-updater';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import {promisify} from 'util';
import l from '../chat/localize';
import {GeneralSettings, mkdir} from './common';
import * as windowState from './window_state';
import BrowserWindow = Electron.BrowserWindow;

// Module to control application life.
const app = electron.app;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const windows: Electron.BrowserWindow[] = [];
const characters: string[] = [];
let tabCount = 0;

const baseDir = app.getPath('userData');
mkdir(baseDir);
autoUpdater.logger = log;
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.file = path.join(baseDir, 'log.txt');
log.info('Starting application.');

const dictDir = path.join(baseDir, 'spellchecker');
mkdir(dictDir);
const downloadUrl = 'https://client.f-list.net/dictionaries/';
type DictionaryIndex = {[key: string]: {file: string, time: number} | undefined};
let availableDictionaries: DictionaryIndex | undefined;
const writeFile = promisify(fs.writeFile);
const requestConfig = {responseType: 'arraybuffer'};

async function getAvailableDictionaries(): Promise<ReadonlyArray<string>> {
    if(availableDictionaries === undefined) {
        const indexPath = path.join(dictDir, 'index.json');
        try {
            if(!fs.existsSync(indexPath) || fs.statSync(indexPath).mtimeMs + 86400000 * 7 < Date.now()) {
                availableDictionaries = (await Axios.get<DictionaryIndex>(`${downloadUrl}index.json`)).data;
                await writeFile(indexPath, JSON.stringify(availableDictionaries));
            } else availableDictionaries = <DictionaryIndex>JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        } catch(e) {
            availableDictionaries = {};
            log.error(`Error loading dictionaries: ${e}`);
        }
    }
    return Object.keys(availableDictionaries).sort();
}

async function setDictionary(lang: string | undefined): Promise<void> {
    const dict = availableDictionaries![lang!];
    if(dict !== undefined) {
        const dicPath = path.join(dictDir, `${lang}.dic`);
        if(!fs.existsSync(dicPath) || fs.statSync(dicPath).mtimeMs / 1000 < dict.time) {
            await writeFile(dicPath, new Buffer((await Axios.get<string>(`${downloadUrl}${dict.file}.dic`, requestConfig)).data));
            await writeFile(path.join(dictDir, `${lang}.aff`),
                new Buffer((await Axios.get<string>(`${downloadUrl}${dict.file}.aff`, requestConfig)).data));
            fs.utimesSync(dicPath, dict.time, dict.time);
        }
    }
    settings.spellcheckLang = lang;
    setGeneralSettings(settings);
}

const settingsDir = path.join(electron.app.getPath('userData'), 'data');
const file = path.join(settingsDir, 'settings');
const settings = new GeneralSettings();
let shouldImportSettings = false;
if(!fs.existsSync(file)) shouldImportSettings = true;
else
    try {
        Object.assign(settings, <GeneralSettings>JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch(e) {
        log.error(`Error loading settings: ${e}`);
    }

function setGeneralSettings(value: GeneralSettings): void {
    fs.writeFileSync(path.join(settingsDir, 'settings'), JSON.stringify(value));
    for(const w of electron.webContents.getAllWebContents()) w.send('settings', settings);
    shouldImportSettings = false;
}

async function addSpellcheckerItems(menu: Electron.Menu): Promise<void> {
    const dictionaries = await getAvailableDictionaries();
    const selected = settings.spellcheckLang;
    menu.append(new electron.MenuItem({
        type: 'radio',
        label: l('settings.spellcheck.disabled'),
        click: async() => setDictionary(undefined)
    }));
    for(const lang of dictionaries)
        menu.append(new electron.MenuItem({
            type: 'radio',
            label: lang,
            checked: lang === selected,
            click: async() => setDictionary(lang)
        }));
}

function setUpWebContents(webContents: Electron.WebContents): void {
    const openLinkExternally = (e: Event, linkUrl: string) => {
        e.preventDefault();
        const profileMatch = linkUrl.match(/^https?:\/\/(www\.)?f-list.net\/c\/(.+)\/?#?/);
        if(profileMatch !== null && settings.profileViewer) webContents.send('open-profile', decodeURIComponent(profileMatch[2]));
        else electron.shell.openExternal(linkUrl);
    };

    webContents.on('will-navigate', openLinkExternally);
    webContents.on('new-window', openLinkExternally);
}

function createWindow(): Electron.BrowserWindow | undefined {
    if(tabCount >= 3) return;
    const lastState = windowState.getSavedWindowState();
    const windowProperties: Electron.BrowserWindowConstructorOptions & {maximized: boolean} = {
        ...lastState, center: lastState.x === undefined
    };
    if(process.platform === 'darwin') windowProperties.titleBarStyle = 'hiddenInset';
    else windowProperties.frame = false;
    const window = new electron.BrowserWindow(windowProperties);
    windows.push(window);
    if(lastState.maximized) window.maximize();

    window.loadURL(url.format({
        pathname: path.join(__dirname, 'window.html'),
        protocol: 'file:',
        slashes: true,
        query: {settings: JSON.stringify(settings), import: shouldImportSettings ? 'true' : []}
    }));

    setUpWebContents(window.webContents);

    // Save window state when it is being closed.
    window.on('close', () => windowState.setSavedWindowState(window));
    window.on('closed', () => windows.splice(windows.indexOf(window), 1));

    return window;
}

function showPatchNotes(): void {
    electron.shell.openExternal('https://wiki.f-list.net/F-Chat_3.0#Changelog');
}

function onReady(): void {
    app.on('open-file', createWindow);

    if(settings.version !== app.getVersion()) {
        showPatchNotes();
        settings.version = app.getVersion();
        setGeneralSettings(settings);
    }

    if(process.env.NODE_ENV === 'production') {
        autoUpdater.checkForUpdates(); //tslint:disable-line:no-floating-promises
        const updateTimer = setInterval(async() => autoUpdater.checkForUpdates(), 3600000);
        let hasUpdate = false;
        autoUpdater.on('update-downloaded', () => {
            clearInterval(updateTimer);
            if(hasUpdate) return;
            hasUpdate = true;
            const menu = electron.Menu.getApplicationMenu();
            menu.append(new electron.MenuItem({
                label: l('action.updateAvailable'),
                submenu: electron.Menu.buildFromTemplate([{
                    label: l('action.update'),
                    click: () => autoUpdater.quitAndInstall(false, true)
                }, {
                    label: l('help.changelog'),
                    click: showPatchNotes
                }])
            }));
            electron.Menu.setApplicationMenu(menu);
            for(const w of windows) w.webContents.send('update-available');
        });
    }

    const viewItem = {
        label: `&${l('action.view')}`,
        submenu: <Electron.MenuItemConstructorOptions[]>[
            {role: 'resetzoom'},
            {role: 'zoomin'},
            {role: 'zoomout'},
            {type: 'separator'},
            {role: 'togglefullscreen'}
        ]
    };
    if(process.env.NODE_ENV !== 'production')
        viewItem.submenu.unshift({role: 'reload'}, {role: 'forcereload'}, {role: 'toggledevtools'}, {type: 'separator'});
    const spellcheckerMenu = new electron.Menu();
    //tslint:disable-next-line:no-floating-promises
    addSpellcheckerItems(spellcheckerMenu);
    const themes = fs.readdirSync(path.join(__dirname, 'themes')).filter((x) => x.substr(-4) === '.css').map((x) => x.slice(0, -4));
    const setTheme = (theme: string) => {
        settings.theme = theme;
        setGeneralSettings(settings);
    };
    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
        {
            label: `&${l('title')}`,
            submenu: [
                {label: l('action.newWindow'), click: createWindow, accelerator: 'CmdOrCtrl+n'},
                {
                    label: l('action.newTab'),
                    click: (_: Electron.MenuItem, w: Electron.BrowserWindow) => {
                        if(tabCount < 3) w.webContents.send('open-tab');
                    },
                    accelerator: 'CmdOrCtrl+t'
                },
                {
                    label: l('settings.logDir'),
                    click: (_, window: BrowserWindow) => {
                        const dir = <string[] | undefined>electron.dialog.showOpenDialog(
                            {defaultPath: new GeneralSettings().logDirectory, properties: ['openDirectory']});
                        if(dir !== undefined) {
                            const button = electron.dialog.showMessageBox(window, {
                                message: l('settings.logDir.confirm', dir[0], settings.logDirectory),
                                buttons: [l('confirmYes'), l('confirmNo')],
                                cancelId: 1
                            });
                            if(button === 0) {
                                for(const w of windows) {
                                    w.webContents.on('will-prevent-unload', (e) => e.preventDefault());
                                    w.close();
                                }
                                settings.logDirectory = dir[0];
                                setGeneralSettings(settings);
                                app.quit();
                            }
                        }
                    }
                },
                {
                    label: l('settings.closeToTray'), type: 'checkbox', checked: settings.closeToTray,
                    click: (item: Electron.MenuItem) => {
                        settings.closeToTray = item.checked;
                        setGeneralSettings(settings);
                    }
                }, {
                    label: l('settings.profileViewer'), type: 'checkbox', checked: settings.profileViewer,
                    click: (item: Electron.MenuItem) => {
                        settings.profileViewer = item.checked;
                        setGeneralSettings(settings);
                    }
                },
                {label: l('settings.spellcheck'), submenu: spellcheckerMenu},
                {
                    label: l('settings.theme'),
                    submenu: themes.map((x) => ({
                        checked: settings.theme === x,
                        click: () => setTheme(x),
                        label: x,
                        type: <'radio'>'radio'
                    }))
                },
                {type: 'separator'},
                {role: 'minimize'},
                {
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : undefined,
                    label: l('action.quit'),
                    click(_: Electron.MenuItem, w: Electron.BrowserWindow): void {
                        if(characters.length === 0) return app.quit();
                        const button = electron.dialog.showMessageBox(w,  {
                            message: l('chat.confirmLeave'),
                            buttons: [l('confirmYes'), l('confirmNo')],
                            cancelId: 1
                        });
                        if(button === 0) app.quit();
                    }
                }
            ]
        }, {
            label: `&${l('action.edit')}`,
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                {role: 'selectall'}
            ]
        }, viewItem, {
            label: `&${l('help')}`,
            submenu: [
                {
                    label: l('help.fchat'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/F-Chat_3.0')
                },
                {
                    label: l('help.feedback'),
                    click: () => electron.shell.openExternal('https://goo.gl/forms/WnLt3Qm3TPt64jQt2')
                },
                {
                    label: l('help.rules'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/Rules')
                },
                {
                    label: l('help.faq'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/Frequently_Asked_Questions')
                },
                {
                    label: l('help.report'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/How_to_Report_a_User#In_chat')
                },
                {label: l('version', app.getVersion()), click: showPatchNotes}
            ]
        }
    ]));
    electron.ipcMain.on('tab-added', (_: Event, id: number) => {
        const webContents = electron.webContents.fromId(id);
        setUpWebContents(webContents);
        ++tabCount;
        if(tabCount === 3)
            for(const w of windows) w.webContents.send('allow-new-tabs', false);
    });
    electron.ipcMain.on('tab-closed', () => {
        --tabCount;
        for(const w of windows) w.webContents.send('allow-new-tabs', true);
    });
    electron.ipcMain.on('save-login', (_: Event, account: string, host: string) => {
        settings.account = account;
        settings.host = host;
        setGeneralSettings(settings);
    });
    electron.ipcMain.on('connect', (e: Event & {sender: Electron.WebContents}, character: string) => {
        if(characters.indexOf(character) !== -1) return e.returnValue = false;
        else characters.push(character);
        e.returnValue = true;
    });
    electron.ipcMain.on('disconnect', (_: Event, character: string) => characters.splice(characters.indexOf(character), 1));
    const emptyBadge = electron.nativeImage.createEmpty();
    //tslint:disable-next-line:no-require-imports
    const badge = electron.nativeImage.createFromPath(path.join(__dirname, <string>require('./build/badge.png')));
    electron.ipcMain.on('has-new', (e: Event & {sender: Electron.WebContents}, hasNew: boolean) => {
        if(process.platform === 'darwin') app.dock.setBadge(hasNew ? '!' : '');
        electron.BrowserWindow.fromWebContents(e.sender).setOverlayIcon(hasNew ? badge : emptyBadge, hasNew ? 'New messages' : '');
    });
    createWindow();
}

const running = app.makeSingleInstance(createWindow);
if(running) app.quit();
else app.on('ready', onReady);
app.on('window-all-closed', () => app.quit());