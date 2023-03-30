/// <reference types="node" />
import * as events from 'events';
import * as GraphqlWs from 'graphql-ws';
import type { WebSocket, CloseEvent, ErrorEvent, MessageEvent, Event as WebsocketEvent } from 'ws';
export type OnCloseEvent = (this: WebSocket, ev: CloseEvent) => any;
export type OnErrorEvent = (this: WebSocket, ev: ErrorEvent) => any;
export type OnMessageEvent = (this: WebSocket, ev: MessageEvent) => any;
export type OnOpenEvent = (this: WebSocket, ev: WebsocketEvent) => any;
export type ReadyStateType = typeof WebSocket.CONNECTING | typeof WebSocket.OPEN | typeof WebSocket.CLOSING | typeof WebSocket.CLOSED;
export interface AbstractServerSocket extends events.EventEmitter, GraphqlWs.WebSocket {
    on(eventName: 'close', listener: (code: number, reason: string) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    once(eventName: 'close', listener: (code: number, reason: string) => void): this;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    emit(eventName: 'close', code: number, reason: string): boolean;
    emit(eventName: string | symbol, ...args: any[]): boolean;
}
export declare abstract class AbstractServerSocket extends events.EventEmitter implements GraphqlWs.WebSocket {
    readonly protocol: string;
    onMessage(cb: (data: string) => Promise<void>): void;
    abstract close(code: number, reason: string): Promise<void> | void;
    abstract send(data: string): Promise<void> | void;
}
export interface AbstractClientSocket extends events.EventEmitter {
    on(eventName: 'close', listener: (event: CloseEvent) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    once(eventName: 'close', listener: (event: CloseEvent) => void): this;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    emit(eventName: 'close', event: CloseEvent): boolean;
    emit(eventName: string | symbol, ...args: any[]): boolean;
}
export declare abstract class AbstractClientSocket extends events.EventEmitter implements WebSocket {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
    readonly binaryType = "arraybuffer";
    readonly bufferedAmount: number;
    readonly extensions: string;
    readonly protocol: string;
    readonly url: string;
    readonly isPaused: boolean;
    onclose: OnCloseEvent | null;
    onerror: OnErrorEvent | null;
    onmessage: OnMessageEvent | null;
    onopen: OnOpenEvent | null;
    protected _readyState: ReadyStateType;
    constructor();
    get readyState(): ReadyStateType;
    dispatchEvent(event: Event): boolean;
    addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
    pause(): void;
    resume(): void;
    abstract close(code?: number, reason?: string): void;
    abstract send(data: string): void;
    abstract ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    abstract pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    abstract terminate(): void;
}
type Constructor<T> = new (...args: any[]) => T;
export type CreateStreamType = () => AbstractClientSocket;
export declare function customSocketFactory(supplier: CreateStreamType): Constructor<WebSocket>;
export {};
