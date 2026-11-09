import Peer from 'peerjs';
import { CONFIG } from '../config.js';

const PREFIX = 'fat-bear-or-weak-';
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const JOIN_TIMEOUT_MS = 12000;

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return code;
}

// Connects friends' browsers directly with WebRTC (through PeerJS). The host's browser runs
// the game; this class only moves messages. PeerJS's free public server just introduces the
// browsers to each other using the lobby code, so no game server is needed.
class Net {
  constructor() {
    this.listeners = {};
    this.reset();
  }

  reset() {
    this.peer = null;
    this.role = null; // 'host', 'guest', or null when offline
    this.id = null;
    this.code = null;
    this.players = [];
    this.roundMinutes = CONFIG.online.defaultRoundMinutes;
    this.inGame = false;
    this.conns = new Map(); // host: guest id -> connection
    this.hostConn = null; // guest: connection to the host
    this.leaving = false;
  }

  get online() {
    return this.role !== null;
  }

  on(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  emit(type, data) {
    (this.listeners[type] || []).forEach((fn) => fn(data));
  }

  // ---- host ----

  async host(name) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      try {
        const peer = await openPeer(PREFIX + code);
        this.reset();
        this.peer = peer;
        this.role = 'host';
        this.id = peer.id;
        this.code = code;
        this.players = [{ id: peer.id, name }];
        peer.on('connection', (conn) => this.onGuestConnection(conn));
        // Losing the introduction server doesn't drop current players, but new ones need it.
        peer.on('disconnected', () => !this.leaving && !peer.destroyed && peer.reconnect());
        return code;
      } catch (err) {
        if (err.type !== 'unavailable-id') throw err;
      }
    }
    throw new Error('Could not create a lobby. Please try again.');
  }

  onGuestConnection(conn) {
    conn.on('data', (msg) => {
      if (msg.t === 'hello') this.addGuest(conn, msg.name);
      else this.emit(msg.t, { id: conn.peer, msg });
    });
    conn.on('close', () => this.removeGuest(conn.peer));
    conn.on('error', () => this.removeGuest(conn.peer));
  }

  addGuest(conn, name) {
    if (this.players.length >= CONFIG.online.maxPlayers) {
      conn.send({ t: 'full' });
      return;
    }
    this.conns.set(conn.peer, conn);
    const player = { id: conn.peer, name: String(name).slice(0, 14) || 'Bear' };
    this.players.push(player);
    this.sendLobby();
    this.emit('joined', player);
  }

  removeGuest(id) {
    if (!this.conns.delete(id)) return;
    const player = this.players.find((p) => p.id === id);
    this.players = this.players.filter((p) => p.id !== id);
    this.sendLobby();
    this.emit('left', player);
  }

  sendLobby() {
    this.broadcast({ t: 'lobby', players: this.players, roundMinutes: this.roundMinutes, inGame: this.inGame });
    this.emit('lobby');
  }

  setRoundMinutes(minutes) {
    this.roundMinutes = minutes;
    this.sendLobby();
  }

  broadcast(msg) {
    this.conns.forEach((conn) => conn.open && conn.send(msg));
  }

  sendTo(id, msg) {
    const conn = this.conns.get(id);
    if (conn?.open) conn.send(msg);
  }

  // ---- guest ----

  async join(code, name) {
    const peer = await openPeer();
    this.reset();
    this.peer = peer;
    this.id = peer.id;
    return new Promise((resolve, reject) => {
      const fail = (message) => {
        clearTimeout(timer);
        peer.destroy();
        this.reset();
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail("Couldn't connect to that lobby. Check the code and try again."), JOIN_TIMEOUT_MS);
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') fail('No lobby with that code.');
      });

      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      conn.on('open', () => conn.send({ t: 'hello', name }));
      conn.on('data', (msg) => {
        if (msg.t === 'full') {
          fail('That lobby is full.');
          return;
        }
        if (msg.t === 'lobby') {
          this.players = msg.players;
          this.roundMinutes = msg.roundMinutes;
          this.inGame = msg.inGame;
          if (!this.role) {
            clearTimeout(timer);
            this.role = 'guest';
            this.code = code;
            this.hostConn = conn;
            resolve(code);
          }
          this.emit('lobby');
          return;
        }
        this.emit(msg.t, msg);
      });
      conn.on('close', () => {
        if (this.role === 'guest' && !this.leaving) this.emit('hostGone');
      });
    });
  }

  send(msg) {
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  // ---- both ----

  leave() {
    if (!this.peer) return;
    this.leaving = true;
    this.peer.destroy();
    this.reset();
  }
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const onError = (err) => {
      peer.destroy();
      reject(err);
    };
    peer.once('error', onError);
    peer.once('open', () => {
      peer.off('error', onError);
      peer.on('error', () => {}); // later errors are handled by whoever owns the peer
      resolve(peer);
    });
  });
}

export const net = new Net();
