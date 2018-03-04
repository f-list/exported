import {format, isToday} from 'date-fns';
import {Keys} from '../keys';
import {Character, Conversation, Settings as ISettings} from './interfaces';

export function profileLink(this: void | never, character: string): string {
    return `https://www.f-list.net/c/${character}`;
}

export function characterImage(this: void | never, character: string): string {
    return `https://static.f-list.net/images/avatar/${character.toLowerCase()}.png`;
}

export function getByteLength(this: void | never, str: string): number {
    let byteLen = 0;
    for(let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        byteLen += c < (1 << 7) ? 1 :
            c < (1 << 11) ? 2 :
                c < (1 << 16) ? 3 :
                    c < (1 << 21) ? 4 :
                        c < (1 << 26) ? 5 :
                            c < (1 << 31) ? 6 : Number.NaN;
    }
    return byteLen;
}

export class Settings implements ISettings {
    playSound = true;
    clickOpensMessage = false;
    disallowedTags: string[] = [];
    notifications = true;
    highlight = true;
    highlightWords: string[] = [];
    showAvatars = true;
    animatedEicons = true;
    idleTimer = 0;
    messageSeparators = false;
    eventMessages = true;
    joinMessages = false;
    alwaysNotify = false;
    logMessages = true;
    logAds = false;
    fontSize = 14;
    showNeedsReply = false;
}

export class ConversationSettings implements Conversation.Settings {
    notify = Conversation.Setting.Default;
    highlight = Conversation.Setting.Default;
    highlightWords: string[] = [];
    joinMessages = Conversation.Setting.Default;
    defaultHighlights = true;
}

export function formatTime(this: void | never, date: Date): string {
    if(isToday(date)) return format(date, 'HH:mm');
    return format(date, 'YYYY-MM-DD HH:mm');
}

export function messageToString(this: void | never, msg: Conversation.Message, timeFormatter: (date: Date) => string = formatTime): string {
    let text = `[${timeFormatter(msg.time)}] `;
    if(msg.type !== Conversation.Message.Type.Event)
        text += (msg.type === Conversation.Message.Type.Action ? '*' : '') + msg.sender.name +
            (msg.type === Conversation.Message.Type.Message ? ':' : '');
    return `${text} ${msg.text}\r\n`;
}

export function getKey(e: KeyboardEvent): Keys {
    return e.keyCode;
}

/*tslint:disable:no-any no-unsafe-any*///because errors can be any
export function errorToString(e: any): string {
    return e instanceof Error ? e.message : e !== undefined ? e.toString() : '';
}
//tslint:enable

let messageId = 0;

export class Message implements Conversation.ChatMessage {
    readonly id = ++messageId;
    isHighlight = false;

    constructor(readonly type: Conversation.Message.Type, readonly sender: Character, readonly text: string,
                readonly time: Date = new Date()) {
        if(Conversation.Message.Type[type] === undefined) throw new Error('Unknown type'); /*tslint:disable-line*/ //TODO debug code
    }
}

export class EventMessage implements Conversation.EventMessage {
    readonly id = ++messageId;
    readonly type = Conversation.Message.Type.Event;

    constructor(readonly text: string, readonly time: Date = new Date()) {
    }
}