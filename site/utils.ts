import Axios, {AxiosError, AxiosResponse} from 'axios';
//import {addFlashMessage, flashMessageType} from './flash_display';
import {InlineDisplayMode} from '../bbcode/interfaces';

export function avatarURL(name: string): string {
    const uregex = /^[a-zA-Z0-9_\-\s]+$/;
    if(!uregex.test(name)) return '#';
    return `${staticDomain}images/avatar/${name.toLowerCase()}.png`;
}

export function characterURL(name: string): string {
    const uregex = /^[a-zA-Z0-9_\-\s]+$/;
    if(!uregex.test(name)) return '#';
    return `${siteDomain}c/${name}`;
}

interface Dictionary<T> {
    [key: string]: T | undefined;
}

export function groupObjectBy<K extends string, T extends {[k in K]: string | number}>(obj: Dictionary<T>, key: K): Dictionary<T[]> {
    const newObject: Dictionary<T[]> = {};
    for(const objkey in obj) {
        if(!(objkey in obj)) continue;
        const realItem = obj[objkey]!;
        const newKey = realItem[key];
        if(newObject[<string>newKey] === undefined) newObject[newKey] = [];
        newObject[newKey]!.push(realItem);
    }
    return newObject;
}

export function groupArrayBy<K extends string, T extends {[k in K]: string | number}>(arr: T[], key: K): Dictionary<T[]> {
    const newObject: Dictionary<T[]> = {};
    arr.map((item) => {
        const realItem = item;
        const newKey = realItem[key];
        if(newObject[<string>newKey] === undefined) newObject[newKey] = [];
        newObject[newKey]!.push(realItem);
    });
    return newObject;
}

export function filterOut<K extends string, V, T extends {[key in K]: V}>(arr: ReadonlyArray<T>, field: K, value: V): T[] {
    return arr.filter((item) => item[field] !== value);
}

//tslint:disable-next-line:no-any
export function isJSONError(error: any): error is Error & {response: AxiosResponse<{[key: string]: object | string | number}>} {
    return (<AxiosError>error).response !== undefined && typeof (<AxiosError>error).response!.data === 'object';
}

export function ajaxError(error: any, prefix: string, showFlashMessage: boolean = true): void { //tslint:disable-line:no-any
    let message: string | undefined;
    if(error instanceof Error) {
        if(Axios.isCancel(error)) return;

        if(isJSONError(error)) {
            const data = <{error?: string | string[]}>error.response.data;
            if(typeof (data.error) === 'string')
                message = data.error;
            else if(typeof (data.error) === 'object' && data.error.length > 0)
                message = data.error[0];
        }
        if(message === undefined)
            message = (<Error & {response?: AxiosResponse}>error).response !== undefined ?
                (<Error & {response: AxiosResponse}>error).response.statusText : error.name;
    } else message = <string>error;
    if(showFlashMessage) flashError(`[ERROR] ${prefix}: ${message}`);
}

export function flashError(message: string): void {
    flashMessage('danger', message);
}

export function flashSuccess(message: string): void {
    flashMessage('success', message);
}

export function flashMessage(type: string, message: string): void {
    console.log(`${type}: ${message}`); //TODO addFlashMessage(type, message);
}

export let siteDomain = '';
export let staticDomain = '';

interface Settings {
    animatedIcons: boolean
    inlineDisplayMode: InlineDisplayMode
    defaultCharacter: number
    fuzzyDates: boolean
}

export let Settings: Settings = {
    animatedIcons: false,
    inlineDisplayMode: InlineDisplayMode.DISPLAY_ALL,
    defaultCharacter: -1,
    fuzzyDates: true
};

export function setDomains(site: string, stat: string): void {
    siteDomain = site;
    staticDomain = stat;
}

export function copySettings(settings: Settings): void {
    Settings.animatedIcons = settings.animatedIcons;
    Settings.inlineDisplayMode = settings.inlineDisplayMode;
    Settings.defaultCharacter = settings.defaultCharacter;
    Settings.fuzzyDates = settings.fuzzyDates;
}