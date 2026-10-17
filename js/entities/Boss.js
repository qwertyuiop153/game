import { checkAABB } from '../core/collision.js';

export class Boss {
  constructor() {
    this.w = 42;
    this.h = 56;
    this.maxHp = 12;
    this.reset();
  }

  reset() {
    this.x = 920;
    this.y = 334;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;

    this.hp = this.maxHp;
    this.hurtTimer = 0;
    this.hitsTakenInCombo = 0;

    // Состояния FSM (Конечного автомата Босса):
    // 'PATROL_SLASH'   — Базовое сближение и выпад клинком
    // 'SHIELD_COUNTER' — МЕХАНИКА 1: Непробиваемый щит после 2 ударов + напольная взрывная волна
    // 'AIR_SWOOP'      — МЕХАНИКА 2: Прыжок под своды зала + веер кровавых сфер (уязвим для Pogo сверху!)
    // 'PILLAR_RITUAL'  — МЕХАНИКА 3: Призыв 4 огненных колонн из пола + спаун Кристалла Крови на платформе
    // 'STUNNED'        — Оглушен после разрушения Кристалла Крови (открыт для серии ударов!)
    this.state = 'PATROL_SLASH';
    this.stateTimer = 2.8;
    this.cycleIndex = 0;

    // Снаряды и опасные зоны, порождаемые Боссом
    this.projectiles = [];   // Кровавые сферы и напольные взрывные волны
    this.pillars = [];       // Огненные колонны в фазе ритуала
    this.bloodCrystal = null; // Уязвимый тотем на платформе в фазе ритуала

    this.animTimer = 0;
  }

  get isShielded() {
    return this.state === 'SHIELD_COUNTER' || this.state === 'PILLAR_RITUAL';
  }

  getPhaseLabel() {
    switch (this.state) {
      case 'SHIELD_COUNTER':
        return '🛡 МЕХАНИКА 1: КРОВАВЫЙ КОНТР-ЩИТ (НЕ БЕЙ В ЛОБ — УХОДИ ОТ ВОЛНЫ!)';
      case 'AIR_SWOOP':
        return '🦇 МЕХАНИКА 2: НАЛЕТ НЕТОПЫРЯ (ОТБИВАЙ СФЕРЫ / POGO-УДАР СВЕРХУ!)';
      case 'PILLAR_RITUAL':
        return '🔥 МЕХАНИКА 3: РИТУАЛ КОЛОНН (РАЗБЕЙ КРИСТАЛЛ КРОВИ НА ПЛАТФОРМЕ!)';
      case 'STUNNED':
        return '💫 БОСС ОГЛУШЕН! АТАКУЙ МЕЧОМ!';
      default:
        return '⚔ ДУЭЛЬ НА КЛИНКАХ (ПОСЛЕ 2 УДАРОВ БОСС ВКЛЮЧИТ ЗАЩИТУ)';
    }
  }

  /**
   * Обработка попадания меча игрока по Боссу
   * Возвращает: 'DAMAGED' | 'BLOCKED' | 'IGNORED'
   */
  takeSwordHit(attackDir) {
    if (this.hurtTimer > 0 || this.hp <= 0) return 'IGNORED';

    // Если активен Контр-Щит или Ритуал — обычные удары блокируются!
    if (this.isShielded) {
      this.hurtTimer = 0.25;
      return 'BLOCKED';
    }

    // Удар в прыжке сверху вниз (Pogo-slash) по боссу наносит повышенный урон!
    const damage = (attackDir === 'DOWN' || this.state === 'STUNNED') ? 2 : 1;
    this.hp = Math.max(0, this.hp - damage);
    this.hurtTimer = 0.38;
    this.hitsTakenInCombo++;

    // ЗАЩИТА ОТ ЗАКЛИКИВАНИЯ: После 2 пропущенных ударов подряд Босс включает Механику 1 (Контр-Щит)!
    if (this.state === 'PATROL_SLASH' && this.hitsTakenInCombo >= 2 && this.hp > 0) {
      this.enterShieldCounter();
    }

    return 'DAMAGED';
  }

  enterShieldCounter() {
    this.state = 'SHIELD_COUNTER';
    this.stateTimer = 1.9;
    this.hitsTakenInCombo = 0;
    this.vx = 0;
    this.shockwaveFired = false;
  }

  enterAirSwoop(player) {
    this.state = 'AIR_SWOOP';
    this.stateTimer = 3.4;
    this.hitsTakenInCombo = 0;
    this.orbShotCount = 0;
    // Взлетаем на среднюю высоту зала для воздушного боя
    this.y = 195;
    this.vx = player.x < this.x ? -240 : 240;
    this.facing = this.vx > 0 ? 1 : -1;
  }

  enterPillarRitual() {
    this.state = 'PILLAR_RITUAL';
    this.stateTimer = 5.5;
    this.hitsTakenInCombo = 0;
    this.vx = 0;
    // Телепортируемся к центру Тронного зала
    this.x = 620;
    this.y = 334;

    // Создаем 4 вертикальные колонны пламени (сначала 1.1 сек предупреждение, затем 1.8 сек огонь)
    this.pillars = [
      { x: 230, w: 48, timer: 2.9, warnTime: 1.1 },
      { x: 470, w: 48, timer: 2.9, warnTime: 1.1 },
      { x: 750, w: 48, timer: 2.9, warnTime: 1.1 },
      { x: 990, w: 48, timer: 2.9, warnTime: 1.1 }
    ];

    // Спауним Кристалл Крови на одной из верхних боковых платформ
    const crystalSpots = [
      { x: 310, y: 158 },
      { x: 930, y: 158 }
    ];
    const spot = crystalSpots[Math.floor(Math.random() * crystalSpots.length)];
    this.bloodCrystal = {
      x: spot.x,
      y: spot.y,
      w: 28,
      h: 36,
      active: true
    };
  }

  update(dt, player, sound) {
    if (this.hp <= 0) return;

    this.animTimer += dt;
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.stateTimer -= dt;

    // 1. Логика активного состояния Босса
    if (this.state === 'PATROL_SLASH') {
      const dir = player.x < this.x ? -1 : 1;
      this.facing = dir;
      this.vx = dir * 135;
      this.x += this.vx * dt;
      this.y = 334;

      if (this.stateTimer <= 0) {
        this.cycleIndex = (this.cycleIndex + 1) % 3;
        if (this.cycleIndex === 1) {
          this.enterAirSwoop(player);
        } else if (this.cycleIndex === 2) {
          this.enterPillarRitual();
        } else {
          this.enterShieldCounter();
        }
      }
    } else if (this.state === 'SHIELD_COUNTER') {
      // МЕХАНИКА 1: Зарядка щита (0.9 сек) -> Выпуск двух напольных ударных волн влево и вправо
      if (this.stateTimer <= 1.0 && !this.shockwaveFired) {
        this.shockwaveFired = true;
        sound.playBossShockwave();
        // Две волны, идущие по полу к краям зала (нужно перепрыгнуть или уйти на платформу)
        this.projectiles.push(
          { x: this.x - 16, y: 362, w: 28, h: 28, vx: -360, type: 'wave', life: 2.5 },
          { x: this.x + this.w - 12, y: 362, w: 28, h: 28, vx: 360, type: 'wave', life: 2.5 }
        );
      }

      if (this.stateTimer <= 0) {
        this.state = 'PATROL_SLASH';
        this.stateTimer = 2.6;
      }
    } else if (this.state === 'AIR_SWOOP') {
      // МЕХАНИКА 2: Полет над ареной и выпуск кровавых сфер (сферы можно рубить мечом!)
      this.x += this.vx * dt;
      this.y = 195 + Math.sin(this.animTimer * 6) * 28;

      if (this.x < 120) {
        this.x = 120;
        this.vx = 250;
        this.facing = 1;
      } else if (this.x > 1100) {
        this.x = 1100;
        this.vx = -250;
        this.facing = -1;
      }

      if (this.orbShotCount === 0 && this.stateTimer < 2.6) {
        this.orbShotCount = 1;
        this.spawnBloodOrb(player, sound);
      } else if (this.orbShotCount === 1 && this.stateTimer < 1.4) {
        this.orbShotCount = 2;
        this.spawnBloodOrb(player, sound);
      }

      if (this.stateTimer <= 0) {
        this.y = 334;
        this.state = 'PATROL_SLASH';
        this.stateTimer = 2.5;
      }
    } else if (this.state === 'PILLAR_RITUAL') {
      // МЕХАНИКА 3: Огненные колонны и защита Кристаллом Крови
      for (const p of this.pillars) {
        p.timer -= dt;
        if (p.warnTime > 0) {
          p.warnTime = Math.max(0, p.warnTime - dt);
          if (p.warnTime === 0) sound.playBossShockwave();
        }
      }
      this.pillars = this.pillars.filter((p) => p.timer > 0);

      if (this.stateTimer <= 0) {
        this.bloodCrystal = null;
        this.pillars = [];
        this.state = 'PATROL_SLASH';
        this.stateTimer = 2.5;
      }
    } else if (this.state === 'STUNNED') {
      // Босс оглушен после того, как игрок разбил Кристалл Крови!
      this.vx = 0;
      this.y = 334;
      if (this.stateTimer <= 0) {
        this.state = 'PATROL_SLASH';
        this.stateTimer = 2.4;
      }
    }

    // 2. Обновление снарядов Босса
    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.life -= dt;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0 && p.x > 0 && p.x < 1280);

    // Ограничение Босса внутри стен Тронного Зала
    this.x = Math.max(60, Math.min(this.x, 1220 - this.w));
  }

  spawnBloodOrb(player, sound) {
    sound.playSwing();
    const dir = player.x < this.x ? -1 : 1;
    this.projectiles.push({
      x: this.x + this.w / 2,
      y: this.y + 22,
      w: 20,
      h: 20,
      vx: dir * 290,
      type: 'orb',
      life: 3.2
    });
  }

  /**
   * Проверка ударов меча игрока по снарядам и Кристаллу Крови
   */
  checkSwordInteractions(swordBox, sound) {
    if (!swordBox) return false;
    let hitSomething = false;

    // Игрок может сбивать Кровавые Сферы ударом меча!
    for (const proj of this.projectiles) {
      if (proj.type === 'orb' && checkAABB(swordBox, proj)) {
        proj.life = 0;
        hitSomething = true;
      }
    }

    // Если игрок разбивает Кристалл Крови в 3-й фазе — ритуал прерывается, и Босс оглушается!
    if (this.bloodCrystal && this.bloodCrystal.active && checkAABB(swordBox, this.bloodCrystal)) {
      this.bloodCrystal.active = false;
      this.bloodCrystal = null;
      this.pillars = [];
      this.state = 'STUNNED';
      this.stateTimer = 3.0;
      this.hp = Math.max(0, this.hp - 1);
      sound.playPickup();
      hitSomething = true;
    }

    return hitSomething;
  }

  draw(ctx) {
    if (this.hp <= 0) return;
    ctx.save();

    // 1. Отрисовка Огненных Колонн (Механика 3)
    for (const p of this.pillars) {
      if (p.warnTime > 0) {
        // Желтая предупреждающая разметка на полу перед взрывом колонны
        ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
        ctx.fillRect(p.x, 80, p.w, 310);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(p.x, 382, p.w, 8);
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ ОПАСНО', p.x + p.w / 2, 370);
      } else {
        // Активный столб адского пламени
        ctx.fillStyle = '#e6193c';
        ctx.fillRect(p.x + 4, 70, p.w - 8, 320);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(p.x + 14, 70, p.w - 28, 320);
      }
    }

    // 2. Отрисовка Кристалла Крови на платформе (Механика 3)
    if (this.bloodCrystal && this.bloodCrystal.active) {
      const c = this.bloodCrystal;
      ctx.fillStyle = 'rgba(0, 245, 212, 0.25)';
      ctx.fillRect(c.x - 6, c.y - 6, c.w + 12, c.h + 12);
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(c.x + 4, c.y, c.w - 8, c.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x + 10, c.y + 8, c.w - 20, c.h - 16);

      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚔ РАЗБЕЙ КРИСТАЛЛ!', c.x + c.w / 2, c.y - 10);
    }

    // 3. Отрисовка снарядов и взрывных волн
    for (const proj of this.projectiles) {
      if (proj.type === 'wave') {
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(proj.x, proj.y, proj.w, proj.h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(proj.x + 6, proj.y + 6, proj.w - 12, proj.h - 12);
      } else {
        ctx.fillStyle = '#ff0a54';
        ctx.fillRect(proj.x, proj.y, proj.w, proj.h);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(proj.x + 5, proj.y + 5, 10, 10);
      }
    }

    // 4. Отрисовка самого Архивампира Ксавьера
    const bx = Math.round(this.x);
    const by = Math.round(this.y);

    // Купол Контр-Щита (если активна Механика 1 или 3)
    if (this.isShielded) {
      ctx.fillStyle = 'rgba(0, 245, 212, 0.28)';
      ctx.fillRect(bx - 12, by - 10, this.w + 24, this.h + 16);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 12, by - 10, this.w + 24, this.h + 16);
    }

    // Мигание при получении урона
    const isFlashing = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 25) % 2 === 0;

    // Королевская мантия Босса
    ctx.fillStyle = isFlashing ? '#ffffff' : (this.state === 'STUNNED' ? '#5c677d' : '#6a040f');
    ctx.fillRect(bx - 6, by + 12, this.w + 12, this.h - 12);

    // Доспех Босса
    ctx.fillStyle = isFlashing ? '#ffd166' : '#2b193d';
    ctx.fillRect(bx + 4, by + 14, this.w - 8, 32);

    // Голова и золотая корона узурпатора
    ctx.fillStyle = '#e0dce8';
    ctx.fillRect(bx + 9, by + 2, 24, 14);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(bx + 7, by - 4, 28, 6);

    // Глаза
    ctx.fillStyle = '#00f5d4';
    const eyeX = this.facing === 1 ? bx + 22 : bx + 12;
    ctx.fillRect(eyeX, by + 7, 4, 4);

    // Надпись статуса над головой Босса
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    if (this.isShielded) {
      ctx.fillStyle = '#00f5d4';
      ctx.fillText('🛡 ЩИТ АКТИВЕН!', bx + this.w / 2, by - 16);
    } else if (this.state === 'STUNNED') {
      ctx.fillStyle = '#ffd166';
      ctx.fillText('💫 ОГЛУШЕН (УРОН x2)!', bx + this.w / 2, by - 16);
    } else if (this.state === 'AIR_SWOOP') {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText('⬇ УДАРЬ СВЕРХУ [S+J]', bx + this.w / 2, by - 16);
    }

    ctx.restore();
  }
}