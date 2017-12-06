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
import * as electron from 'electron';
import log from 'electron-log'; //tslint:disable-line:match-default-export-name
import {autoUpdater} from 'electron-updater';
import * as path from 'path';
import * as url from 'url';
import {mkdir} from './common';
import * as windowState from './window_state';

// Module to control application life.
const app = electron.app;
const datadir = process.argv.filter((x) => x.startsWith('--datadir='));
if(datadir.length > 0) app.setPath('userData', datadir[0].substr('--datadir='.length));

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const windows: Electron.BrowserWindow[] = [];

const baseDir = app.getPath('userData');
mkdir(baseDir);
autoUpdater.logger = log;
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.file = path.join(baseDir, 'log.txt');
log.info('Starting application.');

function sendUpdaterStatusToWindow(status: string, progress?: object): void {
    log.info(status);
    for(const window of windows) window.webContents.send('updater-status', status, progress);
}

const updaterEvents = ['checking-for-update', 'update-available', 'update-not-available', 'error', 'update-downloaded'];
for(const eventName of updaterEvents)
    autoUpdater.on(eventName, () => {
        sendUpdaterStatusToWindow(eventName);
    });

autoUpdater.on('download-progress', (_, progress: object) => {
    sendUpdaterStatusToWindow('download-progress', progress);
});

function runUpdater(): void {
    autoUpdater.checkForUpdates(); //tslint:disable-line:no-floating-promises
    setInterval(async() => autoUpdater.checkForUpdates(), 3600000);
    electron.ipcMain.on('install-update', () => autoUpdater.quitAndInstall(false, true));
}

function bindWindowEvents(window: Electron.BrowserWindow): void {
    // Prevent page navigation by opening links in an external browser.
    const openLinkExternally = (e: Event, linkUrl: string) => {
        e.preventDefault();
        const profileMatch = linkUrl.match(/^https?:\/\/(www\.)?f-list.net\/c\/(.+)/);
        if(profileMatch !== null) window.webContents.send('open-profile', decodeURIComponent(profileMatch[2]));
        else electron.shell.openExternal(linkUrl);
    };

    window.webContents.on('will-navigate', openLinkExternally);
    window.webContents.on('new-window', openLinkExternally);
    // Fix focus events not properly propagating down to the document.
    window.on('focus', () => window.webContents.send('focus', true));
    window.on('blur', () => window.webContents.send('focus', false));

    // Save window state when it is being closed.
    window.on('close', () => windowState.setSavedWindowState(window));
}

function createWindow(): void {
    const lastState = windowState.getSavedWindowState();
    const windowProperties = {...lastState, center: lastState.x === undefined};
    const window = new electron.BrowserWindow(windowProperties);
    windows.push(window);
    if(lastState.maximized) window.maximize();

    window.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    bindWindowEvents(window);

    window.on('closed', () => windows.splice(windows.indexOf(window), 1));

    if(process.env.NODE_ENV === 'production') runUpdater();
}

const running = app.makeSingleInstance(() => {
    if(windows.length < 3) createWindow();
    return true;
});
if(running) app.quit();
else app.on('ready', createWindow);
app.on('window-all-closed', () => app.quit());