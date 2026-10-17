export class Level {
  constructor() {
    this.currentLevel = 1; // 1 — Склеп/Вход/Холл, 2 — Тронный Зал (Босс)
    this.worldWidth = 3200;
    this.worldHeight = 450;

    this.cryptSpawn = { x: 85, y: 340 };
    this.entranceCheckpoint = { x: 760, y: 340, activated: false };
    this.throneSpawn = { x: 110, y: 340 };

    this.loadLevel1(false);
  }

  /**
   * Загрузка Уровня 1 (Склеп -> Вход в Поместье -> Главный Холл)
   */
  loadLevel1(keepCryptCleared = false) {
    this.currentLevel = 1;
    this.worldWidth = 3200;
    this.worldHeight = 450;

    this.swordPedestal = {
      x: 175,
      y: 340,
      w: 28,
      h: 50,
      taken: keepCryptCleared
    };

    this.cryptBarricade = {
      x: 640,
      y: 280,
      w: 26,
      h: 110,
      broken: keepCryptCleared
    };

    this.groundSegments = [
      { x: 0, y: 390, w: 1020, h: 60, zone: 'crypt_and_yard' },
      { x: 1190, y: 390, w: 690, h: 60, zone: 'entrance_and_hall' },
      { x: 2080, y: 390, w: 340, h: 60, zone: 'hall' },
      { x: 2680, y: 390, w: 520, h: 60, zone: 'hall' }
    ];

    this.platforms = [
      { id: 1, x: 420, y: 325, w: 115, h: 16 },
      { id: 2, x: 1035, y: 320, w: 140, h: 16 },
      { id: 3, x: 1710, y: 315, w: 135, h: 16 },
      { id: 4, x: 1920, y: 230, w: 130, h: 16 },
      { id: 5, x: 2130, y: 155, w: 155, h: 16 },
      { id: 6, x: 2730, y: 280, w: 150, h: 16 }
    ];

    this.items = [
      {
        id: 'chalice',
        name: 'Чаша Древней Крови',
        x: 1765,
        y: 282,
        w: 22,
        h: 26,
        collected: false,
        points: 150,
        lore: '🍷 ЧАША КРОВИ СОБРАНА! Прыжок увеличен на 25% — запрыгивай на люстру и верхнюю галерею!'
      },
      {
        id: 'cloak',
        name: 'Плащ Полуночного Тумана',
        x: 2195,
        y: 122,
        w: 24,
        h: 26,
        collected: false,
        points: 200,
        lore: '🦇 ПЛАЩ ТУМАНА ЭКИПИРОВАН! Нажми [SHIFT] или [E] для рывка над широкими пропастями!'
      },
      {
        id: 'ring',
        name: 'Перстень Печати Рода',
        x: 2795,
        y: 246,
        w: 20,
        h: 24,
        collected: false,
        points: 250,
        lore: '💍 ПЕРСТЕНЬ РОДА ПОЛУЧЕН! Врата Тронного зала открыты — войди в них для битвы с Боссом!'
      }
    ];

    this.targets = [
      { x: 350, y: 250, w: 24, h: 28, hit: false, points: 50, type: 'torch', hint: 'Удар ВВЕРХ [W + J]' },
      { x: 1970, y: 315, w: 28, h: 28, hit: false, points: 50, type: 'pogo', hint: 'Pogo ВНИЗ [S + J]' },
      { x: 2500, y: 310, w: 30, h: 30, hit: false, points: 75, type: 'pogo', hint: 'Pogo ВНИЗ [S + J]' },
      { x: 2605, y: 295, w: 30, h: 30, hit: false, points: 75, type: 'pogo', hint: 'Pogo ВНИЗ [S + J]' }
    ];

    this.hazards = [
      { x: 1020, y: 412, w: 170, h: 38, name: 'Ров с кольями перед Входом в поместье' },
      { x: 1880, y: 412, w: 200, h: 38, name: 'Кипящий чесночный котел сквоттеров' },
      { x: 2420, y: 412, w: 260, h: 38, name: 'Осиновые колья и солнечный луч в Холле' }
    ];

    this.finishDoor = {
      x: 3060,
      y: 310,
      w: 52,
      h: 80
    };
  }

  /**
   * Загрузка Уровня 2: Тронный Зал (Арена Босса шириной 1280px с 5 тактическими платформами)
   */
  loadLevel2() {
    this.currentLevel = 2;
    this.worldWidth = 1280;
    this.worldHeight = 450;

    this.groundSegments = [
      { x: 0, y: 390, w: 1280, h: 60, zone: 'throne_room' }
    ];

    // 5 платформ Тронного Зала для уклонения от волн и разрушения Кристаллов Крови
    this.platforms = [
      { id: 1, x: 150, y: 295, w: 130, h: 16 },
      { id: 2, x: 260, y: 195, w: 135, h: 16 },
      { id: 3, x: 560, y: 255, w: 160, h: 16 },
      { id: 4, x: 880, y: 195, w: 135, h: 16 },
      { id: 5, x: 990, y: 295, w: 130, h: 16 }
    ];

    this.items = [];
    this.targets = [];
    this.hazards = [];
    this.finishDoor = null;
  }
}