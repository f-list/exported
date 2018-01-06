import * as qs from 'querystring';
import {GeneralSettings} from './common';
import Window from './Window.vue';

const params = <{[key: string]: string | undefined}>qs.parse(window.location.search.substr(1));
const settings = <GeneralSettings>JSON.parse(params['settings']!);
//tslint:disable-next-line:no-unused-expression
new Window({
    el: '#app',
    data: {settings}
});