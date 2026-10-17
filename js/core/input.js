export class InputHandler {
  constructor() {
    // Текущее состояние удерживаемых клавиш
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      attack: false,
      dash: false
    };

    // Одноразовые нажатия (Edge-triggered) для удара мечом, чтобы меч не махал бесконечно при зажатии
    this.justPressed = {
      attack: false
    };

    this.keyMap = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      Space: 'jump',
      KeyJ: 'attack',
      KeyZ: 'attack',
      KeyK: 'attack',
      ShiftLeft: 'dash',
      ShiftRight: 'dash',
      KeyE: 'dash'
    };

    this.initKeyboard();
    this.initTouchButtons();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      const action = this.keyMap[e.code];
      if (!action) return;

      // Запрещаем браузеру прокручивать страницу стрелками или пробелом
      e.preventDefault();

      if (action === 'attack' && !this.keys.attack) {
        this.justPressed.attack = true;
      }

      this.keys[action] = true;

      // По ТЗ клавиша W и Стрелка Вверх также позволяют прыгать с опоры
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys.jump = true;
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const action = this.keyMap[e.code];
      if (!action) return;

      e.preventDefault();
      this.keys[action] = false;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys.jump = false;
      }
    }, { passive: false });
  }

  initTouchButtons() {
    const bindButton = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const setKey = (state, ev) => {
        if (ev) ev.preventDefault();
        if (action === 'attack' && state && !this.keys.attack) {
          this.justPressed.attack = true;
        }
        this.keys[action] = state;
        btn.classList.toggle('pressed', state);
      };

      // Pointer Events объединяют мышь и тачскрин смартфона
      btn.addEventListener('pointerdown', (e) => setKey(true, e));
      btn.addEventListener('pointerup', (e) => setKey(false, e));
      btn.addEventListener('pointerleave', (e) => setKey(false, e));
      btn.addEventListener('pointercancel', (e) => setKey(false, e));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    bindButton('touch-left', 'left');
    bindButton('touch-right', 'right');
    bindButton('touch-up', 'up');
    bindButton('touch-down', 'down');
    bindButton('touch-jump', 'jump');
    bindButton('touch-attack', 'attack');
    bindButton('touch-dash', 'dash');
  }

  consumeAttackPress() {
    const pressed = this.justPressed.attack;
    this.justPressed.attack = false;
    return pressed;
  }

  clearKeys() {
    Object.keys(this.keys).forEach((k) => {
      this.keys[k] = false;
    });
    this.justPressed.attack = false;

    document.querySelectorAll('.touch-btn.pressed').forEach((btn) => {
      btn.classList.remove('pressed');
    });
  }
}