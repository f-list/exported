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
 * @file The entry point for the mobile version of F-Chat 3.0.
 * @copyright 2018 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import Axios from 'axios';
import * as Raven from 'raven-js';
import Vue from 'vue';
import VueRaven from '../chat/vue-raven';
import Index from './Index.vue';

const version = (<{version: string}>require('./package.json')).version; //tslint:disable-line:no-require-imports
(<any>window)['setupPlatform'] = (platform: string) => { //tslint:disable-line:no-any
    Axios.defaults.params = { __fchat: `mobile-${platform}/${version}` };
};

if(process.env.NODE_ENV === 'production') {
    Raven.config('https://a9239b17b0a14f72ba85e8729b9d1612@sentry.f-list.net/2', {
        release: `mobile-${version}`,
        dataCallback: (data: {culprit: string, exception?: {values: {stacktrace: {frames: {filename: string}[]}}[]}}) => {
            data.culprit = `~${data.culprit.substr(data.culprit.lastIndexOf('/'))}`;
            if(data.exception !== undefined)
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

new Index({ //tslint:disable-line:no-unused-expression
    el: '#app'
});