import * as events from 'events';
import {AbstractServerSocket, AbstractClientSocket, ReadyStateType} from "../../index";
import {CloseEvent, MessageEvent, WebSocket} from "ws";

function fallbackNextTick(cb: () => void): void {
  setTimeout(cb, 0);
}
const nextTick = (typeof setImmediate !== 'undefined') ? setImmediate : fallbackNextTick;

export class VirtualClientSocket extends AbstractClientSocket {
  constructor(public delegate: Partial<AbstractClientSocket>) {
    super();
  }

  close(code?: number, reason?: string): void {
    this.delegate.close?.(code, reason);
  }

  ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void {
    this.delegate.ping?.(data, mask, cb);
  }

  pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void {
    this.delegate.pong?.(data, mask, cb);
  }

  send(data: string): void {
    this.delegate.send?.(data);
  }

  terminate(): void {
    this.delegate.terminate?.();
  }

  public setReadyState(n: ReadyStateType) {
    this._readyState = n;
  }
}

export class VirtualServerSocket extends AbstractServerSocket {
  constructor(public delegate: Partial<VirtualServerSocket> & { isOpen: () => boolean }) {
    super();
  }

  close(code: number, reason: string): Promise<void> | void {
    return this.delegate.close?.(code, reason);
  }

  send(data: string): Promise<void> | void;
  send(data: string): Promise<void> | void;
  send(data: string): Promise<void> | void {
    return this.delegate.send?.(data);
  }

  public isOpen(): boolean {
    return this.delegate.isOpen();
  }

  ping(): void {
    this.delegate.ping?.();
  }
}

export class VirtualServer extends events.EventEmitter {
  public sockets: Set<VirtualServerSocket> = new Set<VirtualServerSocket>();

  createStream(): VirtualClientSocket {
    let closed = false;

    const client = new VirtualClientSocket({
      close(code?: number, reason?: string) {
        if (closed) return ;

        closed = true;
        const event: CloseEvent = {
          wasClean: true,
          code: code || 1005,
          reason: reason || '',
          type: 'close',
          target: client
        };
        client.setReadyState(AbstractClientSocket.CLOSING);
        nextTick(() => {
          client.setReadyState(AbstractClientSocket.CLOSED);
          client.emit('close', event);
          server.emit('close', event.code, event.reason);
        });
      },
      send(data) {
        if (closed) return ;
        nextTick(() => {
          try {
            server.emit('message', data);
          } catch (e) {
            console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', e);
          }
        });
      },
      ping(data?: any, mask?: boolean, cb?: (err: Error) => void) {
        if (closed) return ;
        nextTick(() => {
          server.emit('ping', data);
        });
        if (cb) {
          cb(null as any);
        }
      },
      pong(data?: any, mask?: boolean, cb?: (err: Error) => void) {
        if (closed) return ;
        nextTick(() => {
          server.emit('pong', data);
        });
        if (cb) {
          cb(null as any);
        }
      }
    });

    const server = new VirtualServerSocket({
      isOpen(): boolean {
        return !closed;
      },
      close(code?: number, reason?: string) {
        if (closed) return ;
        closed = true;

        const event: CloseEvent = {
          wasClean: true,
          code: code || 1005,
          reason: reason || '',
          type: 'close',
          target: client
        };
        client.setReadyState(AbstractClientSocket.CLOSING);
        nextTick(() => {
          client.setReadyState(AbstractClientSocket.CLOSED);
          client.emit('close', event);
          server.emit('close', event.code, event.reason);
        });
      },
      send(data) {
        if (closed) return ;
        const event: MessageEvent = {
          data: data,
          type: 'message',
          target: client,
        };
        nextTick(() => {
          try {
            client.emit('message', event);
          } catch (e) {
            console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', e);
          }
        });
      },
      ping() {
        if (closed) return ;
        nextTick(() => {
          client.emit('ping');
        });
      }
    });

    server.once('close', () => {
      this.sockets.delete(server);
    });
    this.sockets.add(server);

    nextTick(() => {
      client.setReadyState(AbstractClientSocket.OPEN);
      client.emit('open');
    });
    this.emit('connection', server);

    return client;
  }

  close(cb: (err?: any) => void) {
    this.sockets.forEach((item) => item.close(1005, ''));
    this.sockets.clear();
    cb();
  }
}
