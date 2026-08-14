import { MSG, genRoomCode, pack, unpack } from './protocol.js';

const HEARTBEAT_MS = 2000;
const MISS_LIMIT = 3;

// PeerJS 信令封装：创建房间（Peer ID = 5位房间号）/ 加入房间 / 心跳检测 / 断开
// PeerJS 通过 index.html 的 CDN <script> 引入，挂载在 window.Peer
export class Signal {
  constructor({ onOpen, onConnect, onData, onDisconnect, onError } = {}) {
    if (typeof Peer === 'undefined') {
      onError?.(new Error('PeerJS 未加载（检查网络，需访问 CDN）'));
      return;
    }
    this.peer = null;
    this.conn = null;
    this.cb = { onOpen, onConnect, onData, onDisconnect, onError };
    this._miss = 0;
    this._hb = null;
    this._closed = false;
  }
  // 创建房间：Peer ID = 房间号
  createRoom() {
    this.peer = new Peer(genRoomCode(), { debug: 1 });
    this.peer.on('open', id => this.cb.onOpen?.(id));
    this.peer.on('connection', conn => this._accept(conn));
    this.peer.on('error', err => this.cb.onError?.(err));
  }
  // 加入房间：连接指定房间号
  joinRoom(code) {
    this.peer = new Peer({ debug: 1 });
    this.peer.on('open', () => {
      if (this._closed) return;
      const conn = this.peer.connect(code, { reliable: true });
      this._accept(conn);
    });
    this.peer.on('error', err => this.cb.onError?.(err));
  }
  _accept(conn) {
    this.conn = conn;
    conn.on('open', () => {
      if (this._closed) return;
      this._miss = 0;
      this._startHeartbeat();
      this.cb.onConnect?.();
    });
    conn.on('data', raw => {
      const msg = unpack(raw);
      if (!msg) return;
      if (msg.t === MSG.PING) { this.send(MSG.PONG, { t0: msg.d.t0 }); return; }
      if (msg.t === MSG.PONG) { this._miss = 0; return; }
      this.cb.onData?.(msg);
    });
    conn.on('close', () => this._handleDisconnect());
    conn.on('error', () => this._handleDisconnect());
  }
  _startHeartbeat() {
    clearInterval(this._hb);
    this._hb = setInterval(() => {
      if (!this.conn?.open || this._closed) return;
      this.send(MSG.PING, { t0: Date.now() });
      this._miss++;
      if (this._miss >= MISS_LIMIT) this._handleDisconnect();
    }, HEARTBEAT_MS);
  }
  _handleDisconnect() {
    if (this._closed) return;
    this._closed = true;
    clearInterval(this._hb);
    this.cb.onDisconnect?.();
  }
  send(t, d) {
    if (this.conn?.open) this.conn.send(pack(t, d));
  }
  close() {
    this._closed = true;
    clearInterval(this._hb);
    try { this.conn?.close(); } catch { /* noop */ }
    try { this.peer?.destroy(); } catch { /* noop */ }
    this.peer = null; this.conn = null;
  }
  get connected() { return !!this.conn?.open; }
}
