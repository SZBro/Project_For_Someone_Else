import { CONFIG } from '../config.js';
import { audio } from '../audio.js';
import { net } from './lobby.js';

const el = (id) => document.getElementById(id);

// Everything outside the game itself: the start screen's online buttons, the lobby card,
// and moving everyone between the lobby and a round.
export function initLobbyUi(game) {
  const gameScene = () => game.scene.getScene('Game');

  const select = el('round-minutes');
  CONFIG.online.roundMinuteOptions.forEach((m) => {
    const option = document.createElement('option');
    option.value = m;
    option.textContent = `${m} minutes`;
    select.appendChild(option);
  });
  select.onchange = () => net.setRoundMinutes(Number(select.value));

  el('start-round').onclick = () => {
    el('lobby').hidden = true;
    net.inGame = true;
    net.sendLobby();
    net.broadcast({ t: 'start', roundMinutes: net.roundMinutes });
    gameScene().scene.restart({ started: true });
  };
  el('leave-lobby').onclick = () => leaveToMenu(game);
  el('copy-link').onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      el('copy-link').textContent = 'Copied!';
      setTimeout(() => (el('copy-link').textContent = 'Copy invite link'), 1500);
    } catch {
      el('lobby-status').textContent = `Share this link: ${inviteLink()}`;
    }
  };

  net.on('lobby', renderLobby);

  // Guests: the host started or ended a round.
  net.on('start', () => {
    if (net.role !== 'guest') return;
    el('lobby').hidden = true;
    game.scene.stop('End');
    game.scene.stop('UI');
    game.scene.stop('Pause');
    gameScene().scene.restart({ started: true });
  });
  net.on('snap', (snap) => gameScene().onSnapshot?.(snap));
  net.on('end', ({ results }) => gameScene().showResults(results));
  net.on('back', () => returnToLobby(game));
  net.on('hostGone', () => {
    net.leave();
    leaveToMenu(game, 'The host left the game.');
  });

  // Host: players coming and going during a round.
  net.on('joined', (player) => gameScene().onPlayerJoined(player));
  net.on('left', (player) => gameScene().onPlayerLeft(player));
  net.on('input', ({ id, msg }) => gameScene().onGuestInput(id, msg));

  const joinCode = new URLSearchParams(location.search).get('join');
  if (joinCode) el('join-code').value = joinCode.toUpperCase();
}

function inviteLink() {
  return `${location.origin}${location.pathname}?join=${net.code}`;
}

// The start screen's Host and Join buttons.
export function bindMenuButtons(getName) {
  const error = el('menu-error');
  const busy = (on) => {
    el('host').disabled = on;
    el('join').disabled = on;
    error.textContent = on ? 'Connecting…' : '';
  };
  const enter = async (connect) => {
    busy(true);
    try {
      audio.unlock();
      await connect();
      busy(false);
      showLobby();
    } catch (err) {
      busy(false);
      error.textContent = friendlyError(err);
    }
  };

  el('host').onclick = () => enter(() => net.host(getName()));
  const join = () => {
    const code = el('join-code').value.trim().toUpperCase();
    if (code.length !== 4) {
      error.textContent = 'Enter the 4-letter lobby code.';
      return;
    }
    enter(() => net.join(code, getName()));
  };
  el('join').onclick = join;
  // Block body on purpose: an on* handler that returns false cancels the keystroke.
  el('join-code').onkeydown = (e) => {
    if (e.key === 'Enter') join();
  };
}

function friendlyError(err) {
  if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
    return "Couldn't reach the connection service. Check your internet and try again.";
  }
  if (err.type === 'browser-incompatible') return "This browser doesn't support online play.";
  return err.message || 'Something went wrong. Please try again.';
}

export function showLobby() {
  el('menu').hidden = true;
  el('lobby').hidden = false;
  renderLobby();
}

function renderLobby() {
  if (!net.online) return;
  const isHost = net.role === 'host';
  el('lobby-code').textContent = net.code;
  el('round-minutes').value = net.roundMinutes;
  el('round-minutes').disabled = !isHost;
  el('start-round').hidden = !isHost;
  el('lobby-status').textContent = isHost
    ? `Keep this page open: your browser runs the game. NPC bears fill any empty spots.`
    : net.inGame
      ? 'A round is in progress, joining…'
      : 'Waiting for the host to start…';

  const list = el('lobby-players');
  list.replaceChildren(
    ...net.players.map((p, i) => {
      const li = document.createElement('li');
      li.textContent = `${p.name}${i === 0 ? ' (host)' : ''}${p.id === net.id ? ' (you)' : ''}`;
      return li;
    }),
  );
}

// Everyone back to the lobby card after a round.
export function returnToLobby(game) {
  game.scene.stop('End');
  game.scene.stop('UI');
  game.scene.stop('Pause');
  game.scene.getScene('Game').scene.restart({ started: false });
}

export function leaveToMenu(game, message = '') {
  net.leave();
  el('lobby').hidden = true;
  el('menu-error').textContent = message;
  game.scene.stop('End');
  game.scene.stop('UI');
  game.scene.stop('Pause');
  game.scene.getScene('Game').scene.restart({ started: false });
}
