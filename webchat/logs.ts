import {EventMessage, Message} from '../chat/common';
import core from '../chat/core';
import {Conversation, Logs as Logging, Settings} from '../chat/interfaces';

type StoredConversation = {id: number, key: string, name: string};
type StoredMessage = {
    id: number, conversation: number, type: Conversation.Message.Type, sender: string, text: string, time: Date, day: number
};

async function promisifyRequest<T>(req: IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        req.onsuccess = () => resolve(<T>req.result);
        req.onerror = reject;
    });
}

async function promisifyTransaction(req: IDBTransaction): Promise<Event> {
    return new Promise<Event>((resolve, reject) => {
        req.oncomplete = resolve;
        req.onerror = reject;
    });
}

async function iterate<S, T>(request: IDBRequest, map: (stored: S) => T): Promise<ReadonlyArray<T>> {
    const array: T[] = [];
    return new Promise<ReadonlyArray<T>>((resolve, reject) => {
        request.onsuccess = function(): void {
            const c = <IDBCursorWithValue | undefined>this.result;
            if(!c) return resolve(array); //tslint:disable-line:strict-boolean-expressions
            array.push(map(<S>c.value));
            c.continue();
        };
        request.onerror = reject;
    });
}

const dayMs = 86400000;

export class Logs implements Logging {
    index!: {[key: string]: StoredConversation | undefined};
    db!: IDBDatabase;

    constructor() {
        core.connection.onEvent('connecting', async() => {
            const request = window.indexedDB.open('logs');
            request.onupgradeneeded = () => {
                const db = <IDBDatabase>request.result;
                const logsStore = db.createObjectStore('logs', {keyPath: 'id', autoIncrement: true});
                logsStore.createIndex('conversation', 'conversation');
                logsStore.createIndex('conversation-day', ['conversation', 'day']);
                db.createObjectStore('conversations', {keyPath: 'id', autoIncrement: true});
            };
            this.db = await promisifyRequest<IDBDatabase>(request);
            const trans = this.db.transaction(['conversations']);
            this.index = {};
            await iterate(trans.objectStore('conversations').openCursor(), (x: StoredConversation) => this.index[x.key] = x);
        });
    }

    async logMessage(conversation: Conversation, message: Conversation.Message): Promise<void> {
        const trans = this.db.transaction(['logs', 'conversations'], 'readwrite');
        let conv = this.index[conversation.key];
        if(conv === undefined) {
            const convId = await promisifyRequest<number>(trans.objectStore('conversations').add(
                {key: conversation.key, name: conversation.name}));
            this.index[conversation.key] = conv = {id: convId, key: conversation.key, name: conversation.name};
        }
        const sender = message.type === Conversation.Message.Type.Event ? undefined : message.sender.name;
        const day = Math.floor(message.time.getTime() / dayMs - message.time.getTimezoneOffset() / 1440);
        await promisifyRequest<number>(trans.objectStore('logs').put(
            {conversation: conv.id, type: message.type, sender, text: message.text, date: message.time, day}));
        await promisifyTransaction(trans);
    }

    async getBacklog(conversation: Conversation): Promise<ReadonlyArray<Conversation.Message>> {
        const trans = this.db.transaction(['logs', 'conversations']);
        const conv = this.index[conversation.key];
        if(conv === undefined) return [];
        return iterate(trans.objectStore('logs').index('conversation').openCursor(conv.id, 'prev'),
            (value: StoredMessage) => value.type === Conversation.Message.Type.Event ? new EventMessage(value.text, value.time) :
                new Message(value.type, core.characters.get(value.sender), value.text, value.time));
    }

    get conversations(): ReadonlyArray<{key: string, name: string}> {
        return Object.keys(this.index).map((k) => this.index[k]!);
    }

    async getLogs(key: string, date: Date): Promise<ReadonlyArray<Conversation.Message>> {
        const trans = this.db.transaction(['logs']);
        const id = this.index[key]!.id;
        const day = Math.floor(date.getTime() / dayMs - date.getTimezoneOffset() / 1440);
        return iterate(trans.objectStore('logs').index('conversation-day').openCursor([id, day]),
            (value: StoredMessage) => value.type === Conversation.Message.Type.Event ? new EventMessage(value.text, value.time) :
                new Message(value.type, core.characters.get(value.sender), value.text, value.time));
    }

    async getLogDates(key: string): Promise<ReadonlyArray<Date>> {
        const trans = this.db.transaction(['logs']);
        const offset = new Date().getTimezoneOffset() * 1440;
        const id = this.index[key]!.id;
        const bound = IDBKeyRange.bound([id, 0], [id, 100000]);
        return iterate(trans.objectStore('logs').index('conversation-day').openCursor(bound, 'nextunique'),
            (value: StoredMessage) => new Date(value.day * dayMs + offset));
    }
}

export class SettingsStore implements Settings.Store {
    async get<K extends keyof Settings.Keys>(key: K): Promise<Settings.Keys[K]> {
        const stored = window.localStorage.getItem(`settings.${key}`);
        return Promise.resolve(stored !== null ? JSON.parse(stored) : undefined);
    }

    async set<K extends keyof Settings.Keys>(key: K, value: Settings.Keys[K]): Promise<void> {
        window.localStorage.setItem(`settings.${key}`, JSON.stringify(value));
        return Promise.resolve();
    }

    async getAvailableCharacters(): Promise<ReadonlyArray<string>> {
        return Promise.resolve([]);
    }
}