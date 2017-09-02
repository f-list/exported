import {decodeHTML} from './common';
import {Character as Interfaces, Connection} from './interfaces';

class Character implements Interfaces.Character {
    gender: Interfaces.Gender;
    status: Interfaces.Status = 'offline';
    statusText = '';
    isFriend = false;
    isBookmarked = false;
    isChatOp = false;
    isIgnored = false;

    constructor(readonly name: string) {
    }
}

class State implements Interfaces.State {
    characters: {[key: string]: Character | undefined} = {};
    ownCharacter: Character = <any>undefined; /*tslint:disable-line:no-any*///hack
    friends: Character[] = [];
    bookmarks: Character[] = [];
    ignoreList: string[] = [];
    opList: string[] = [];
    friendList: string[] = [];
    bookmarkList: string[] = [];

    get(name: string): Character {
        const key = name.toLowerCase();
        let char = this.characters[key];
        if(char === undefined) {
            char = new Character(name);
            char.isFriend = this.friendList.indexOf(name) !== -1;
            char.isBookmarked = this.bookmarkList.indexOf(name) !== -1;
            char.isChatOp = this.opList.indexOf(name) !== -1;
            char.isIgnored = this.ignoreList.indexOf(key) !== -1;
            this.characters[key] = char;
        }
        return char;
    }

    setStatus(character: Character, status: Interfaces.Status, text: string): void {
        if(character.status === 'offline' && status !== 'offline') {
            if(character.isFriend) this.friends.push(character);
            if(character.isBookmarked) this.bookmarks.push(character);
        } else if(status === 'offline' && character.status !== 'offline') {
            if(character.isFriend) this.friends.splice(this.friends.indexOf(character), 1);
            if(character.isBookmarked) this.bookmarks.splice(this.bookmarks.indexOf(character), 1);
        }
        character.status = status;
        character.statusText = decodeHTML(text);
    }
}

let state: State;

export default function(this: void, connection: Connection): Interfaces.State {
    state = new State();
    let reconnectStatus: Connection.ClientCommands['STA'];
    connection.onEvent('connecting', async(isReconnect) => {
        state.friends = [];
        state.bookmarks = [];
        state.bookmarkList = (<{characters: string[]}>await connection.queryApi('bookmark-list.php')).characters;
        state.friendList = ((<{friends: {source: string, dest: string, last_online: number}[]}>await connection.queryApi('friend-list.php'))
            .friends).map((x) => x.dest);
        //tslint:disable-next-line:forin
        for(const key in state.characters) {
            const character = state.characters[key]!;
            character.isFriend = state.friendList.indexOf(character.name) !== -1;
            character.isBookmarked = state.bookmarkList.indexOf(character.name) !== -1;
            character.status = 'offline';
            character.statusText = '';
        }
        if(isReconnect && (<Character | undefined>state.ownCharacter) !== undefined)
            reconnectStatus = {status: state.ownCharacter.status, statusmsg: state.ownCharacter.statusText};
    });
    connection.onEvent('connected', async(isReconnect) => {
        if(!isReconnect) return;
        connection.send('STA', reconnectStatus);
        //tslint:disable-next-line:forin
        for(const key in state.characters) {
            const char = state.characters[key]!;
            char.isIgnored = state.ignoreList.indexOf(key) !== -1;
            char.isChatOp = state.opList.indexOf(char.name) !== -1;
        }
    });
    connection.onMessage('IGN', (data) => {
        switch(data.action) {
            case 'init':
                state.ignoreList = data.characters.slice();
                break;
            case 'add':
                state.ignoreList.push(data.character.toLowerCase());
                state.get(data.character).isIgnored = true;
                break;
            case 'delete':
                state.ignoreList.splice(state.ignoreList.indexOf(data.character.toLowerCase()), 1);
                state.get(data.character).isIgnored = false;
        }
    });
    connection.onMessage('ADL', (data) => state.opList = data.ops.slice());
    connection.onMessage('LIS', (data) => {
        for(const char of data.characters) {
            const character = state.get(char[0]);
            character.gender = char[1];
            state.setStatus(character, char[2], char[3]);
        }
    });
    connection.onMessage('FLN', (data) => {
        state.setStatus(state.get(data.character), 'offline', '');
    });
    connection.onMessage('NLN', (data) => {
        const character = state.get(data.identity);
        if(data.identity === connection.character) state.ownCharacter = character;
        character.gender = data.gender;
        state.setStatus(character, data.status, '');
    });
    connection.onMessage('STA', (data) => {
        state.setStatus(state.get(data.character), data.status, data.statusmsg);
    });
    connection.onMessage('AOP', (data) => {
        state.opList.push(data.character);
        const char = state.get(data.character);
        char.isChatOp = true;
    });
    connection.onMessage('DOP', (data) => {
        state.opList.splice(state.opList.indexOf(data.character), 1);
        const char = state.get(data.character);
        char.isChatOp = false;
    });
    connection.onMessage('RTB', (data) => {
        switch(data.type) {
            case 'trackadd':
                state.bookmarkList.push(data.name);
                state.get(data.name).isBookmarked = true;
                break;
            case 'trackrem':
                state.bookmarkList.splice(state.bookmarkList.indexOf(data.name), 1);
                state.get(data.name).isBookmarked = false;
                break;
            case 'friendadd':
                state.friendList.push(data.name);
                state.get(data.name).isFriend = true;
                break;
            case 'friendremove':
                state.friendList.splice(state.friendList.indexOf(data.name), 1);
                state.get(data.name).isFriend = false;
        }
    });
    return state;
}