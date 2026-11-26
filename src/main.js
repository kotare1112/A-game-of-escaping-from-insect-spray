import { Game } from './game/game.js';
import { CONFIG } from './game/config.js';

const game = new Game(document.getElementById('app'));
game.load().catch((err) => {
  console.error(err);
  const el = document.querySelector('#overlay-loading p');
  if (el) el.textContent = '読み込みに失敗しました。再読み込みしてください。';
});

// 開発時のみ：ブラウザのコンソールから調整・確認できるようにする
if (import.meta.env.DEV) Object.assign(window, { __game: game, __CONFIG: CONFIG });
