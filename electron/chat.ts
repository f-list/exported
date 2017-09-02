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
import 'bootstrap/js/dropdown.js';
import 'bootstrap/js/modal.js';
import * as electron from 'electron';
import * as Raven from 'raven-js';
import Vue from 'vue';
import VueRaven from '../chat/vue-raven';
import Index from './Index.vue';

if(process.env.NODE_ENV === 'production') {
    Raven.config('https://af3e6032460e418cb794b1799e536f37@sentry.newtsin.space/2', {
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
}

//tslint:disable-next-line:no-unused-expression
new Index({
    el: '#app'
});

electron.ipcRenderer.on('focus', (_: Event, message: boolean) => message ? window.focus() : window.blur());

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if(e.which === 123)
        electron.remote.getCurrentWebContents().toggleDevTools();
});