import {VirtualClientSocket, VirtualServer} from "./vserver";
import WebSocket, {CloseEvent, MessageEvent} from "ws";

export interface TClient {
  stream: VirtualClientSocket;
  waitForMessage: (
    test?: (data: MessageEvent) => void,
    expire?: number,
  ) => Promise<void>;
  waitForClose: (
    test?: (event: CloseEvent) => void,
    expire?: number,
  ) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createTClient(
  server: VirtualServer,
): Promise<TClient> {
  let closeEvent: CloseEvent;
  const queue: WebSocket.MessageEvent[] = [];
  return new Promise((resolve, reject) => {
    const stream = server.createStream();
    stream.on('close', (event) => (closeEvent = event));
    stream.on('message', data => queue.push(data));
    stream.once('error', reject);
    stream.on('open', () =>
      resolve({
        stream,
        async waitForMessage(test, expire) {
          return new Promise((resolve) => {
            const done = () => {
              // the onmessage listener above will be called before our listener, populating the queue
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const next = queue.shift()!;
              test?.(next as any);
              resolve();
            };
            if (queue.length > 0) return done();
            stream.once('message', done);
            if (expire)
              setTimeout(() => {
                stream.off('message', done); // expired
                resolve();
              }, expire);
          });
        },
        async waitForClose(
          test?: (event: CloseEvent) => void,
          expire?: number,
        ) {
          return new Promise((resolve) => {
            if (closeEvent) {
              test?.(closeEvent);
              return resolve();
            }
            stream.on('close', (event) => {
              closeEvent = event;
              test?.(event);
              resolve();
            });
            if (expire)
              setTimeout(() => {
                stream.removeAllListeners('close');
                resolve();
              }, expire);
          });
        },
      })
    );
  });
}
