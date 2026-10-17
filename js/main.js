import { InputHandler } from './core/input.js';
import { SoundManager } from './core/SoundManager.js';
import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const input = new InputHandler();
  const sound = new SoundManager();
  const game = new Game(canvas, input, sound);

  // Разблокировка Web Audio API при первом клике или нажатии клавиши (требование браузеров)
  const unlockAudioOnce = () => {
    game.unlockAudioAndMusic();
  };
  window.addEventListener('keydown', unlockAudioOnce, { once: true });
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // Кнопка Старт / Продолжить
  document.getElementById('btn-start').addEventListener('click', () => {
    game.startOrResume();
  });

  // Кнопка Пауза
  document.getElementById('btn-pause').addEventListener('click', () => {
    game.togglePause();
  });

  // Кнопка Рестарт (возрождает на активном чекпоинте или сбрасывает уровень)
  document.getElementById('btn-restart').addEventListener('click', () => {
    game.restartFromCheckpoint();
  });

  // Кнопка Включения / Отключения звука
  document.getElementById('btn-mute').addEventListener('click', () => {
    game.toggleMute();
  });

  // Горячая клавиша [M] для быстрого отключения звука
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      game.toggleMute();
    }
  });

  // Переключатель визуальной отладки 2D-камеры и хитбокса меча
  document.getElementById('btn-cam-debug').addEventListener('click', () => {
    game.toggleDebug();
  });

  // Запускаем единственный экземпляр игрового цикла
  game.startLoop();
});