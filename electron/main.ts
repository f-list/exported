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
import log from 'electron-log';
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
let mainWindow: Electron.BrowserWindow | undefined;

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
    mainWindow!.webContents.send('updater-status', status, progress);
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
    //tslint:disable-next-line:no-floating-promises
    autoUpdater.checkForUpdates();
    //tslint:disable-next-line:no-floating-promises
    setInterval(() => { autoUpdater.checkForUpdates(); }, 3600000);
    electron.ipcMain.on('install-update', () => {
        autoUpdater.quitAndInstall(false, true);
    });
}

function bindWindowEvents(window: Electron.BrowserWindow): void {
    // Prevent page navigation by opening links in an external browser.
    const openLinkExternally = (e: Event, linkUrl: string) => {
        e.preventDefault();
        electron.shell.openExternal(linkUrl);
    };

    window.webContents.on('will-navigate', openLinkExternally);
    window.webContents.on('new-window', openLinkExternally);
    // Fix focus events not properly propagating down to the document.
    window.on('focus', () => mainWindow!.webContents.send('focus', true));
    window.on('blur', () => mainWindow!.webContents.send('focus', false));

    // Save window state when it is being closed.
    window.on('close', () => windowState.setSavedWindowState(window));
}

function createWindow(): void {
    const lastState = windowState.getSavedWindowState();
    const windowProperties = {...lastState, center: lastState.x === undefined};
    // Create the browser window.
    mainWindow = new electron.BrowserWindow(windowProperties);
    if(lastState.maximized)
        mainWindow.maximize();

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    bindWindowEvents(mainWindow);

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = undefined;
    });

    if(process.env.NODE_ENV === 'production') runUpdater();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if(process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if(mainWindow === undefined) createWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.