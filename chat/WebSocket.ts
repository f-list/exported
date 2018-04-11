import {WebSocketConnection} from '../fchat';

export default class Socket implements WebSocketConnection {
    static host = 'wss://chat.f-list.net:9799';
    private socket: WebSocket;
    private errorHandler: ((error: Error) => void) | undefined;
    private lastHandler: Promise<void> = Promise.resolve();

    constructor() {
        this.socket = new WebSocket(Socket.host);
    }

    close(): void {
        this.socket.close();
    }

    onMessage(handler: (message: string) => void): void {
        this.socket.addEventListener('message', (e) => {
            this.lastHandler = this.lastHandler.then(() => handler(<string>e.data), this.errorHandler);
        });
    }

    onOpen(handler: () => void): void {
        this.socket.addEventListener('open', handler);
    }

    onClose(handler: () => void): void {
        this.socket.addEventListener('close', handler);
    }

    onError(handler: (error: Error) => void): void {
        this.errorHandler = handler;
        this.socket.addEventListener('error', () => handler(new Error()));
    }

    send(message: string): void {
        this.socket.send(message);
    }
}