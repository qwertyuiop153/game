export class Player {
  constructor(startX, startY) {
    this.w = 26;
    this.h = 38;
    this.maxHp = 3;
    this.hp = 3;
    this.invincibleTimer = 0;

    this.spawnX = startX;
    this.spawnY = startY;
    this.hasSword = false;
    this.resetToSpawn(startX, startY, false);
  }

  resetToSpawn(spawnX, spawnY, keepSword = false, keepRelics = false) {
    this.x = spawnX;
    this.y = spawnY;
    this.prevX = spawnX;
    this.prevY = spawnY;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.hp = this.maxHp;
    this.invincibleTimer = 0;
    this.hasSword = keepSword;

    if (!keepRelics) {
      this.relics = {
        chalice: false,
        cloak: false,
        ring: false
      };
    }

    this.baseSpeed = 205;
    this.baseJumpForce = -435;
    this.gravity = 980;
    this.maxFallSpeed = 620;

    this.attackTimer = 0;
    this.attackDuration = 0.16;
    this.attackCooldown = 0;
    this.attackDir = 'RIGHT';
    this.pogoTriggeredThisSwing = false;
    this.hitSoundPlayedThisSwing = false;

    this.justJumped = false;
    this.justSwung = false;

    this.dashTimeLeft = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0.18;
    this.dashSpeed = 540;

    this.animTimer = 0;
  }

  get moveSpeed() {
    return this.relics.chalice ? 255 : this.baseSpeed;
  }

  get jumpForce() {
    return this.relics.chalice ? -510 : this.baseJumpForce;
  }

  get isDashing() {
    return this.dashTimeLeft > 0;
  }

  get isAttacking() {
    return this.attackTimer > 0;
  }

  takeDamage(amount = 1) {
    if (this.invincibleTimer > 0 || this.isDashing) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTimer = 1.15;
    this.vy = -260;
    return true;
  }

  getSwordHitbox() {
    if (!this.isAttacking || !this.hasSword) return null;

    switch (this.attackDir) {
      case 'UP':
        return { x: this.x - 10, y: this.y - 36, w: this.w + 20, h: 36 };
      case 'DOWN':
        return { x: this.x - 8, y: this.y + this.h, w: this.w + 16, h: 34 };
      case 'LEFT':
        return { x: this.x - 38, y: this.y + 2, w: 38, h: this.h - 6 };
      case 'RIGHT':
      default:
        return { x: this.x + this.w, y: this.y + 2, w: 38, h: this.h - 6 };
    }
  }

  triggerPogoBounce() {
    if (!this.pogoTriggeredThisSwing) {
      this.vy = -455;
      this.pogoTriggeredThisSwing = true;
    }
  }

  update(dt, input, worldWidth) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.animTimer += dt;

    this.justJumped = false;
    this.justSwung = false;

    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }

    const keys = input.keys;

    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    if (keys.left && !keys.right) this.facing = -1;
    if (keys.right && !keys.left) this.facing = 1;

    const attackPressed = input.consumeAttackPress();
    if (this.hasSword && attackPressed && this.attackCooldown === 0) {
      this.attackTimer = this.attackDuration;
      this.attackCooldown = 0.26;
      this.pogoTriggeredThisSwing = false;
      this.hitSoundPlayedThisSwing = false;
      this.justSwung = true;

      if (!this.onGround && keys.down) {
        this.attackDir = 'DOWN';
      } else if (keys.up) {
        this.attackDir = 'UP';
      } else {
        this.attackDir = this.facing === 1 ? 'RIGHT' : 'LEFT';
      }
    }

    if (this.relics.cloak && keys.dash && this.dashCooldown === 0 && this.dashTimeLeft === 0) {
      this.dashTimeLeft = this.dashDuration;
      this.dashCooldown = 0.65;
      this.justSwung = true;
    }

    if (this.dashTimeLeft > 0) {
      this.dashTimeLeft = Math.max(0, this.dashTimeLeft - dt);
      this.vx = this.facing * this.dashSpeed;
      this.vy = 0;
    } else {
      if (keys.left && !keys.right) {
        this.vx = -this.moveSpeed;
      } else if (keys.right && !keys.left) {
        this.vx = this.moveSpeed;
      } else {
        this.vx = 0;
      }

      if (keys.jump && this.onGround) {
        this.vy = this.jumpForce;
        this.onGround = false;
        this.justJumped = true;
      }

      this.vy += this.gravity * dt;
      if (this.vy > this.maxFallSpeed) {
        this.vy = this.maxFallSpeed;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.onGround = false;

    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x + this.w > worldWidth) {
      this.x = worldWidth - this.w;
      this.vx = 0;
    }
  }

  draw(ctx, debugMode = false) {
    ctx.save();

    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    const px = Math.round(this.x);
    const py = Math.round(this.y);

    if (this.isDashing) {
      ctx.fillStyle = 'rgba(157, 78, 221, 0.45)';
      ctx.fillRect(px - this.facing * 16, py + 4, this.w, this.h - 8);
      ctx.fillStyle = 'rgba(224, 170, 255, 0.75)';
      ctx.fillRect(px - this.facing * 8, py + 2, this.w, this.h - 4);
    }

    // Плащ
    ctx.fillStyle = this.relics.cloak ? '#8a1c4a' : '#2b1d2e';
    if (this.facing === 1) {
      ctx.fillRect(px - 5, py + 10, 12, 24);
    } else {
      ctx.fillRect(px + this.w - 7, py + 10, 12, 24);
    }

    // Камзол
    ctx.fillStyle = '#181426';
    ctx.fillRect(px + 3, py + 12, 20, 20);

    // Медальон
    ctx.fillStyle = this.relics.ring ? '#ffd700' : '#d8d2e1';
    ctx.fillRect(px + 10, py + 14, 6, 8);

    // Лицо и волосы
    ctx.fillStyle = '#e2dce8';
    ctx.fillRect(px + 4, py + 2, 18, 12);
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(px + 3, py, 20, 4);

    // Глаза
    ctx.fillStyle = this.relics.chalice ? '#ff1e42' : '#b81d33';
    const eyeX = this.facing === 1 ? 14 : 6;
    ctx.fillRect(px + eyeX, py + 6, 3, 3);
    ctx.fillRect(px + eyeX + 4, py + 6, 3, 3);

    // Сапоги
    const step = (Math.abs(this.vx) > 10 && this.onGround) ? Math.sin(this.animTimer * 16) * 3 : 0;
    ctx.fillStyle = '#382c47';
    ctx.fillRect(px + 4, py + 32, 7, 6 + step);
    ctx.fillRect(px + 15, py + 32, 7, 6 - step);

    // Меч в руке в покое (гарда у кулака, клинок смотрит вперед)
    if (this.hasSword && !this.isAttacking) {
      if (this.facing === 1) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(px + this.w - 2, py + 14, 3, 10); // Гарда у руки
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(px + this.w + 1, py + 17, 11, 4); // Лезвие вперед
      } else {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(px - 1, py + 14, 3, 10);          // Гарда у руки
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(px - 12, py + 17, 11, 4);         // Лезвие вперед
      }
    }

    // Отрисовка удара мечом в 4 стороны: Гарда у руки -> Лезвие -> Острие + Дуга взмаха!
    if (this.isAttacking && this.hasSword) {
      this.drawSwordSlash(ctx, debugMode);
    }

    ctx.restore();
  }

  /**
   * Правильная 8-bit отрисовка меча (гардой к игроку, острием наружу + пиксельная дуга взмаха)
   */
  drawSwordSlash(ctx, debugMode) {
    const hb = this.getSwordHitbox();
    if (!hb) return;

    const hx = Math.round(hb.x);
    const hy = Math.round(hb.y);
    const hw = Math.round(hb.w);
    const hh = Math.round(hb.h);

    if (this.attackDir === 'RIGHT') {
      const cy = hy + Math.floor(hh / 2);

      // 1. Багровая пиксельная дуга взмаха на острие (вместо сплошного красного квадрата)
      ctx.fillStyle = 'rgba(230, 25, 60, 0.55)';
      ctx.fillRect(hx + 14, hy + 2, 16, 4);
      ctx.fillRect(hx + 24, hy + 6, 10, hh - 12);
      ctx.fillRect(hx + 14, hy + hh - 6, 16, 4);

      // 2. Рукоять с рубином и Золотая Гарда (СЛЕВА — прямо у руки игрока!)
      ctx.fillStyle = '#ff0a54';
      ctx.fillRect(hx, cy - 2, 4, 4);           // Рубин в навершии у кулака
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(hx + 4, cy - 10, 5, 20);     // Поперечная гарда у руки (правильная буква Т!)

      // 3. Стальное лезвие, тянущееся от гарды ВПРАВО и сужающееся к острию
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(hx + 9, cy - 4, 21, 8);      // Основное полотно клинка
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 9, cy - 2, 23, 4);      // Яркое центральное ребро
      ctx.fillRect(hx + 30, cy - 2, 5, 4);      // Сужение острия
      ctx.fillRect(hx + 35, cy - 1, 3, 2);      // Кончик острия меча
    } else if (this.attackDir === 'LEFT') {
      const cy = hy + Math.floor(hh / 2);
      const rightEdge = hx + hw;

      // 1. Багровая пиксельная дуга взмаха слева
      ctx.fillStyle = 'rgba(230, 25, 60, 0.55)';
      ctx.fillRect(hx + 8, hy + 2, 16, 4);
      ctx.fillRect(hx + 4, hy + 6, 10, hh - 12);
      ctx.fillRect(hx + 8, hy + hh - 6, 16, 4);

      // 2. Рукоять с рубином и Золотая Гарда (СПРАВА — прямо у руки игрока!)
      ctx.fillStyle = '#ff0a54';
      ctx.fillRect(rightEdge - 4, cy - 2, 4, 4);       // Рубин у кулака
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(rightEdge - 9, cy - 10, 5, 20);     // Поперечная гарда у руки

      // 3. Стальное лезвие, тянущееся ВЛЕВО к острию
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(hx + 8, cy - 4, 21, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 6, cy - 2, 23, 4);
      ctx.fillRect(hx + 3, cy - 2, 5, 4);              // Сужение острия
      ctx.fillRect(hx, cy - 1, 3, 2);                  // Кончик острия меча
    } else if (this.attackDir === 'UP') {
      const cx = hx + Math.floor(hw / 2);
      const bottomEdge = hy + hh;

      // 1. Багровая дуга взмаха над головой
      ctx.fillStyle = 'rgba(230, 25, 60, 0.55)';
      ctx.fillRect(hx + 4, hy + 6, 6, 14);
      ctx.fillRect(hx + 10, hy + 2, hw - 20, 8);
      ctx.fillRect(hx + hw - 10, hy + 6, 6, 14);

      // 2. Рукоять и Золотая Гарда (СНИЗУ — прямо над головой игрока!)
      ctx.fillStyle = '#ff0a54';
      ctx.fillRect(cx - 2, bottomEdge - 4, 4, 4);      // Рубин у рук
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(cx - 10, bottomEdge - 9, 20, 5);    // Горизонтальная гарда у головы

      // 3. Стальное лезвие, направленное ВВЕРХ к острию
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(cx - 4, hy + 8, 8, 19);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, hy + 6, 4, 21);
      ctx.fillRect(cx - 2, hy + 3, 4, 5);              // Сужение острия
      ctx.fillRect(cx - 1, hy, 2, 3);                  // Кончик острия вверх
    } else if (this.attackDir === 'DOWN') {
      const cx = hx + Math.floor(hw / 2);

      // 1. Багровая дуга взмаха под ногами (для Pogo-удара в прыжке)
      ctx.fillStyle = 'rgba(230, 25, 60, 0.55)';
      ctx.fillRect(hx + 4, hy + hh - 20, 6, 14);
      ctx.fillRect(hx + 10, hy + hh - 10, hw - 20, 8);
      ctx.fillRect(hx + hw - 10, hy + hh - 20, 6, 14);

      // 2. Рукоять и Золотая Гарда (СВЕРХУ — прямо под сапогами игрока!)
      ctx.fillStyle = '#ff0a54';
      ctx.fillRect(cx - 2, hy, 4, 4);                  // Рубин
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(cx - 10, hy + 4, 20, 5);            // Гарда у сапог

      // 3. Стальное лезвие, вонзающееся ВНИЗ острием
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(cx - 4, hy + 9, 8, 17);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, hy + 9, 4, 19);
      ctx.fillRect(cx - 2, hy + 26, 4, 5);             // Сужение острия
      ctx.fillRect(cx - 1, hy + 31, 2, 3);             // Кончик острия вниз
    }

    // Если включена кнопка "Камера: Инфо (Debug)", показываем точную зеленую рамку хитбокса
    if (debugMode) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, hw, hh);
    }
  }
}