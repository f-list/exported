import * as electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class GeneralSettings {
    account = '';
    closeToTray = true;
    profileViewer = true;
    host = 'wss://chat.f-list.net:9799';
    logDirectory = path.join(electron.app.getPath('userData'), 'data');
    spellcheckLang: string | undefined = 'en-GB';
    theme = 'default';
    version = electron.app.getVersion();
    beta = false;
}

export function mkdir(dir: string): void {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if(!(e instanceof Error)) throw e;
        switch((<Error & {code: string}>e).code) {
            case 'ENOENT':
                const dirname = path.dirname(dir);
                if(dirname === dir) throw e;
                mkdir(dirname);
                mkdir(dir);
                break;
            default:
                try {
                    const stat = fs.statSync(dir);
                    if(stat.isDirectory()) return;
                } catch(e) {
                    console.log(e);
                }
                throw e;
        }
    }
}

//tslint:disable
const Module = require('module');

export function nativeRequire<T>(module: string): T {
    return Module.prototype.require.call({paths: Module._nodeModulePaths(__dirname)}, module);
}

//tslint:enable