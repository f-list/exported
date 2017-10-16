//tslint:disable:no-floating-promises
import {queuedJoin} from '../fchat/channels';
import {decodeHTML} from '../fchat/common';
import {characterImage, ConversationSettings, EventMessage, Message, messageToString} from './common';
import core from './core';
import {Channel, Character, Connection, Conversation as Interfaces} from './interfaces';
import l from './localize';
import {CommandContext, isCommand, parse as parseCommand} from './slash_commands';
import MessageType = Interfaces.Message.Type;

function createMessage(this: void, type: MessageType, sender: Character, text: string, time?: Date): Message {
    if(type === MessageType.Message && text.match(/^\/me\b/) !== null) {
        type = MessageType.Action;
        text = text.substr(text.charAt(4) === ' ' ? 4 : 3);
    }
    return new Message(type, sender, text, time);
}

function safeAddMessage(this: void, messages: Interfaces.Message[], message: Interfaces.Message, max: number): void {
    if(messages.length >= max) messages.shift();
    messages.push(message);
}

abstract class Conversation implements Interfaces.Conversation {
    abstract enteredText: string;
    abstract readonly name: string;
    messages: Interfaces.Message[] = [];
    errorText = '';
    unread = Interfaces.UnreadState.None;
    lastRead: Interfaces.Message | undefined = undefined;
    infoText = '';
    abstract readonly maxMessageLength: number | undefined;
    _settings: Interfaces.Settings;
    protected abstract context: CommandContext;
    protected maxMessages = 100;
    protected allMessages: Interfaces.Message[];
    private lastSent = '';

    constructor(readonly key: string, public _isPinned: boolean) {
    }

    get settings(): Interfaces.Settings {
        //tslint:disable-next-line:strict-boolean-expressions
        return this._settings || (this._settings = state.settings[this.key] || new ConversationSettings());
    }

    set settings(value: Interfaces.Settings) {
        this._settings = value;
        state.setSettings(this.key, value);
    }

    get isPinned(): boolean {
        return this._isPinned;
    }

    set isPinned(value: boolean) {
        if(value === this._isPinned) return;
        this._isPinned = value;
        state.savePinned();
    }

    get reportMessages(): ReadonlyArray<Interfaces.Message> {
        return this.allMessages;
    }

    send(): void {
        if(this.enteredText.length === 0) return;
        if(isCommand(this.enteredText)) {
            const parsed = parseCommand(this.enteredText, this.context);
            if(typeof parsed === 'string') this.errorText = parsed;
            else {
                parsed.call(this);
                this.lastSent = this.enteredText;
                this.enteredText = '';
            }
        } else {
            this.lastSent = this.enteredText;
            this.doSend();
        }
    }

    abstract addMessage(message: Interfaces.Message): void;

    loadLastSent(): void {
        this.enteredText = this.lastSent;
    }

    loadMore(): void {
        if(this.messages.length >= this.allMessages.length) return;
        this.maxMessages += 100;
        this.messages = this.allMessages.slice(-this.maxMessages);
    }

    show(): void {
        state.show(this);
    }

    onHide(): void {
        this.errorText = '';
        this.lastRead = this.messages[this.messages.length - 1];
        this.maxMessages = 100;
        this.messages = this.allMessages.slice(-this.maxMessages);
    }

    abstract close(): void;

    protected safeAddMessage(message: Interfaces.Message): void {
        safeAddMessage(this.allMessages, message, 500);
        safeAddMessage(this.messages, message, this.maxMessages);
    }

    protected abstract doSend(): void;
}

class PrivateConversation extends Conversation implements Interfaces.PrivateConversation {
    readonly name = this.character.name;
    readonly context = CommandContext.Private;
    typingStatus: Interfaces.TypingStatus = 'clear';
    readonly maxMessageLength = core.connection.vars.priv_max;
    private _enteredText = '';
    private ownTypingStatus: Interfaces.TypingStatus = 'clear';
    private timer: number | undefined;
    private logPromise = core.logs.getBacklog(this).then((messages) => {
        this.allMessages.unshift(...messages);
        this.messages = this.allMessages.slice();
    });

    constructor(readonly character: Character) {
        super(character.name.toLowerCase(), state.pinned.private.indexOf(character.name) !== -1);
        this.lastRead = this.messages[this.messages.length - 1];
        this.allMessages = [];
    }

    get enteredText(): string {
        return this._enteredText;
    }

    set enteredText(value: string) {
        this._enteredText = value;
        if(this.timer !== undefined) clearTimeout(this.timer);
        if(value.length > 0) {
            if(this.ownTypingStatus !== 'typing') this.setOwnTyping('typing');
            this.timer = window.setTimeout(() => this.setOwnTyping('paused'), 5000);
        } else if(this.ownTypingStatus !== 'clear') this.setOwnTyping('clear');
    }

    addMessage(message: Interfaces.Message): void {
        this.safeAddMessage(message);
        if(message.type !== Interfaces.Message.Type.Event) {
            if(core.state.settings.logMessages) this.logPromise.then(() => core.logs.logMessage(this, message));
            if(this.settings.notify !== Interfaces.Setting.False)
                core.notifications.notify(this, message.sender.name, message.text, characterImage(message.sender.name), 'attention');
            if(this !== state.selectedConversation)
                this.unread = Interfaces.UnreadState.Mention;
            this.typingStatus = 'clear';
        }
    }

    close(): void {
        state.privateConversations.splice(state.privateConversations.indexOf(this), 1);
        delete state.privateMap[this.character.name.toLowerCase()];
        state.savePinned();
        if(state.selectedConversation === this) state.show(state.consoleTab);
    }

    sort(newIndex: number): void {
        state.privateConversations.splice(state.privateConversations.indexOf(this), 1);
        state.privateConversations.splice(newIndex, 0, this);
        state.savePinned();
    }

    protected doSend(): void {
        if(this.character.status === 'offline') {
            this.errorText = l('chat.errorOffline', this.character.name);
            return;
        } else if(this.character.isIgnored) {
            this.errorText = l('chat.errorIgnored', this.character.name);
            return;
        }
        core.connection.send('PRI', {recipient: this.name, message: this.enteredText});
        const message = createMessage(MessageType.Message, core.characters.ownCharacter, this.enteredText);
        this.safeAddMessage(message);
        if(core.state.settings.logMessages) this.logPromise.then(() => core.logs.logMessage(this, message));
        this.enteredText = '';
    }

    private setOwnTyping(status: Interfaces.TypingStatus): void {
        this.ownTypingStatus = status;
        core.connection.send('TPN', {character: this.name, status});
    }
}

class ChannelConversation extends Conversation implements Interfaces.ChannelConversation {
    readonly context = CommandContext.Channel;
    readonly name = this.channel.name;
    isSendingAds = this.channel.mode === 'ads';
    adCountdown = 0;
    private chat: Interfaces.Message[] = [];
    private ads: Interfaces.Message[] = [];
    private both: Interfaces.Message[] = [];
    private _mode: Channel.Mode;
    private adEnteredText = '';
    private chatEnteredText = '';
    private logPromise = core.logs.getBacklog(this).then((messages) => {
        this.both.unshift(...messages);
        this.chat.unshift(...this.both.filter((x) => x.type !== MessageType.Ad));
        this.ads.unshift(...this.both.filter((x) => x.type === MessageType.Ad));
        this.lastRead = this.messages[this.messages.length - 1];
        this.messages = this.allMessages.slice(-this.maxMessages);
    });

    constructor(readonly channel: Channel) {
        super(`#${channel.id.replace(/[^\w- ]/gi, '')}`, state.pinned.channels.indexOf(channel.id) !== -1);
        core.watch(function(): Channel.Mode | undefined {
            const c = this.channels.getChannel(channel.id);
            return c !== undefined ? c.mode : undefined;
        }, (value) => {
            if(value === undefined) return;
            this.mode = value;
            if(value !== 'both') this.isSendingAds = value === 'ads';
        });
        this.mode = this.channel.mode;
    }

    get maxMessageLength(): number {
        return core.connection.vars[this.isSendingAds ? 'lfrp_max' : 'chat_max'];
    }

    get mode(): Channel.Mode {
        return this._mode;
    }

    set mode(mode: Channel.Mode) {
        this._mode = mode;
        this.maxMessages = 100;
        this.allMessages = this[mode];
        this.messages = this.allMessages.slice(-this.maxMessages);
    }

    get enteredText(): string {
        return this.isSendingAds ? this.adEnteredText : this.chatEnteredText;
    }

    set enteredText(value: string) {
        if(this.isSendingAds) this.adEnteredText = value;
        else this.chatEnteredText = value;
    }

    get reportMessages(): ReadonlyArray<Interfaces.Message> {
        return this.both;
    }

    addModeMessage(mode: Channel.Mode, message: Interfaces.Message): void {
        if(this._mode === mode) this.safeAddMessage(message);
        else safeAddMessage(this[mode], message, 500);
    }

    addMessage(message: Interfaces.Message): void {
        if((message.type === MessageType.Message || message.type === MessageType.Ad) && message.text.match(/^\/warn\b/) !== null
            && (this.channel.members[message.sender.name]!.rank > Channel.Rank.Member || message.sender.isChatOp))
            message = new Message(MessageType.Warn, message.sender, message.text.substr(6), message.time);

        if(message.type === MessageType.Ad) {
            this.addModeMessage('ads', message);
            if(core.state.settings.logAds) this.logPromise.then(() => core.logs.logMessage(this, message));
        } else {
            this.addModeMessage('chat', message);
            if(message.type !== Interfaces.Message.Type.Event) {
                if(message.type === Interfaces.Message.Type.Warn) this.addModeMessage('ads', message);
                if(core.state.settings.logMessages) this.logPromise.then(() => core.logs.logMessage(this, message));
                if(this !== state.selectedConversation && this.unread === Interfaces.UnreadState.None)
                    this.unread = Interfaces.UnreadState.Unread;
            } else this.addModeMessage('ads', message);
        }
        this.addModeMessage('both', message);
    }

    close(): void {
        core.connection.send('LCH', {channel: this.channel.id});
    }

    sort(newIndex: number): void {
        state.channelConversations.splice(state.channelConversations.indexOf(this), 1);
        state.channelConversations.splice(newIndex, 0, this);
        state.savePinned();
    }

    protected doSend(): void {
        const isAd = this.isSendingAds;
        core.connection.send(isAd ? 'LRP' : 'MSG', {channel: this.channel.id, message: this.enteredText});
        this.addMessage(
            createMessage(isAd ? MessageType.Ad : MessageType.Message, core.characters.ownCharacter, this.enteredText, new Date()));
        if(isAd) {
            this.adCountdown = core.connection.vars.lfrp_flood;
            const interval = setInterval(() => {
                this.adCountdown -= 1;
                if(this.adCountdown === 0) clearInterval(interval);
            }, 1000);
        } else this.enteredText = '';
    }
}

class ConsoleConversation extends Conversation {
    readonly context = CommandContext.Console;
    readonly name = l('chat.consoleTab');
    readonly maxMessageLength = undefined;
    enteredText = '';

    constructor() {
        super('_', false);
        this.allMessages = [];
    }

    //tslint:disable-next-line:no-empty
    close(): void {
    }

    addMessage(message: Interfaces.Message): void {
        this.safeAddMessage(message);
        if(core.state.settings.logMessages) core.logs.logMessage(this, message);
        if(this !== state.selectedConversation) this.unread = Interfaces.UnreadState.Unread;
    }

    protected doSend(): void {
        this.errorText = l('chat.consoleChat');
    }
}

class State implements Interfaces.State {
    privateConversations: PrivateConversation[] = [];
    channelConversations: ChannelConversation[] = [];
    privateMap: {[key: string]: PrivateConversation | undefined} = {};
    channelMap: {[key: string]: ChannelConversation | undefined} = {};
    consoleTab: ConsoleConversation;
    selectedConversation: Conversation = this.consoleTab;
    recent: Interfaces.RecentConversation[] = [];
    pinned: {channels: string[], private: string[]};
    settings: {[key: string]: Interfaces.Settings};

    getPrivate(character: Character): PrivateConversation {
        const key = character.name.toLowerCase();
        let conv = state.privateMap[key];
        if(conv !== undefined) return conv;
        conv = new PrivateConversation(character);
        this.privateConversations.push(conv);
        this.privateMap[key] = conv;
        state.addRecent(conv);
        return conv;
    }

    byKey(key: string): Conversation | undefined {
        if(key === '_') return this.consoleTab;
        return (key[0] === '#' ? this.channelMap : this.privateMap)[key];
    }

    savePinned(): void {
        this.pinned.channels = this.channelConversations.filter((x) => x.isPinned).map((x) => x.channel.id);
        this.pinned.private = this.privateConversations.filter((x) => x.isPinned).map((x) => x.name);
        core.settingsStore.set('pinned', this.pinned);
    }

    setSettings(key: string, value: Interfaces.Settings): void {
        this.settings[key] = value;
        core.settingsStore.set('conversationSettings', this.settings);
    }

    addRecent(conversation: Conversation): void {
        /*tslint:disable-next-line:no-any*///TS isn't smart enough for this
        const remove = (predicate: (item: any) => boolean) => {
            for(let i = 0; i < this.recent.length; ++i)
                if(predicate(this.recent[i])) {
                    this.recent.splice(i, 1);
                    break;
                }
        };
        if(Interfaces.isChannel(conversation)) {
            remove((c) => c.channel === conversation.channel.id);
            this.recent.unshift({channel: conversation.channel.id, name: conversation.channel.name});
        } else {
            remove((c) => c.character === conversation.name);
            state.recent.unshift({character: conversation.name});
        }
        if(this.recent.length >= 50) this.recent.pop();
        core.settingsStore.set('recent', this.recent);
    }

    show(conversation: Conversation): void {
        this.selectedConversation.onHide();
        conversation.unread = Interfaces.UnreadState.None;
        this.selectedConversation = conversation;
    }

    async reloadSettings(): Promise<void> {
        //tslint:disable:strict-boolean-expressions
        this.pinned = await core.settingsStore.get('pinned') || {private: [], channels: []};
        for(const conversation of this.channelConversations)
            conversation._isPinned = this.pinned.channels.indexOf(conversation.channel.id) !== -1;
        for(const conversation of this.privateConversations)
            conversation._isPinned = this.pinned.private.indexOf(conversation.name) !== -1;
        this.recent = await core.settingsStore.get('recent') || [];
        const settings = <{[key: string]: ConversationSettings}> await core.settingsStore.get('conversationSettings') || {};
        //tslint:disable-next-line:forin
        for(const key in settings) {
            const settingsItem = new ConversationSettings();
            for(const itemKey in settings[key])
                settingsItem[<keyof ConversationSettings>itemKey] = settings[key][<keyof ConversationSettings>itemKey];
            settings[key] = settingsItem;
            const conv = (key[0] === '#' ? this.channelMap : this.privateMap)[key];
            if(conv !== undefined) conv._settings = settingsItem;
        }
        this.settings = settings;
        //tslint:enable
    }
}

let state: State;

function addEventMessage(this: void, message: Interfaces.Message): void {
    state.consoleTab.addMessage(message);
    if(core.state.settings.eventMessages && state.selectedConversation !== state.consoleTab) state.selectedConversation.addMessage(message);
}

function isOfInterest(this: void, character: Character): boolean {
    return character.isFriend || character.isBookmarked || state.privateMap[character.name.toLowerCase()] !== undefined;
}

export default function(this: void): Interfaces.State {
    state = new State();
    const connection = core.connection;
    connection.onEvent('connecting', async(isReconnect) => {
        state.channelConversations = [];
        state.channelMap = {};
        if(!isReconnect) state.consoleTab = new ConsoleConversation();
        state.selectedConversation = state.consoleTab;
        await state.reloadSettings();
    });
    connection.onEvent('connected', (isReconnect) => {
        if(isReconnect) return;
        for(const item of state.pinned.private) state.getPrivate(core.characters.get(item));
        queuedJoin(state.pinned.channels.slice());
    });
    core.channels.onEvent((type, channel) => {
        const key = channel.id.toLowerCase();
        if(type === 'join') {
            const conv = new ChannelConversation(channel);
            state.channelMap[key] = conv;
            state.channelConversations.push(conv);
            state.addRecent(conv);
        } else {
            const conv = state.channelMap[key]!;
            state.channelConversations.splice(state.channelConversations.indexOf(conv), 1);
            delete state.channelMap[key];
            state.savePinned();
            if(state.selectedConversation === conv) state.show(state.consoleTab);
        }
    });

    connection.onMessage('PRI', (data, time) => {
        const char = core.characters.get(data.character);
        if(char.isIgnored) return connection.send('IGN', {action: 'notify', character: data.character});
        const message = createMessage(MessageType.Message, char, decodeHTML(data.message), time);
        const conv = state.getPrivate(char);
        conv.addMessage(message);
    });
    connection.onMessage('MSG', (data, time) => {
        const char = core.characters.get(data.character);
        if(char.isIgnored) return;
        const conversation = state.channelMap[data.channel.toLowerCase()]!;
        const message = createMessage(MessageType.Message, char, decodeHTML(data.message), time);
        conversation.addMessage(message);

        let words: string[];
        if(conversation.settings.highlight !== Interfaces.Setting.Default) {
            words = conversation.settings.highlightWords.slice();
            if(conversation.settings.highlight === Interfaces.Setting.True) words.push(core.connection.character);
        } else {
            words = core.state.settings.highlightWords.slice();
            if(core.state.settings.highlight) words.push(core.connection.character);
        }
        //tslint:disable-next-line:no-null-keyword
        const results = words.length > 0 ? message.text.match(new RegExp(`\\b(${words.join('|')})\\b`, 'i')) : null;
        if(results !== null) {
            core.notifications.notify(conversation, data.character, l('chat.highlight', results[0], conversation.name, message.text),
                characterImage(data.character), 'attention');
            if(conversation !== state.selectedConversation) conversation.unread = Interfaces.UnreadState.Mention;
            message.isHighlight = true;
        } else if(conversation.settings.notify === Interfaces.Setting.True)
            core.notifications.notify(conversation, conversation.name, messageToString(message),
                characterImage(data.character), 'attention');
    });
    connection.onMessage('LRP', (data, time) => {
        const char = core.characters.get(data.character);
        if(char.isIgnored) return;
        const conv = state.channelMap[data.channel.toLowerCase()]!;
        conv.addMessage(new Message(MessageType.Ad, char, decodeHTML(data.message), time));
    });
    connection.onMessage('RLL', (data, time) => {
        const sender = core.characters.get(data.character);
        if(sender.isIgnored) return;
        let text: string;
        if(data.type === 'bottle')
            text = l('chat.bottle', `[user]${data.target}[/user]`);
        else {
            const results = data.results.length > 1 ? `${data.results.join('+')} = ${data.endresult}` : data.endresult.toString();
            text = l('chat.roll', data.rolls.join('+'), results);
        }
        const message = new Message(MessageType.Roll, sender, text, time);
        if('channel' in data) {
            const conversation = state.channelMap[(<{channel: string}>data).channel.toLowerCase()]!;
            conversation.addMessage(message);
            if(data.type === 'bottle' && data.target === core.connection.character)
                core.notifications.notify(conversation, conversation.name, messageToString(message),
                    characterImage(data.character), 'attention');
        } else {
            const char = core.characters.get(
                data.character === connection.character ? (<{recipient: string}>data).recipient : data.character);
            if(char.isIgnored) return connection.send('IGN', {action: 'notify', character: data.character});
            const conversation = state.getPrivate(char);
            conversation.addMessage(message);
        }
    });
    connection.onMessage('NLN', (data, time) => {
        const message = new EventMessage(l('events.login', `[user]${data.identity}[/user]`), time);
        if(isOfInterest(core.characters.get(data.identity))) addEventMessage(message);
        const conv = state.privateMap[data.identity.toLowerCase()];
        if(conv !== undefined && core.state.settings.eventMessages && conv !== state.selectedConversation) conv.addMessage(message);
    });
    connection.onMessage('FLN', (data, time) => {
        const message = new EventMessage(l('events.logout', `[user]${data.character}[/user]`), time);
        if(isOfInterest(core.characters.get(data.character))) addEventMessage(message);
        const conv = state.privateMap[data.character.toLowerCase()];
        if(conv === undefined) return;
        conv.typingStatus = 'clear';
        if(core.state.settings.eventMessages && conv !== state.selectedConversation) conv.addMessage(message);
    });
    connection.onMessage('TPN', (data) => {
        const conv = state.privateMap[data.character.toLowerCase()];
        if(conv !== undefined) conv.typingStatus = data.status;
    });
    connection.onMessage('CBU', (data, time) => {
        const text = l('events.ban', data.channel, data.character, data.operator);
        state.channelMap[data.channel.toLowerCase()]!.infoText = text;
        addEventMessage(new EventMessage(text, time));
    });
    connection.onMessage('CKU', (data, time) => {
        const text = l('events.kick', data.channel, data.character, data.operator);
        state.channelMap[data.channel.toLowerCase()]!.infoText = text;
        addEventMessage(new EventMessage(text, time));
    });
    connection.onMessage('CTU', (data, time) => {
        const text = l('events.timeout', data.channel, data.character, data.operator, data.length.toString());
        state.channelMap[data.channel.toLowerCase()]!.infoText = text;
        addEventMessage(new EventMessage(text, time));
    });
    connection.onMessage('HLO', (data, time) => addEventMessage(new EventMessage(data.message, time)));
    connection.onMessage('BRO', (data, time) => {
        const text = data.character === undefined ? decodeHTML(data.message) :
            l('events.broadcast', `[user]${data.character}[/user]`, decodeHTML(data.message.substr(data.character.length + 23)));
        addEventMessage(new EventMessage(text, time));
    });
    connection.onMessage('CIU', (data, time) => {
        const text = l('events.invite', `[user]${data.sender}[/user]`, `[session=${data.title}]${data.name}[/session]`);
        addEventMessage(new EventMessage(text, time));
    });
    connection.onMessage('ERR', (data, time) => {
        state.selectedConversation.errorText = data.message;
        addEventMessage(new EventMessage(`[color=red]${l('events.error', data.message)}[/color]`, time));
    });
    connection.onMessage('RTB', (data, time) => {
        let url = 'https://www.f-list.net/';
        let text: string, character: string;
        if(data.type === 'comment') { //tslint:disable-line:prefer-switch
            switch(data.target_type) {
                case 'newspost':
                    url += `newspost/${data.target_id}/#Comment${data.id}`;
                    break;
                case 'bugreport':
                    url += `view_bugreport.php?id=/${data.target_id}/#${data.id}`;
                    break;
                case 'changelog':
                    url += `log.php?id=/${data.target_id}/#${data.id}`;
                    break;
                case 'feature':
                    url += `vote.php?id=/${data.target_id}/#${data.id}`;
            }
            const key = `events.rtbComment${(data.parent_id !== 0 ? 'Reply' : '')}`;
            text = l(key, `[user]${data.name}[/user]`, l(`events.rtbComment_${data.target_type}`), `[url=${url}]${data.target}[/url]`);
            character = data.name;
        } else if(data.type === 'note') {
            text = l('events.rtb_note', `[user]${data.sender}[/user]`, `[url=${url}view_note.php?note_id=${data.id}]${data.subject}[/url]`);
            character = data.sender;
        } else if(data.type === 'friendrequest') {
            text = l(`events.rtb_friendrequest`, `[user]${data.name}[/user]`);
            character = data.name;
        } else {
            switch(data.type) {
                case 'grouprequest':
                    url += 'panel/group_requests.php';
                    break;
                case 'bugreport':
                    url += `view_bugreport.php?id=${data.id}`;
                    break;
                case 'helpdeskticket':
                    url += `view_ticket.php?id=${data.id}`;
                    break;
                case 'helpdeskreply':
                    url += `view_ticket.php?id=${data.id}`;
                    break;
                case 'featurerequest':
                    url += `vote.php?fid=${data.id}`;
                    break;
                default: //TODO
                    return;
            }
            text = l(`events.rtb_${data.type}`, `[user]${data.name}[/user]`,
                data.title !== undefined ? `[url=${url}]${data.title}[/url]` : url);
            character = data.name;
        }
        addEventMessage(new EventMessage(text, time));
        if(data.type === 'note')
            core.notifications.notify(state.consoleTab, character, text, characterImage(character), 'newnote');
    });
    type SFCMessage = (Interfaces.Message & {sfc: Connection.ServerCommands['SFC'] & {confirmed?: true}});
    const sfcList: SFCMessage[] = [];
    connection.onMessage('SFC', (data, time) => {
        let text: string, message: Interfaces.Message;
        if(data.action === 'report') {
            text = l('events.report', `[user]${data.character}[/user]`, decodeHTML(data.tab), decodeHTML(data.report));
            core.notifications.notify(state.consoleTab, data.character, text, characterImage(data.character), 'modalert');
            message = new EventMessage(text, time);
            safeAddMessage(sfcList, message, 500);
            (<SFCMessage>message).sfc = data;
        } else {
            text = l('events.report.confirmed', `[user]${data.moderator}[/user]`, `[user]${data.character}[/user]`);
            for(const item of sfcList)
                if(item.sfc.logid === data.logid) {
                    item.sfc.confirmed = true;
                    break;
                }
            message = new EventMessage(text, time);
        }
        addEventMessage(message);
    });
    connection.onMessage('STA', (data, time) => {
        if(data.character === core.connection.character) {
            addEventMessage(new EventMessage(l(data.statusmsg.length > 0 ? 'events.status.ownMessage' : 'events.status.own',
                l(`status.${data.status}`), decodeHTML(data.statusmsg)), time));
            return;
        }
        const char = core.characters.get(data.character);
        if(!isOfInterest(char)) return;
        const status = l(`status.${data.status}`);
        const key = data.statusmsg.length > 0 ? 'events.status.message' : 'events.status';
        const message = new EventMessage(l(key, `[user]${data.character}[/user]`, status, decodeHTML(data.statusmsg)), time);
        addEventMessage(message);
        const conv = state.privateMap[data.character.toLowerCase()];
        if(conv !== undefined && core.state.settings.eventMessages && conv !== state.selectedConversation) conv.addMessage(message);
    });
    connection.onMessage('SYS', (data, time) => {
        state.selectedConversation.infoText = data.message;
        addEventMessage(new EventMessage(data.message, time));
    });
    connection.onMessage('JCH', (data, time) => {
        if(data.character.identity === core.connection.character) return;
        const conv = state.channelMap[data.channel.toLowerCase()]!;
        if(conv.settings.joinMessages === Interfaces.Setting.False || conv.settings.joinMessages === Interfaces.Setting.Default &&
            !core.state.settings.joinMessages) return;
        const text = l('events.channelJoin', `[user]${data.character.identity}[/user]`);
        conv.addMessage(new EventMessage(text, time));
    });
    connection.onMessage('LCH', (data, time) => {
        if(data.character === core.connection.character) return;
        const conv = state.channelMap[data.channel.toLowerCase()]!;
        if(conv.settings.joinMessages === Interfaces.Setting.False || conv.settings.joinMessages === Interfaces.Setting.Default &&
            !core.state.settings.joinMessages) return;
        const text = l('events.channelLeave', `[user]${data.character}[/user]`);
        conv.addMessage(new EventMessage(text, time));
    });
    connection.onMessage('ZZZ', (data, time) => {
        state.selectedConversation.infoText = data.message;
        addEventMessage(new EventMessage(data.message, time));
    });
    //TODO connection.onMessage('UPT', data =>
    return state;
}