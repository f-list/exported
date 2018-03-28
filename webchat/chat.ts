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
 * @file The entry point for the web version of F-Chat 3.0.
 * @copyright 2017 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import Axios from 'axios';
import * as Raven from 'raven-js';
import Vue from 'vue';
import Chat from '../chat/Chat.vue';
import {init as initCore} from '../chat/core';
import Notifications from '../chat/notifications';
import VueRaven from '../chat/vue-raven';
import Socket from '../chat/WebSocket';
import Connection from '../fchat/connection';
import '../scss/fa.scss'; //tslint:disable-line:no-import-side-effect
import {Logs, SettingsStore} from './logs';

declare const chatSettings: {account: string, theme: string, characters: ReadonlyArray<string>, defaultCharacter: string | null};

if(process.env.NODE_ENV === 'production') {
    Raven.config('https://a9239b17b0a14f72ba85e8729b9d1612@sentry.f-list.net/2', {
        release: `web-${require('./package.json').version}`, //tslint:disable-line:no-require-imports no-unsafe-any
        dataCallback: (data: {culprit: string, exception: {values: {stacktrace: {frames: {filename: string}[]}}[]}}) => {
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

const ticketProvider = async() => {
    const data = (await Axios.post<{ticket?: string, error: string}>(
        '/json/getApiTicket.php?no_friends=true&no_bookmarks=true&no_characters=true')).data;
    if(data.ticket !== undefined) return data.ticket;
    throw new Error(data.error);
};

initCore(new Connection('F-Chat 3.0 (Web)', '3.0', Socket, chatSettings.account, ticketProvider), Logs, SettingsStore, Notifications);

require(`../scss/themes/chat/${chatSettings.theme}.scss`);

new Chat({ //tslint:disable-line:no-unused-expression
    el: '#app',
    propsData: {
        ownCharacters: chatSettings.characters,
        defaultCharacter: chatSettings.defaultCharacter
    }
});