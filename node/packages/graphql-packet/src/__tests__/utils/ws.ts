import {  } from 'graphql-ws';
import {
  makeServer, ServerOptions,

  ConnectionInitMessage,
  CloseCode,
  Disposable,
} from 'graphql-ws';
import {VirtualServer, VirtualServerSocket} from './vserver';

/**
 * Limits the WebSocket close event reason to not exceed a length of one frame.
 * Reference: https://datatracker.ietf.org/doc/html/rfc6455#section-5.2.
 *
 * @private
 */
export function limitCloseReason(reason: string, whenTooLong: string) {
  return reason.length < 124 ? reason : whenTooLong;
}

/**
 * The extra that will be put in the `Context`.
 *
 * @category Server/ws
 */
export interface Extra {
  /**
   * The actual socket connection between the server and the client.
   */
  readonly socket: VirtualServerSocket;
}

/**
 * Use the server on a [ws](https://github.com/websockets/ws) ws server.
 * This is a basic starter, feel free to copy the code over and adjust it to your needs
 *
 * @category Server/ws
 */
export function useServer<
  P extends ConnectionInitMessage['payload'] = ConnectionInitMessage['payload'],
  E extends Record<PropertyKey, unknown> = Record<PropertyKey, never>,
>(
  options: ServerOptions<P, Extra & Partial<E>>,
  ws: VirtualServer,
  /**
   * The timout between dispatched keep-alive messages. Internally uses the [ws Ping and Pongs]((https://developer.mozilla.org/en-US/docs/Web/API/wss_API/Writing_ws_servers#Pings_and_Pongs_The_Heartbeat_of_wss))
   * to check that the link between the clients and the server is operating and to prevent the link
   * from being broken due to idling.
   *
   * @default 12_000 // 12 seconds
   */
  keepAlive = 12_000,
): Disposable {
  const isProd = process.env.NODE_ENV === 'production';
  const server = makeServer({
    ...options,
  });

  ws.once('error', (err) => {
    console.error(
      'Internal error emitted on the WebSocket server. ' +
        'Please check your implementation.',
      err,
    );

    // catch the first thrown error and re-throw it once all clients have been notified
    let firstErr: Error | null = null;

    // report server errors by erroring out all clients with the same error
    for (const client of ws.sockets) {
      try {
        client.close(
          CloseCode.InternalServerError,
          isProd
            ? 'Internal server error'
            : limitCloseReason(
                err instanceof Error ? err.message : String(err),
                'Internal server error',
              ),
        );
      } catch (err) {
        firstErr = firstErr ?? err;
      }
    }

    if (firstErr) throw firstErr;
  });

  ws.on('connection', (socket: VirtualServerSocket) => {
    socket.once('error', (err) => {
      console.error(
        'Internal error emitted on a WebSocket socket. ' +
          'Please check your implementation.',
        err,
      );
      socket.close(
        CloseCode.InternalServerError,
        isProd
          ? 'Internal server error'
          : limitCloseReason(
              err instanceof Error ? err.message : String(err),
              'Internal server error',
            ),
      );
    });

    // keep alive through ping-pong messages
    let pongWait: NodeJS.Timeout | null = null;
    const pingInterval =
      keepAlive > 0 && isFinite(keepAlive)
        ? setInterval(() => {
            // ping pong on open sockets only
            if (socket.isOpen()) {
              // terminate the connection after pong wait has passed because the client is idle
              pongWait = setTimeout(() => {
                // socket.terminate();
                socket.close(1006, 'timeout');
              }, keepAlive);

              // listen for client's pong and stop socket termination
              socket.once('pong', () => {
                if (pongWait) {
                  clearTimeout(pongWait);
                  pongWait = null;
                }
              });

              socket.ping();
            }
          }, keepAlive)
        : null;

    const closed = server.opened(
      socket,
      { socket } as Extra & Partial<E>,
    );

    socket.once('close', (code, reason) => {
      if (pongWait) clearTimeout(pongWait);
      if (pingInterval) clearInterval(pingInterval);
      closed(code, String(reason));
    });
  });

  return {
    dispose: async () => {
      for (const client of ws.sockets) {
        client.close(1001, 'Going away');
      }
      ws.removeAllListeners();
      await new Promise<void>((resolve, reject) => {
        ws.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
