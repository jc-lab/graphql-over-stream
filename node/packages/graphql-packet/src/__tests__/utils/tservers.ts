import { EventEmitter } from 'events';
import { schema, pong } from '../fixtures/simple';
import {ServerOptions, Context} from 'graphql-ws';

import {VirtualServer, VirtualServerSocket} from './vserver';
import {useServer, Extra as WSExtra} from './ws';

export { WSExtra };

// distinct server for each test; if you forget to dispose, the fixture wont
const leftovers: Dispose[] = [];
afterEach(async () => {
  while (leftovers.length > 0) {
    await leftovers.pop()?.();
  }
});

export interface TServerClient {
  stream: VirtualServerSocket;
  send(data: string): void;
  onMessage(cb: (message: string) => void): () => void;
  close(code?: number, data?: string): void;
}

export interface TServer {
  transport: VirtualServer,
  getClients: () => TServerClient[];
  pong: (key?: string) => void;
  waitForClient: (
    test?: (client: TServerClient) => void,
    expire?: number,
  ) => Promise<void>;
  waitForConnect: (
    test?: (ctx: Context<any, VirtualServerSocket>) => void,
    expire?: number,
  ) => Promise<void>;
  waitForOperation: (test?: () => void, expire?: number) => Promise<void>;
  waitForComplete: (test?: () => void, expire?: number) => Promise<void>;
  waitForClientClose: (test?: () => void, expire?: number) => Promise<void>;
  dispose: Dispose;
}

type Dispose = (beNice?: boolean) => Promise<void>;

export class TServerInstance extends EventEmitter {


}

export async function startRawServer(): Promise<{
  transport: VirtualServer,
  server: TServerInstance;
  dispose: () => Promise<void>;
}> {
  const server = new VirtualServer();

  let disposed = false;
  const dispose: Dispose = (beNice) => {
    return new Promise((resolve) => {
      if (disposed) return resolve();
      disposed = true;
      if (!beNice) {
        for (const socket of server.sockets) {
          socket.close(0, '');
        }
      }
      server.close(() => {
        resolve();
      });
    });
  };
  leftovers.push(dispose);

  return {
    transport: server,
    server,
    dispose,
  };
}

export async function startWSTServer(
  options: Partial<ServerOptions> = {},
  keepAlive?: number, // for ws tests sake
): Promise<TServer> {
  const emitter = new EventEmitter();

  const vs = new VirtualServer();

  const pendingConnections: Context<any, VirtualServerSocket>[] = [];
  let pendingOperations = 0,
    pendingCompletes = 0;

  const server = useServer(
    {
      schema,
      ...options,
      onConnect: async (...args) => {
        pendingConnections.push(args[0] as any);
        const permitted = await options?.onConnect?.(...args);
        emitter.emit('conn');
        return permitted;
      },
      onOperation: async (ctx, msg, args, result) => {
        pendingOperations++;
        const maybeResult = await options?.onOperation?.(
          ctx,
          msg,
          args,
          result,
        );
        emitter.emit('operation');
        return maybeResult;
      },
      onComplete: async (...args) => {
        pendingCompletes++;
        await options?.onComplete?.(...args);
        emitter.emit('compl');
      },
    },
    vs,
    keepAlive
  );

  let disposed = false;
  const dispose: Dispose = (beNice) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (disposed) return resolve();
      disposed = true;
      await server.dispose();
      resolve();
    });
  };

  leftovers.push(dispose);

  // pending websocket clients
  let pendingCloses = 0;
  const pendingClients: TServerClient[] = [];
  vs.on('connection', (client: VirtualServerSocket) => {
    pendingClients.push(toClient(client));
    client.once('close', () => {
      pendingCloses++;
      emitter.emit('close');
    });
  });

  function toClient(socket: VirtualServerSocket): TServerClient {
    return {
      stream: socket,
      send: (data) => socket.send(data),
      onMessage: (cb) => {
        const listener = (data: unknown) => cb(String(data));
        socket.on('message', listener);
        return () => socket.off('message', listener);
      },
      close: (...args: any[]) => socket.close(args[0], args[1]),
    };
  }

  return {
    transport: vs,
    getClients() {
      return Array.from(vs.sockets, toClient);
    },
    waitForClient(test, expire) {
      return new Promise((resolve) => {
        function done() {
          // the on connect listener below will be called before our listener, populating the queue
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const client = pendingClients.shift()!;
          test?.(client);
          resolve();
        }
        if (pendingClients.length > 0) return done();
        vs.once('connection', done);
        if (expire)
          setTimeout(() => {
            vs.off('connection', done); // expired
            resolve();
          }, expire);
      });
    },
    waitForClientClose(test, expire) {
      return new Promise((resolve) => {
        function done() {
          pendingCloses--;
          test?.();
          resolve();
        }
        if (pendingCloses > 0) return done();

        emitter.once('close', done);
        if (expire)
          setTimeout(() => {
            emitter.off('close', done); // expired
            resolve();
          }, expire);
      });
    },
    pong,
    waitForConnect(test, expire) {
      return new Promise((resolve) => {
        function done() {
          // the on connect listener below will be called before our listener, populating the queue
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const ctx = pendingConnections.shift()!;
          test?.(ctx);
          resolve();
        }
        if (pendingConnections.length > 0) return done();
        emitter.once('conn', done);
        if (expire)
          setTimeout(() => {
            emitter.off('conn', done); // expired
            resolve();
          }, expire);
      });
    },
    waitForOperation(test, expire) {
      return new Promise((resolve) => {
        function done() {
          pendingOperations--;
          test?.();
          resolve();
        }
        if (pendingOperations > 0) return done();
        emitter.once('operation', done);
        if (expire)
          setTimeout(() => {
            emitter.off('operation', done); // expired
            resolve();
          }, expire);
      });
    },
    waitForComplete(test, expire) {
      return new Promise((resolve) => {
        function done() {
          pendingCompletes--;
          test?.();
          resolve();
        }
        if (pendingCompletes > 0) return done();
        emitter.once('compl', done);
        if (expire)
          setTimeout(() => {
            emitter.off('compl', done); // expired
            resolve();
          }, expire);
      });
    },
    dispose,
  };
}
