import {Conversation, Logs as Logging, Settings} from './interfaces';
import core from './core';
import {Message} from './common';

export class Logs implements Logging.Basic {
    logMessage(conversation: Conversation, message: Conversation.Message) {
        const key = 'logs.' + conversation.key;
        const previous = window.localStorage.getItem(key);
        const serialized = this.serialize(message);
        let data = previous ? previous + serialized : serialized;
        while(data.length > 100000) {
            data = data.substr(this.deserialize(data, 0).index);
        }
        window.localStorage.setItem(key, data);
    }

    getBacklog(conversation: Conversation) {
        let messages: Conversation.Message[] = [];
        const str = window.localStorage.getItem('logs.' + conversation.key);
        if(!str) return Promise.resolve(messages);
        let index = str.length;
        while(true) {
            index -= (str.charCodeAt(index - 2) << 8 | str.charCodeAt(index - 1)) + 2;
            messages.unshift(this.deserialize(str, index).message);
            if(index == 0) break;
        }
        return Promise.resolve(messages);
    }

    private serialize(message: Conversation.Message) {
        const time = message.time.getTime() / 1000;
        let str = String.fromCharCode(time >> 24) + String.fromCharCode(time >> 16) + String.fromCharCode(time >> 8) + String.fromCharCode(time % 256);
        str += String.fromCharCode(message.type);
        if(message.type !== Conversation.Message.Type.Event) {
            str += String.fromCharCode(message.sender.name.length);
            str += message.sender.name;
        } else str += '\0';
        const textLength = message.text.length;
        str += String.fromCharCode(textLength >> 8) + String.fromCharCode(textLength % 256);
        str += message.text;
        const length = str.length;
        str += String.fromCharCode(length >> 8) + String.fromCharCode(length % 256);
        return str;
    }

    private deserialize(str: string, index: number): {message: Conversation.Message, index: number} {
        const time = str.charCodeAt(index++) << 24 | str.charCodeAt(index++) << 16 | str.charCodeAt(index++) << 8 | str.charCodeAt(index++);
        const type = str.charCodeAt(index++);
        const senderLength = str.charCodeAt(index++);
        const sender = str.substring(index, index += senderLength);
        const messageLength = str.charCodeAt(index++) << 8 | str.charCodeAt(index++);
        const message = str.substring(index, index += messageLength);
        return {
            message: new Message(type, core.characters.get(sender), message, new Date(time * 1000)),
            index: index
        };
    }
}

export class SettingsStore implements Settings.Store {
    get<K extends keyof Settings.Keys>(key: K) {
        const stored = window.localStorage.getItem('settings.' + key);
        return Promise.resolve(stored && JSON.parse(stored));
    }

    set<K extends keyof Settings.Keys>(key: K, value: Settings.Keys[K]) {
        window.localStorage.setItem('settings.' + key, JSON.stringify(value));
        return Promise.resolve();
    }

    getAvailableCharacters() {
        return undefined;
    }
}