import { net } from './lobby.js';

const WORKER = `setInterval(() => postMessage(0), 33);`;

// Browsers stop drawing hidden tabs, which would freeze the game for everyone if the host
// switched tabs. Web Worker timers keep running, so while online and hidden they drive the game.
export function startBackgroundTicker(game) {
  const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
  const worker = new Worker(url);
  let last = performance.now();
  worker.onmessage = () => {
    const now = performance.now();
    const delta = Math.min(now - last, 100);
    last = now;
    if (net.online && document.hidden) game.step(now, delta);
  };
}
