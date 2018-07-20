/**
 * @license
 * MIT License
 *
 * Copyright (c) 2018 F-List
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
 * @copyright 2018 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import Axios from 'axios';
import * as Raven from 'raven-js';
import Vue from 'vue';
import Chat from '../chat/Chat.vue';
import {init as initCore} from '../chat/core';
import l from '../chat/localize';
import VueRaven from '../chat/vue-raven';
import Socket from '../chat/WebSocket';
import Connection from '../fchat/connection';
import '../scss/fa.scss'; //tslint:disable-line:no-import-side-effect
import {Logs, SettingsStore} from './logs';
import Notifications from './notifications';

//@ts-ignore
if(typeof window.Promise !== 'function' || typeof window.Notification !== 'function') //tslint:disable-line:strict-type-predicates
    alert('Your browser is too old to be supported by F-Chat 3.0. Please update to a newer version.');

const version = (<{version: string}>require('./package.json')).version; //tslint:disable-line:no-require-imports
Axios.defaults.params = { __fchat: `web/${version}` };

if(process.env.NODE_ENV === 'production') {
    Raven.config('https://a9239b17b0a14f72ba85e8729b9d1612@sentry.f-list.net/2', {
        release: `web-${version}`,
        dataCallback: (data: {culprit?: string, exception?: {values: {stacktrace: {frames: {filename: string}[]}}[]}}) => {
            if(data.culprit !== undefined) {
                const end = data.culprit.lastIndexOf('?');
                data.culprit = `~${data.culprit.substring(data.culprit.lastIndexOf('/'), end === -1 ? undefined : end)}`;
            }
            if(data.exception !== undefined)
                for(const ex of data.exception.values)
                    for(const frame of ex.stacktrace.frames) {
                        const index = frame.filename.lastIndexOf('/');
                        const endIndex = frame.filename.lastIndexOf('?');
                        frame.filename = `~${frame.filename.substring(index !== -1 ? index : 0, endIndex === -1 ? undefined : endIndex)}`;
                    }
        }
    }).addPlugin(VueRaven, Vue).install();
    (<Window & {onunhandledrejection(e: PromiseRejectionEvent): void}>window).onunhandledrejection = (e: PromiseRejectionEvent) => {
        Raven.captureException(<Error>e.reason);
    };
}

declare const chatSettings: {account: string, theme: string, characters: ReadonlyArray<string>, defaultCharacter: string | null};

const ticketProvider = async() => {
    const data = (await Axios.post<{ticket?: string, error: string}>(
        '/json/getApiTicket.php?no_friends=true&no_bookmarks=true&no_characters=true')).data;
    if(data.ticket !== undefined) return data.ticket;
    throw new Error(data.error);
};

const connection = new Connection('F-Chat 3.0 (Web)', version, Socket, chatSettings.account, ticketProvider);
initCore(connection, Logs, SettingsStore, Notifications);

window.addEventListener('beforeunload', (e) => {
    if(!connection.isOpen) return;
    e.returnValue = l('chat.confirmLeave');
    return l('chat.confirmLeave');
});

require(`../scss/themes/chat/${chatSettings.theme}.scss`);

new Chat({ //tslint:disable-line:no-unused-expression
    el: '#app',
    propsData: {ownCharacters: chatSettings.characters, defaultCharacter: chatSettings.defaultCharacter, version}
});