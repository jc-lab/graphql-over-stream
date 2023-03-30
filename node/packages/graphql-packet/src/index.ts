import * as events from 'events';
import * as GraphqlWs from 'graphql-ws';
import type {
  WebSocket,
  CloseEvent,
  ErrorEvent,
  MessageEvent,
  Event as WebsocketEvent,
} from 'ws';

export type OnCloseEvent = (this: WebSocket, ev: CloseEvent) => any;
export type OnErrorEvent = (this: WebSocket, ev: ErrorEvent) => any;
export type OnMessageEvent = (this: WebSocket, ev: MessageEvent) => any;
export type OnOpenEvent = (this: WebSocket, ev: WebsocketEvent) => any;
export type ReadyStateType = typeof WebSocket.CONNECTING
  | typeof WebSocket.OPEN
  | typeof WebSocket.CLOSING
  | typeof WebSocket.CLOSED;

export interface AbstractServerSocket extends events.EventEmitter, GraphqlWs.WebSocket {
  on(eventName: 'close', listener: (code: number, reason: string) => void): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  once(eventName: 'close', listener: (code: number, reason: string) => void): this;
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;
  emit(eventName: 'close', code: number, reason: string): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean;
}

export abstract class AbstractServerSocket extends events.EventEmitter implements GraphqlWs.WebSocket {
  public readonly protocol: string = GraphqlWs.GRAPHQL_TRANSPORT_WS_PROTOCOL;

  onMessage(cb: (data: string) => Promise<void>): void {
    this.on('message', async (data) => {
      try {
        await cb(data);
      } catch (e) {
        this.close(GraphqlWs.CloseCode.InternalServerError, e.message);
      }
    });
  }

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

export abstract class AbstractClientSocket extends events.EventEmitter implements WebSocket {
  public static readonly CONNECTING = 0 as const;
  public static readonly OPEN = 1 as const;
  public static readonly CLOSING = 2 as const;
  public static readonly CLOSED = 3 as const;
  public readonly CONNECTING = 0 as const;
  public readonly OPEN = 1 as const;
  public readonly CLOSING = 2 as const;
  public readonly CLOSED = 3 as const;
  public readonly binaryType = 'arraybuffer';
  public readonly bufferedAmount: number = 0;
  public readonly extensions: string = '';
  public readonly protocol: string = GraphqlWs.GRAPHQL_TRANSPORT_WS_PROTOCOL;
  public readonly url: string = '';
  public readonly isPaused: boolean = false;

  public onclose: OnCloseEvent | null = null;
  public onerror: OnErrorEvent | null = null;
  public onmessage: OnMessageEvent | null = null;
  public onopen: OnOpenEvent | null = null;

  protected _readyState: ReadyStateType = AbstractClientSocket.CONNECTING as ReadyStateType;

  constructor() {
    super();
    this.on('error', (event) => {
      if (this.onerror) {
        this.onerror.call(this, event);
      }
    });
    this.on('open', (event) => {
      if (this.onopen) {
        this.onopen.call(this, event);
      }
    });
    this.on('close', (event) => {
      if (this.onclose) {
        this.onclose.call(this, event);
      }
    });
    this.on('message', (event) => {
      if (this.onmessage) {
        this.onmessage.call(this, event);
      }
    });
  }

  public get readyState(): ReadyStateType {
    return this._readyState;
  }

  dispatchEvent(event: Event): boolean {
    return false;
  }

  addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
  addEventListener(type: string, listener: any, options?: boolean | AddEventListenerOptions): void {
    super.addListener(type, listener);
  }

  removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
  removeEventListener(type: string, listener: any, options?: boolean | EventListenerOptions): void {
    super.removeListener(type, listener);
  }

  pause(): void {
    // empty
  }

  resume(): void {
    // empty
  }

  abstract close(code?: number, reason?: string): void;

  abstract send(data: string): void;

  abstract ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;

  abstract pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;

  abstract terminate(): void;
}

type Constructor<T> = new (...args: any[]) => T;

export type CreateStreamType = () => AbstractClientSocket;

export function customSocketFactory(supplier: CreateStreamType): Constructor<WebSocket> {
  function CustomWebSocketConstructor(address: string, protocols?: string[]) {
    return supplier();
  }
  CustomWebSocketConstructor.constructor = CustomWebSocketConstructor;
  CustomWebSocketConstructor.CONNECTING = 0;
  CustomWebSocketConstructor.OPEN = 1;
  CustomWebSocketConstructor.CLOSING = 2;
  CustomWebSocketConstructor.CLOSED = 3;
  return CustomWebSocketConstructor as any;
}
