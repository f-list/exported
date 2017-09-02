import {WebSocketConnection} from '../fchat/interfaces';
import l from './localize';

export default class Socket implements WebSocketConnection {
    static host = 'wss://chat.f-list.net:9799';
    socket: WebSocket;

    constructor() {
        this.socket = new WebSocket(Socket.host);
    }

    close(): void {
        this.socket.close();
    }

    onMessage(handler: (message: string) => void): void {
        this.socket.addEventListener('message', (e) => handler(<string>e.data));
    }

    onOpen(handler: () => void): void {
        this.socket.addEventListener('open', handler);
    }

    onClose(handler: () => void): void {
        this.socket.addEventListener('close', handler);
    }

    onError(handler: (error: Error) => void): void {
        this.socket.addEventListener('error', () => handler(new Error(l('login.connectError'))));
    }

    send(message: string): void {
        this.socket.send(message);
    }
}