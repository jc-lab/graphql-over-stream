"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customSocketFactory = exports.AbstractClientSocket = exports.AbstractServerSocket = void 0;
const events = __importStar(require("events"));
const GraphqlWs = __importStar(require("graphql-ws"));
class AbstractServerSocket extends events.EventEmitter {
    constructor() {
        super(...arguments);
        this.protocol = GraphqlWs.GRAPHQL_TRANSPORT_WS_PROTOCOL;
    }
    onMessage(cb) {
        this.on('message', async (data) => {
            try {
                await cb(data);
            }
            catch (e) {
                this.close(GraphqlWs.CloseCode.InternalServerError, e.message);
            }
        });
    }
}
exports.AbstractServerSocket = AbstractServerSocket;
class AbstractClientSocket extends events.EventEmitter {
    constructor() {
        super();
        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;
        this.binaryType = 'arraybuffer';
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = GraphqlWs.GRAPHQL_TRANSPORT_WS_PROTOCOL;
        this.url = '';
        this.isPaused = false;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        this.onopen = null;
        this._readyState = AbstractClientSocket.CONNECTING;
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
    get readyState() {
        return this._readyState;
    }
    dispatchEvent(event) {
        return false;
    }
    addEventListener(type, listener, options) {
        super.addListener(type, listener);
    }
    removeEventListener(type, listener, options) {
        super.removeListener(type, listener);
    }
    pause() {
        // empty
    }
    resume() {
        // empty
    }
}
exports.AbstractClientSocket = AbstractClientSocket;
AbstractClientSocket.CONNECTING = 0;
AbstractClientSocket.OPEN = 1;
AbstractClientSocket.CLOSING = 2;
AbstractClientSocket.CLOSED = 3;
function customSocketFactory(supplier) {
    function CustomWebSocketConstructor(address, protocols) {
        return supplier();
    }
    CustomWebSocketConstructor.constructor = CustomWebSocketConstructor;
    CustomWebSocketConstructor.CONNECTING = 0;
    CustomWebSocketConstructor.OPEN = 1;
    CustomWebSocketConstructor.CLOSING = 2;
    CustomWebSocketConstructor.CLOSED = 3;
    return CustomWebSocketConstructor;
}
exports.customSocketFactory = customSocketFactory;
