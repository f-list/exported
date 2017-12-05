import {addMinutes} from 'date-fns';
import * as electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {Message as MessageImpl} from '../chat/common';
import core from '../chat/core';
import {Conversation, Logs as Logging, Settings} from '../chat/interfaces';
import {mkdir} from './common';

const dayMs = 86400000;
const baseDir = path.join(electron.remote.app.getPath('userData'), 'data');
mkdir(baseDir);

const noAssert = process.env.NODE_ENV === 'production';

export class GeneralSettings {
    account = '';
    closeToTray = true;
    profileViewer = true;
    host = 'wss://chat.f-list.net:9799';
    spellcheckLang: string | undefined = 'en-GB';
    theme = 'default';
}

export type Message = Conversation.EventMessage | {
    readonly sender: {readonly name: string}
    readonly text: string
    readonly time: Date
    readonly type: Conversation.Message.Type
};

interface IndexItem {
    index: {[key: number]: number | undefined}
    name: string
    offsets: number[]
}

interface Index {
    [key: string]: IndexItem | undefined
}

export function getLogDir(this: void, character: string = core.connection.character): string {
    const dir = path.join(baseDir, character, 'logs');
    mkdir(dir);
    return dir;
}

function getLogFile(this: void, key: string): string {
    return path.join(getLogDir(), key);
}

export function checkIndex(this: void, index: Index, message: Message, key: string, name: string,
                           size: number | (() => number)): Buffer | undefined {
    const date = Math.floor(message.time.getTime() / dayMs - message.time.getTimezoneOffset() / 1440);
    let buffer: Buffer, offset = 0;
    let item = index[key];
    if(item !== undefined) {
        if(item.index[date] !== undefined) return;
        buffer = Buffer.allocUnsafe(7);
    } else {
        index[key] = item = {name, index: {}, offsets: []};
        const nameLength = Buffer.byteLength(name);
        buffer = Buffer.allocUnsafe(nameLength + 8);
        buffer.writeUInt8(nameLength, 0, noAssert);
        buffer.write(name, 1);
        offset = nameLength + 1;
    }
    const newValue = typeof size === 'function' ? size() : size;
    item.index[date] = item.offsets.length;
    item.offsets.push(newValue);
    buffer.writeUInt16LE(date, offset, noAssert);
    buffer.writeUIntLE(newValue, offset + 2, 5, noAssert);
    return buffer;
}

export function serializeMessage(message: Message): {serialized: Buffer, size: number} {
    const name = message.type !== Conversation.Message.Type.Event ? message.sender.name : '';
    const senderLength = Buffer.byteLength(name);
    const messageLength = Buffer.byteLength(message.text);
    const buffer = Buffer.allocUnsafe(senderLength + messageLength + 10);
    buffer.writeUInt32LE(message.time.getTime() / 1000, 0, noAssert);
    buffer.writeUInt8(message.type, 4, noAssert);
    buffer.writeUInt8(senderLength, 5, noAssert);
    buffer.write(name, 6);
    let offset = senderLength + 6;
    buffer.writeUInt16LE(messageLength, offset, noAssert);
    buffer.write(message.text, offset += 2);
    buffer.writeUInt16LE(offset += messageLength, offset, noAssert);
    return {serialized: buffer, size: offset + 2};
}

function deserializeMessage(buffer: Buffer): {end: number, message: Conversation.Message} {
    const time = buffer.readUInt32LE(0, noAssert);
    const type = buffer.readUInt8(4, noAssert);
    const senderLength = buffer.readUInt8(5, noAssert);
    let offset = senderLength + 6;
    const sender = buffer.toString('utf8', 6, offset);
    const messageLength = buffer.readUInt16LE(offset, noAssert);
    offset += 2;
    const text = buffer.toString('utf8', offset, offset += messageLength);
    const message = new MessageImpl(type, core.characters.get(sender), text, new Date(time * 1000));
    return {message, end: offset + 2};
}

export class Logs implements Logging.Persistent {
    private index: Index = {};

    constructor() {
        core.connection.onEvent('connecting', () => {
            this.index = {};
            const dir = getLogDir();
            const files = fs.readdirSync(dir);
            for(const file of files)
                if(file.substr(-4) === '.idx') {
                    const content = fs.readFileSync(path.join(dir, file));
                    let offset = content.readUInt8(0, noAssert) + 1;
                    const item: IndexItem = {
                        name: content.toString('utf8', 1, offset),
                        index: {},
                        offsets: new Array(content.length - offset)
                    };
                    for(; offset < content.length; offset += 7) {
                        const key = content.readUInt16LE(offset);
                        item.index[key] = item.offsets.length;
                        item.offsets.push(content.readUIntLE(offset + 2, 5, noAssert));
                    }
                    this.index[file.slice(0, -4).toLowerCase()] = item;
                }
        });
    }

    async getBacklog(conversation: Conversation): Promise<ReadonlyArray<Conversation.Message>> {
        const file = getLogFile(conversation.key);
        if(!fs.existsSync(file)) return [];
        let count = 20;
        let messages = new Array<Conversation.Message>(count);
        const fd = fs.openSync(file, 'r');
        let pos = fs.fstatSync(fd).size;
        const buffer = Buffer.allocUnsafe(65536);
        while(pos > 0 && count > 0) {
            fs.readSync(fd, buffer, 0, 2, pos - 2);
            const length = buffer.readUInt16LE(0);
            pos = pos - length - 2;
            fs.readSync(fd, buffer, 0, length, pos);
            messages[--count] = deserializeMessage(buffer).message;
        }
        if(count !== 0) messages = messages.slice(count);
        return messages;
    }

    getLogDates(key: string): ReadonlyArray<Date> {
        const entry = this.index[key];
        if(entry === undefined) return [];
        const dates = [];
        for(const item in entry.index) { //tslint:disable:forin
            const date = new Date(parseInt(item, 10) * dayMs);
            dates.push(addMinutes(date, date.getTimezoneOffset()));
        }
        return dates;
    }

    async getLogs(key: string, date: Date): Promise<ReadonlyArray<Conversation.Message>> {
        const index = this.index[key];
        if(index === undefined) return [];
        const dateOffset = index.index[Math.floor(date.getTime() / dayMs - date.getTimezoneOffset() / 1440)];
        if(dateOffset === undefined) return [];
        const buffer = Buffer.allocUnsafe(50100);
        const messages: Conversation.Message[] = [];
        const file = getLogFile(key);
        const fd = fs.openSync(file, 'r');
        let pos = index.offsets[dateOffset];
        const size = dateOffset + 1 < index.offsets.length ? index.offsets[dateOffset + 1] : (fs.fstatSync(fd)).size;
        while(pos < size) {
            fs.readSync(fd, buffer, 0, 50100, pos);
            const deserialized = deserializeMessage(buffer);
            messages.push(deserialized.message);
            pos += deserialized.end;
        }
        return messages;
    }

    logMessage(conversation: {key: string, name: string}, message: Message): void {
        const file = getLogFile(conversation.key);
        const buffer = serializeMessage(message).serialized;
        const hasIndex = this.index[conversation.key] !== undefined;
        const indexBuffer = checkIndex(this.index, message, conversation.key, conversation.name,
            () => fs.existsSync(file) ? fs.statSync(file).size : 0);
        if(indexBuffer !== undefined) fs.writeFileSync(`${file}.idx`, indexBuffer, {flag: hasIndex ? 'a' : 'wx'});
        fs.writeFileSync(file, buffer, {flag: 'a'});
    }

    get conversations(): ReadonlyArray<{id: string, name: string}> {
        const conversations: {id: string, name: string}[] = [];
        for(const key in this.index) conversations.push({id: key, name: this.index[key]!.name});
        conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
        return conversations;
    }
}

export function getGeneralSettings(): GeneralSettings | undefined {
    const file = path.join(baseDir, 'settings');
    if(!fs.existsSync(file)) return undefined;
    return <GeneralSettings>JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function setGeneralSettings(value: GeneralSettings): void {
    fs.writeFileSync(path.join(baseDir, 'settings'), JSON.stringify(value));
}

function getSettingsDir(character: string = core.connection.character): string {
    const dir = path.join(baseDir, character, 'settings');
    mkdir(dir);
    return dir;
}

export class SettingsStore implements Settings.Store {
    async get<K extends keyof Settings.Keys>(key: K, character?: string): Promise<Settings.Keys[K] | undefined> {
        const file = path.join(getSettingsDir(character), key);
        if(!fs.existsSync(file)) return undefined;
        return <Settings.Keys[K]>JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    async getAvailableCharacters(): Promise<ReadonlyArray<string>> {
        return (fs.readdirSync(baseDir)).filter((x) => fs.lstatSync(path.join(baseDir, x)).isDirectory());
    }

    async set<K extends keyof Settings.Keys>(key: K, value: Settings.Keys[K]): Promise<void> {
        fs.writeFileSync(path.join(getSettingsDir(), key), JSON.stringify(value));
    }
}