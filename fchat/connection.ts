import Axios, {AxiosResponse} from 'axios';
import * as qs from 'qs';
import {Connection as Interfaces, WebSocketConnection} from './interfaces';

const fatalErrors = [2, 3, 4, 9, 30, 31, 33, 39, 40, 62, -4];
const dieErrors = [9, 30, 31, 39];

async function queryApi(this: void, endpoint: string, data: object): Promise<AxiosResponse> {
    return Axios.post(`https://www.f-list.net/json/api/${endpoint}`, qs.stringify(data));
}

export default class Connection implements Interfaces.Connection {
    character: string;
    vars: Interfaces.Vars & {[key: string]: string} = <any>{}; //tslint:disable-line:no-any
    protected socket: WebSocketConnection | undefined = undefined;
    private messageHandlers: {[key in keyof Interfaces.ServerCommands]?: Interfaces.CommandHandler<key>[]} = {};
    private connectionHandlers: {[key in Interfaces.EventType]?: Interfaces.EventHandler[]} = {};
    private errorHandlers: ((error: Error) => void)[] = [];
    private ticket: string;
    private cleanClose = false;
    private reconnectTimer: NodeJS.Timer;
    private ticketProvider: Interfaces.TicketProvider;
    private reconnectDelay = 0;

    constructor(private readonly socketProvider: new() => WebSocketConnection, private readonly account: string,
                ticketProvider: Interfaces.TicketProvider | string) {
        this.ticketProvider = typeof ticketProvider === 'string' ? async() => this.getTicket(ticketProvider) : ticketProvider;
    }

    async connect(character: string): Promise<void> {
        this.cleanClose = false;
        const isReconnect = this.character === character;
        this.character = character;
        this.ticket = await this.ticketProvider();
        await this.invokeHandlers('connecting', isReconnect);
        const socket = this.socket = new this.socketProvider();
        socket.onOpen(() => {
            this.send('IDN', {
                account: this.account,
                character: this.character,
                cname: 'F-Chat',
                cversion: '3.0',
                method: 'ticket',
                ticket: this.ticket
            });
        });
        socket.onMessage((msg: string) => {
            const type = <keyof Interfaces.ServerCommands>msg.substr(0, 3);
            const data = msg.length > 6 ? <object>JSON.parse(msg.substr(4)) : undefined;
            this.handleMessage(type, data);
        });
        socket.onClose(async() => {
            if(!this.cleanClose) {
                setTimeout(async() => this.connect(this.character), this.reconnectDelay);
                this.reconnectDelay = this.reconnectDelay >= 30000 ? 60000 : this.reconnectDelay >= 10000 ? 30000 : 10000;
            }
            this.socket = undefined;
            await this.invokeHandlers('closed', !this.cleanClose);
        });
        socket.onError((error: Error) => {
            for(const handler of this.errorHandlers) handler(error);
        });
        return new Promise<void>((resolve) => {
            const handler = () => {
                resolve();
                this.offEvent('connected', handler);
            };
            this.onEvent('connected', handler);
        });
    }

    close(): void {
        clearTimeout(this.reconnectTimer);
        this.cleanClose = true;
        if(this.socket !== undefined) this.socket.close();
    }

    async queryApi(endpoint: string, data?: {account?: string, ticket?: string}): Promise<object> {
        if(data === undefined) data = {};
        data.account = this.account;
        data.ticket = this.ticket;
        let res = <{error: string}>(await queryApi(endpoint, data)).data;
        if(res.error === 'Invalid ticket.' || res.error === 'Your login ticket has expired (five minutes) or no ticket requested.') {
            data.ticket = this.ticket = await this.ticketProvider();
            res = <{error: string}>(await queryApi(endpoint, data)).data;
        }
        if(res.error !== '') {
            const error = new Error(res.error);
            (<Error & {request: true}>error).request = true;
            throw error;
        }
        return res;
    }

    onError(handler: (error: Error) => void): void {
        this.errorHandlers.push(handler);
    }

    onEvent(type: Interfaces.EventType, handler: Interfaces.EventHandler): void {
        let handlers = this.connectionHandlers[type];
        if(handlers === undefined) handlers = this.connectionHandlers[type] = [];
        handlers.push(handler);
    }

    offEvent(type: Interfaces.EventType, handler: Interfaces.EventHandler): void {
        const handlers = this.connectionHandlers[type];
        if(handlers === undefined) return;
        handlers.splice(handlers.indexOf(handler), 1);
    }

    onMessage<K extends keyof Interfaces.ServerCommands>(type: K, handler: Interfaces.CommandHandler<K>): void {
        let handlers: (Interfaces.CommandHandler<K>[] | undefined) = this.messageHandlers[type];
        if(handlers === undefined) handlers = this.messageHandlers[type] = [];
        handlers.push(handler);
    }

    offMessage<K extends keyof Interfaces.ServerCommands>(type: K, handler: Interfaces.CommandHandler<K>): void {
        const handlers: (Interfaces.CommandHandler<K>[] | undefined) = this.messageHandlers[type];
        if(handlers === undefined) return;
        handlers.splice(handlers.indexOf(handler), 1);
    }

    send<K extends keyof Interfaces.ClientCommands>(command: K, data?: Interfaces.ClientCommands[K]): void {
        if(this.socket !== undefined)
            this.socket.send(<string>command + (data !== undefined ? ` ${JSON.stringify(data)}` : ''));
    }

    //tslint:disable:no-unsafe-any no-any
    protected handleMessage<T extends keyof Interfaces.ServerCommands>(type: T, data: any): void {
        switch(type) {
            case 'VAR':
                this.vars[data.variable] = data.value;
                break;
            case 'PIN':
                this.send('PIN');
                break;
            case 'ERR':
                if(fatalErrors.indexOf(data.number) !== -1) {
                    const error = new Error(data.message);
                    for(const handler of this.errorHandlers) handler(error);
                    if(dieErrors.indexOf(data.number) !== -1) this.close();
                    else this.socket!.close();
                }
                break;
            case 'NLN':
                if(data.identity === this.character) {
                    this.invokeHandlers('connected', this.reconnectDelay !== 0); //tslint:disable-line:no-floating-promises
                    this.reconnectDelay = 0;
                }
        }
        const time = new Date();
        const handlers: Interfaces.CommandHandler<T>[] | undefined = this.messageHandlers[type];
        if(handlers !== undefined)
            for(const handler of handlers) handler(data, time);
    }

    //tslint:enable

    private async getTicket(password: string): Promise<string> {
        const data = <{ticket?: string, error: string}>(await Axios.post('https://www.f-list.net/json/getApiTicket.php', qs.stringify(
            {account: this.account, password, no_friends: true, no_bookmarks: true, no_characters: true}))).data;
        if(data.ticket !== undefined) return data.ticket;
        throw new Error(data.error);
    }

    private async invokeHandlers(type: Interfaces.EventType, isReconnect: boolean): Promise<void> {
        const handlers = this.connectionHandlers[type];
        if(handlers === undefined) return;
        for(const handler of handlers) await handler(isReconnect);
    }
}