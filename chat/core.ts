import Vue, {WatchHandler} from 'vue';
import BBCodeParser from './bbcode';
import {Settings as SettingsImpl} from './common';
import {Channel, Character, Connection, Conversation, Logs, Notifications, Settings, State as StateInterface} from './interfaces';

function createBBCodeParser(): BBCodeParser {
    const parser = new BBCodeParser();
    for(const tag of state.settings.disallowedTags)
        parser.removeTag(tag);
    return parser;
}

class State implements StateInterface {
    _settings: Settings | undefined = undefined;

    get settings(): Settings {
        if(this._settings === undefined) throw new Error('Settings load failed.');
        return this._settings;
    }

    set settings(value: Settings) {
        this._settings = value;
        //tslint:disable-next-line:no-floating-promises
        if(data.settingsStore !== undefined) data.settingsStore.set('settings', value);
        data.bbCodeParser = createBBCodeParser();
    }
}

interface VueState {
    readonly channels: Channel.State
    readonly characters: Character.State
    readonly conversations: Conversation.State
    readonly state: StateInterface
}

const state = new State();

const vue = <Vue & VueState>new Vue({
    data: {
        channels: undefined,
        characters: undefined,
        conversations: undefined,
        state
    }
});

const data = {
    connection: <Connection | undefined>undefined,
    logs: <Logs.Basic | undefined>undefined,
    settingsStore: <Settings.Store | undefined>undefined,
    state: vue.state,
    bbCodeParser: <BBCodeParser | undefined>undefined,
    conversations: <Conversation.State | undefined>undefined,
    channels: <Channel.State | undefined>undefined,
    characters: <Character.State | undefined>undefined,
    notifications: <Notifications | undefined>undefined,
    register(this: void | never, module: 'characters' | 'conversations' | 'channels',
             subState: Channel.State | Character.State | Conversation.State): void {
        Vue.set(vue, module, subState);
        data[module] = subState;
    },
    watch<T>(getter: (this: VueState) => T, callback: WatchHandler<T>): void {
        vue.$watch(getter, callback);
    },
    async reloadSettings(): Promise<void> {
        const settings = new SettingsImpl();
        const loadedSettings = <SettingsImpl | undefined>await core.settingsStore.get('settings');
        if(loadedSettings !== undefined)
            for(const key in loadedSettings) settings[<keyof Settings>key] = loadedSettings[<keyof Settings>key];
        state._settings = settings;
    }
};

export function init(this: void, connection: Connection, logsClass: new() => Logs.Basic, settingsClass: new() => Settings.Store,
                     notificationsClass: new() => Notifications): void {
    data.connection = connection;
    data.logs = new logsClass();
    data.settingsStore = new settingsClass();
    data.notifications = new notificationsClass();
    connection.onEvent('connecting', async() => {
        await data.reloadSettings();
        data.bbCodeParser = createBBCodeParser();
    });
}

const core = <{
    readonly connection: Connection
    readonly logs: Logs.Basic
    readonly state: StateInterface
    readonly settingsStore: Settings.Store
    readonly conversations: Conversation.State
    readonly characters: Character.State
    readonly channels: Channel.State
    readonly bbCodeParser: BBCodeParser
    readonly notifications: Notifications
    register(module: 'conversations', state: Conversation.State): void
    register(module: 'channels', state: Channel.State): void
    register(module: 'characters', state: Character.State): void
    reloadSettings(): void
    watch<T>(getter: (this: VueState) => T, callback: WatchHandler<T>): void
}><any>data; /*tslint:disable-line:no-any*///hack

export default core;