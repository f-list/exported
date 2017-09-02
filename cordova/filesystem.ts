import {getByteLength, Message as MessageImpl} from '../chat/common';
import core from '../chat/core';
import {Conversation, Logs as Logging, Settings} from '../chat/interfaces';

declare global {
    class TextEncoder {
        readonly encoding: string;

        encode(input?: string, options?: {stream: boolean}): Uint8Array;
    }

    class TextDecoder {
        readonly encoding: string;
        readonly fatal: boolean;
        readonly ignoreBOM: boolean;

        constructor(utfLabel?: string, options?: {fatal?: boolean, ignoreBOM?: boolean})

        decode(input?: ArrayBufferView, options?: {stream: boolean}): string;
    }
}

const dayMs = 86400000;
let fs: FileSystem;

export class GeneralSettings {
    account = '';
    password = '';
    host = 'wss://chat.f-list.net:9799';
    theme = 'dark';
}

type Index = {[key: string]: {name: string, index: {[key: number]: number | undefined}} | undefined};

/*tslint:disable:promise-function-async*///all of these are simple wrappers
export function init(): Promise<void> {
    return new Promise((resolve, reject) => {
        document.addEventListener('deviceready', () => {
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, (f) => {
                fs = f;
                resolve();
            }, reject);
        });
    });
}

function readAsString(file: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(<string>reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(<ArrayBuffer>reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function getFile(root: DirectoryEntry, path: string): Promise<File | undefined> {
    return new Promise<File | undefined>((resolve, reject) => {
        root.getFile(path, {create: false}, (entry) => entry.file((file) => {
            resolve(file);
        }, reject), (e) => {
            if(e.code === FileError.NOT_FOUND_ERR) resolve(undefined);
            else reject(e);
        });
    });
}

function getWriter(root: DirectoryEntry, path: string): Promise<FileWriter> {
    return new Promise<FileWriter>((resolve, reject) => root.getFile(path, {create: true},
        (file) => file.createWriter(resolve, reject), reject));
}

function getDir(root: DirectoryEntry, name: string): Promise<DirectoryEntry> {
    return new Promise<DirectoryEntry>((resolve, reject) => root.getDirectory(name, {create: true}, resolve, reject));
}

function getEntries(root: DirectoryEntry): Promise<ReadonlyArray<Entry>> {
    const reader = root.createReader();
    return new Promise<ReadonlyArray<Entry>>((resolve, reject) => reader.readEntries(resolve, reject));
}

//tslib:enable

function serializeMessage(message: Conversation.Message): Blob {
    const name = message.type !== Conversation.Message.Type.Event ? message.sender.name : '';
    const buffer = new ArrayBuffer(8);
    const dv = new DataView(buffer);
    dv.setUint32(0, message.time.getTime() / 1000);
    dv.setUint8(4, message.type);
    const senderLength = getByteLength(name);
    dv.setUint8(5, senderLength);
    const textLength = getByteLength(message.text);
    dv.setUint16(6, textLength);
    return new Blob([buffer, name, message.text, String.fromCharCode(senderLength + textLength + 10)]);
}

function deserializeMessage(buffer: ArrayBuffer): {message: Conversation.Message, end: number} {
    const dv = new DataView(buffer, 0, 8);
    const time = dv.getUint32(0);
    const type = dv.getUint8(4);
    const senderLength = dv.getUint8(5);
    const messageLength = dv.getUint16(6);
    let index = 8;
    const sender = decoder.decode(new DataView(buffer, index, senderLength));
    index += senderLength;
    const text = decoder.decode(new DataView(buffer, index, messageLength));
    return {message: new MessageImpl(type, core.characters.get(sender), text, new Date(time)), end: index + messageLength + 2};
}

const decoder = new TextDecoder('utf8');

export class Logs implements Logging.Persistent {
    private index: Index = {};
    private logDir: DirectoryEntry;

    constructor() {
        core.connection.onEvent('connecting', async() => {
            this.index = {};
            const charDir = await getDir(fs.root, core.connection.character);
            this.logDir = await getDir(charDir, 'logs');
            const entries = await getEntries(this.logDir);
            for(const entry of entries)
                if(entry.name.substr(-4) === '.idx') {
                    const file = await new Promise<File>((s, j) => (<FileEntry>entry).file(s, j));
                    const buffer = await readAsArrayBuffer(file);
                    const dv = new DataView(buffer);
                    let offset = dv.getUint8(0);
                    const name = decoder.decode(new DataView(buffer, 1, offset++));
                    const index: {[key: number]: number} = {};
                    for(; offset < dv.byteLength; offset += 7) {
                        const key = dv.getUint16(offset);
                        index[key] = dv.getUint32(offset + 2) << 8 | dv.getUint8(offset + 6);
                    }
                    this.index[entry.name.slice(0, -4).toLowerCase()] = {name, index};
                }
        });
    }

    async logMessage(conversation: Conversation, message: Conversation.Message): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.logDir.getFile(conversation.key, {create: true}, (file) => {
                const serialized = serializeMessage(message);
                const date = Math.floor(message.time.getTime() / dayMs);
                let indexBuffer: {}[] | undefined;
                let index = this.index[conversation.key];
                if(index !== undefined) {
                    if(index.index[date] === undefined) indexBuffer = [];
                } else {
                    index = this.index[conversation.key] = {name: conversation.name, index: {}};
                    const nameLength = getByteLength(conversation.name);
                    indexBuffer = [String.fromCharCode(nameLength), conversation.name];
                }
                if(indexBuffer !== undefined)
                    file.getMetadata((data) => {
                        index!.index[date] = data.size;
                        const dv = new DataView(new ArrayBuffer(7));
                        dv.setUint16(0, date);
                        dv.setUint32(2, data.size >> 8);
                        dv.setUint8(6, data.size % 256);
                        indexBuffer!.push(dv);
                        this.logDir.getFile(`${conversation.key}.idx`, {create: true}, (indexFile) => {
                            indexFile.createWriter((writer) => writer.write(new Blob(indexBuffer)), reject);
                        }, reject);
                    }, reject);
                file.createWriter((writer) => writer.write(serialized), reject);
                resolve();
            }, reject);
        });
    }

    async getBacklog(conversation: Conversation): Promise<Conversation.Message[]> {
        const file = await getFile(this.logDir, conversation.key);
        if(file === undefined) return [];
        let count = 20;
        let messages = new Array<Conversation.Message>(count);
        let pos = file.size;
        while(pos > 0 && count > 0) {
            const length = new DataView(await readAsArrayBuffer(file)).getUint16(0);
            pos = pos - length - 2;
            messages[--count] = deserializeMessage(await readAsArrayBuffer(file.slice(pos, pos + length))).message;
        }
        if(count !== 0) messages = messages.slice(count);
        return messages;
    }

    async getLogs(key: string, date: Date): Promise<Conversation.Message[]> {
        const file = await getFile(this.logDir, key);
        if(file === undefined) return [];
        const messages: Conversation.Message[] = [];
        const day = date.getTime() / dayMs;
        const index = this.index[key];
        if(index === undefined) return [];
        let pos = index.index[date.getTime() / dayMs];
        if(pos === undefined) return [];
        while(pos < file.size) {
            const deserialized = deserializeMessage(await readAsArrayBuffer(file.slice(pos, pos + 51000)));
            if(Math.floor(deserialized.message.time.getTime() / dayMs) !== day) break;
            messages.push(deserialized.message);
            pos += deserialized.end;
        }
        return messages;
    }

    getLogDates(key: string): ReadonlyArray<Date> {
        const entry = this.index[key];
        if(entry === undefined) return [];
        const dates = [];
        for(const date in entry.index) //tslint:disable-line:forin
            dates.push(new Date(parseInt(date, 10) * dayMs));
        return dates;
    }

    get conversations(): ReadonlyArray<{id: string, name: string}> {
        const conversations: {id: string, name: string}[] = [];
        for(const key in this.index) conversations.push({id: key, name: this.index[key]!.name});
        conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
        return conversations;
    }
}

export async function getGeneralSettings(): Promise<GeneralSettings | undefined> {
    const file = await getFile(fs.root, 'settings');
    if(file === undefined) return undefined;
    return <GeneralSettings>JSON.parse(await readAsString(file));
}

export async function setGeneralSettings(value: GeneralSettings): Promise<void> {
    const writer = await getWriter(fs.root, 'settings');
    writer.write(new Blob([JSON.stringify(value)]));
}

async function getSettingsDir(character: string = core.connection.character): Promise<DirectoryEntry> {
    return new Promise<DirectoryEntry>((resolve, reject) => {
        fs.root.getDirectory(character, {create: true}, resolve, reject);
    });
}

export class SettingsStore implements Settings.Store {
    async get<K extends keyof Settings.Keys>(key: K, character?: string): Promise<Settings.Keys[K] | undefined> {
        const dir = await getSettingsDir(character);
        const file = await getFile(dir, key);
        if(file === undefined) return undefined;
        return <Settings.Keys[K]>JSON.parse(await readAsString(file));
    }

    async set<K extends keyof Settings.Keys>(key: K, value: Settings.Keys[K]): Promise<void> {
        const writer = await getWriter(await getSettingsDir(), key);
        writer.write(new Blob([JSON.stringify(value)]));
    }

    async getAvailableCharacters(): Promise<string[]> {
        return (await getEntries(fs.root)).filter((x) => x.isDirectory).map((x) => x.name);
    }
}