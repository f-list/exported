import Axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {mkdir, nativeRequire} from './common';

process.env.SPELLCHECKER_PREFER_HUNSPELL = '1';
const downloadUrl = 'https://github.com/wooorm/dictionaries/raw/master/dictionaries/';
const dir = `${__dirname}/spellchecker`;
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
let availableDictionaries: string[] | undefined;
const writeFile = promisify(fs.writeFile);
const requestConfig = {responseType: 'arraybuffer'};
const spellchecker = new sc.Spellchecker();

export async function getAvailableDictionaries(): Promise<ReadonlyArray<string>> {
    if(availableDictionaries !== undefined) return availableDictionaries;
    const dicts = (<{name: string}[]>(await Axios.get('https://api.github.com/repos/wooorm/dictionaries/contents/dictionaries')).data)
        .map((x: {name: string}) => x.name);
    availableDictionaries = dicts;
    return dicts;
}

export async function setDictionary(lang: string | undefined): Promise<void> {
    const dictName = lang !== undefined ? lang.replace('-', '_') : undefined;
    if(dictName !== undefined) {
        const dicPath = path.join(dir, `${dictName}.dic`);
        if(!fs.existsSync(dicPath)) {
            await writeFile(dicPath, new Buffer(<string>(await Axios.get(`${downloadUrl}${lang}/index.dic`, requestConfig)).data));
            await writeFile(path.join(dir, `${dictName}.aff`),
                new Buffer(<string>(await Axios.get(`${downloadUrl}${lang}/index.aff`, requestConfig)).data));
        }
    }
    spellchecker.setDictionary(dictName, dir);
}

export function getCorrections(word: string): ReadonlyArray<string> {
    return spellchecker.getCorrectionsForMisspelling(word);
}

export const check = (text: string) => !spellchecker.isMisspelled(text);