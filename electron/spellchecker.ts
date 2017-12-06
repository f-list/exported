import Axios from 'axios';
import * as electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {mkdir, nativeRequire} from './common';

process.env.SPELLCHECKER_PREFER_HUNSPELL = '1';
const downloadUrl = 'https://client.f-list.net/dictionaries/';
const dir = path.join(electron.remote.app.getPath('userData'), 'spellchecker');
mkdir(dir);
//tslint:disable-next-line
const sc = nativeRequire<{
    Spellchecker: {
        new(): {
            isMisspelled(x: string): boolean,
            setDictionary(name: string | undefined, dir: string): void,
            getCorrectionsForMisspelling(word: string): ReadonlyArray<string>
        }
    }
}>('spellchecker/build/Release/spellchecker.node');
type DictionaryIndex = {[key: string]: {file: string, time: number} | undefined};
let availableDictionaries: DictionaryIndex | undefined;
const writeFile = promisify(fs.writeFile);
const requestConfig = {responseType: 'arraybuffer'};
const spellchecker = new sc.Spellchecker();

export async function getAvailableDictionaries(): Promise<ReadonlyArray<string>> {
    if(availableDictionaries === undefined) {
        const indexPath = path.join(dir, 'index.json');
        if(!fs.existsSync(indexPath) || fs.statSync(indexPath).mtimeMs + 86400000 * 7 < Date.now()) {
            availableDictionaries = (await Axios.get<DictionaryIndex>(`${downloadUrl}index.json`)).data;
            await writeFile(indexPath, JSON.stringify(availableDictionaries));
        } else availableDictionaries = <DictionaryIndex>JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    return Object.keys(availableDictionaries).sort();
}

export async function setDictionary(lang: string | undefined): Promise<void> {
    const dict = availableDictionaries![lang!];
    if(dict !== undefined) {
        const dicPath = path.join(dir, `${lang}.dic`);
        if(!fs.existsSync(dicPath) || fs.statSync(dicPath).mtimeMs / 1000 < dict.time) {
            await writeFile(dicPath, new Buffer((await Axios.get<string>(`${downloadUrl}${dict.file}.dic`, requestConfig)).data));
            await writeFile(path.join(dir, `${lang}.aff`),
                new Buffer((await Axios.get<string>(`${downloadUrl}${dict.file}.aff`, requestConfig)).data));
            fs.utimesSync(dicPath, dict.time, dict.time);
        }
    }
    spellchecker.setDictionary(lang, dir);
}

export function getCorrections(word: string): ReadonlyArray<string> {
    return spellchecker.getCorrectionsForMisspelling(word);
}

export const check = (text: string) => !spellchecker.isMisspelled(text);