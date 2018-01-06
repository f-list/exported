import {getByteLength, Message as MessageImpl} from '../chat/common';
import core from '../chat/core';
import {Conversation, Logs as Logging, Settings} from '../chat/interfaces';

declare global {
    const NativeFile: {
        readFile(name: string): Promise<string | undefined>
        readFile(name: string, start: number, length: number): Promise<string | undefined>
        writeFile(name: string, data: string): Promise<void>
        listDirectories(name: string): Promise<string>
        listFiles(name: string): Promise<string>
        getSize(name: string): Promise<number>
        append(name: string, data: string): Promise<void>
        ensureDirectory(name: string): Promise<void>
    };
}

const dayMs = 86400000;

export class GeneralSettings {
    account = '';
    password = '';
    host = 'wss://chat.f-list.net:9799';
    theme = 'default';
}

type Index = {[key: string]: {name: string, index: {[key: number]: number | undefined}} | undefined};

function serializeMessage(message: Conversation.Message): string {
    const time = message.time.getTime() / 1000;
    let str = String.fromCharCode((time >> 24) % 256) + String.fromCharCode((time >> 16) % 256)
        + String.fromCharCode((time >> 8) % 256) + String.fromCharCode(time % 256);
    str += String.fromCharCode(message.type);
    if(message.type !== Conversation.Message.Type.Event) {
        str += String.fromCharCode(message.sender.name.length);
        str += message.sender.name;
    } else str += '\0';
    const textLength = message.text.length;
    str += String.fromCharCode((textLength >> 8) % 256) + String.fromCharCode(textLength % 256);
    str += message.text;
    const length = getByteLength(str);
    str += String.fromCharCode((length >> 8) % 256) + String.fromCharCode(length % 256);
    return str;
}

function deserializeMessage(str: string): {message: Conversation.Message, end: number} {
    let index = 0;
    const time = str.charCodeAt(index++) << 24 | str.charCodeAt(index++) << 16 | str.charCodeAt(index++) << 8 | str.charCodeAt(index++);
    const type = str.charCodeAt(index++);
    const senderLength = str.charCodeAt(index++);
    const sender = str.substring(index, index += senderLength);
    const messageLength = str.charCodeAt(index++) << 8 | str.charCodeAt(index++);
    const text = str.substring(index, index += messageLength);
    const end = str.charCodeAt(index++) << 8 | str.charCodeAt(index);
    return {message: new MessageImpl(type, core.characters.get(sender), text, new Date(time * 1000)), end: end + 2};
}

export class Logs implements Logging.Persistent {
    private index: Index = {};
    private logDir: string;

    constructor() {
        core.connection.onEvent('connecting', async() => {
            this.index = {};
            this.logDir = `${core.connection.character}/logs`;
            await NativeFile.ensureDirectory(this.logDir);
            const entries = <string[]>JSON.parse(await NativeFile.listFiles(this.logDir));
            for(const entry of entries)
                if(entry.substr(-4) === '.idx') {
                    const str = (await NativeFile.readFile(`${this.logDir}/${entry}`))!;
                    let i = str.charCodeAt(0);
                    const name = str.substr(1, i++);
                    const index: {[key: number]: number} = {};
                    while(i < str.length) {
                        const key = str.charCodeAt(i++) << 8 | str.charCodeAt(i++);
                        index[key] = str.charCodeAt(i++) << 32 | str.charCodeAt(i++) << 24 | str.charCodeAt(i++) << 16 |
                            str.charCodeAt(i++) << 8 | str.charCodeAt(i++);
                    }
                    this.index[entry.slice(0, -4).toLowerCase()] = {name, index};
                }
        });
    }

    async logMessage(conversation: Conversation, message: Conversation.Message): Promise<void> {
        const file = `${this.logDir}/${conversation.key}`;
        const serialized = serializeMessage(message);
        const date = Math.floor(message.time.getTime() / dayMs);
        let indexBuffer: string | undefined;
        let index = this.index[conversation.key];
        if(index !== undefined) {
            if(index.index[date] === undefined) indexBuffer = '';
        } else {
            index = this.index[conversation.key] = {name: conversation.name, index: {}};
            const nameLength = getByteLength(conversation.name);
            indexBuffer = String.fromCharCode(nameLength) + conversation.name;
        }
        if(indexBuffer !== undefined) {
            const size = await NativeFile.getSize(file);
            index.index[date] = size;
            indexBuffer += String.fromCharCode((date >> 8) % 256) + String.fromCharCode(date % 256) +
                String.fromCharCode((size >> 32) % 256) + String.fromCharCode((size >> 24) % 256) +
                String.fromCharCode((size >> 16) % 256) + String.fromCharCode((size >> 8) % 256) + String.fromCharCode(size % 256);
            await NativeFile.append(`${file}.idx`, indexBuffer);
        }
        await NativeFile.append(file, serialized);
    }

    async getBacklog(conversation: Conversation): Promise<Conversation.Message[]> {
        const file = `${this.logDir}/${conversation.key}`;
        let count = 20;
        let messages = new Array<Conversation.Message>(count);
        let pos = await NativeFile.getSize(file);
        while(pos > 0 && count > 0) {
            const l = (await NativeFile.readFile(file, pos - 2, pos))!;
            const length = (l.charCodeAt(0) << 8 | l.charCodeAt(1));
            pos = pos - length - 2;
            messages[--count] = deserializeMessage((await NativeFile.readFile(file, pos, length))!).message;
        }
        if(count !== 0) messages = messages.slice(count);
        return messages;
    }

    async getLogs(key: string, date: Date): Promise<Conversation.Message[]> {
        const file = `${this.logDir}/${key}`;
        const messages: Conversation.Message[] = [];
        const day = date.getTime() / dayMs;
        const index = this.index[key];
        if(index === undefined) return [];
        let pos = index.index[date.getTime() / dayMs];
        if(pos === undefined) return [];
        const size = await NativeFile.getSize(file);
        while(pos < size) {
            const deserialized = deserializeMessage((await NativeFile.readFile(file, pos, 51000))!);
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
        for(const date in entry.index)
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
    const file = await NativeFile.readFile('!settings');
    if(file === undefined) return undefined;
    return <GeneralSettings>JSON.parse(file);
}

export async function setGeneralSettings(value: GeneralSettings): Promise<void> {
    return NativeFile.writeFile('!settings', JSON.stringify(value));
}

export class SettingsStore implements Settings.Store {
    async get<K extends keyof Settings.Keys>(key: K, character: string = core.connection.character): Promise<Settings.Keys[K] | undefined> {
        const file = await NativeFile.readFile(`${character}/${key}`);
        if(file === undefined) return undefined;
        return <Settings.Keys[K]>JSON.parse(file);
    }

    async set<K extends keyof Settings.Keys>(key: K, value: Settings.Keys[K]): Promise<void> {
        return NativeFile.writeFile(`${core.connection.character}/${key}`, JSON.stringify(value));
    }

    async getAvailableCharacters(): Promise<string[]> {
        return <string[]>JSON.parse(await NativeFile.listDirectories('/'));
    }
}