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
 * @file The entry point for the Electron renderer of F-Chat 3.0.
 * @copyright 2017 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import * as electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as qs from 'querystring';
import * as Raven from 'raven-js';
import Vue from 'vue';
import {getKey} from '../chat/common';
import l from '../chat/localize';
import VueRaven from '../chat/vue-raven';
import {Keys} from '../keys';
import {GeneralSettings, nativeRequire} from './common';
import * as SlimcatImporter from './importer';
import Index from './Index.vue';

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if(e.ctrlKey && e.shiftKey && getKey(e) === Keys.KeyI)
        electron.remote.getCurrentWebContents().toggleDevTools();
});

process.env.SPELLCHECKER_PREFER_HUNSPELL = '1';
const sc = nativeRequire<{
    Spellchecker: {
        new(): {
            add(word: string): void
            remove(word: string): void
            isMisspelled(x: string): boolean
            setDictionary(name: string | undefined, dir: string): void
            getCorrectionsForMisspelling(word: string): ReadonlyArray<string>
        }
    }
}>('spellchecker/build/Release/spellchecker.node');
const spellchecker = new sc.Spellchecker();

if(process.env.NODE_ENV === 'production') {
    Raven.config('https://a9239b17b0a14f72ba85e8729b9d1612@sentry.f-list.net/2', {
        release: electron.remote.app.getVersion(),
        dataCallback(data: {culprit: string, exception: {values: {stacktrace: {frames: {filename: string}[]}}[]}}): void {
            data.culprit = `~${data.culprit.substr(data.culprit.lastIndexOf('/'))}`;
            for(const ex of data.exception.values)
                for(const frame of ex.stacktrace.frames) {
                    const index = frame.filename.lastIndexOf('/');
                    frame.filename = index !== -1 ? `~${frame.filename.substr(index)}` : frame.filename;
                }
        }
    }).addPlugin(VueRaven, Vue).install();
    (<Window & {onunhandledrejection(e: PromiseRejectionEvent): void}>window).onunhandledrejection = (e: PromiseRejectionEvent) => {
        Raven.captureException(<Error>e.reason);
    };

    electron.remote.getCurrentWebContents().on('devtools-opened', () => {
        console.log(`%c${l('consoleWarning.head')}`, 'background: red; color: yellow; font-size: 30pt');
        console.log(`%c${l('consoleWarning.body')}`, 'font-size: 16pt; color:red');
    });
}

const webContents = electron.remote.getCurrentWebContents();
webContents.on('context-menu', (_, props) => {
    const hasText = props.selectionText.trim().length > 0;
    const can = (type: string) => (<Electron.EditFlags & {[key: string]: boolean}>props.editFlags)[`can${type}`] && hasText;

    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
    if(hasText || props.isEditable)
        menuTemplate.push({
            id: 'copy',
            label: l('action.copy'),
            role: can('Copy') ? 'copy' : '',
            enabled: can('Copy')
        });
    if(props.isEditable)
        menuTemplate.push({
            id: 'cut',
            label: l('action.cut'),
            role: can('Cut') ? 'cut' : '',
            enabled: can('Cut')
        }, {
            id: 'paste',
            label: l('action.paste'),
            role: props.editFlags.canPaste ? 'paste' : '',
            enabled: props.editFlags.canPaste
        });
    else if(props.linkURL.length > 0 && props.mediaType === 'none' && props.linkURL.substr(0, props.pageURL.length) !== props.pageURL)
        menuTemplate.push({
            id: 'copyLink',
            label: l('action.copyLink'),
            click(): void {
                if(process.platform === 'darwin')
                    electron.clipboard.writeBookmark(props.linkText, props.linkURL);
                else
                    electron.clipboard.writeText(props.linkURL);
            }
        });
    if(props.misspelledWord !== '') {
        const corrections = spellchecker.getCorrectionsForMisspelling(props.misspelledWord);
        menuTemplate.unshift({
            label: l('spellchecker.add'),
            click: () => {
                if(customDictionary.indexOf(props.misspelledWord) !== -1) return;
                spellchecker.add(props.misspelledWord);
                customDictionary.push(props.misspelledWord);
                fs.writeFile(customDictionaryPath, JSON.stringify(customDictionary), () => {/**/});
            }
        }, {type: 'separator'});
        if(corrections.length > 0)
            menuTemplate.unshift(...corrections.map((correction: string) => ({
                label: correction,
                click: () => webContents.replaceMisspelling(correction)
            })));
        else menuTemplate.unshift({enabled: false, label: l('spellchecker.noCorrections')});
    } else if(customDictionary.indexOf(props.selectionText) !== -1)
        menuTemplate.unshift({
            label: l('spellchecker.remove'),
            click: () => {
                spellchecker.remove(props.selectionText);
                customDictionary.splice(customDictionary.indexOf(props.selectionText), 1);
                fs.writeFile(customDictionaryPath, JSON.stringify(customDictionary), () => {/**/});
            }
        }, {type: 'separator'});

    if(menuTemplate.length > 0) electron.remote.Menu.buildFromTemplate(menuTemplate).popup();
});

const dictDir = path.join(electron.remote.app.getPath('userData'), 'spellchecker');
electron.webFrame.setSpellCheckProvider('', false, {spellCheck: (text) => !spellchecker.isMisspelled(text)});
electron.ipcRenderer.on('settings', async(_: Event, s: GeneralSettings) => spellchecker.setDictionary(s.spellcheckLang, dictDir));

const params = <{[key: string]: string | undefined}>qs.parse(window.location.search.substr(1));
const settings = <GeneralSettings>JSON.parse(params['settings']!);
if(params['import'] !== undefined)
    try {
        if(SlimcatImporter.canImportGeneral() && confirm(l('importer.importGeneral'))) {
            SlimcatImporter.importGeneral(settings);
            electron.ipcRenderer.send('save-login', settings.account, settings.host);
        }
    } catch {
        alert(l('importer.error'));
    }
spellchecker.setDictionary(settings.spellcheckLang, dictDir);

const customDictionaryPath = path.join(settings.logDirectory, 'words');
const customDictionary = fs.existsSync(customDictionaryPath) ? <string[]>JSON.parse(fs.readFileSync(customDictionaryPath, 'utf8')) : [];
for(const word of customDictionary) spellchecker.add(word);

//tslint:disable-next-line:no-unused-expression
new Index({
    el: '#app',
    data: {settings}
});