export class Camera {
  constructor(viewportW, viewportH, worldW, worldH) {
    this.viewportW = viewportW; // 800
    this.viewportH = viewportH; // 450
    this.worldW = worldW;
    this.worldH = worldH;

    this.x = 0;
    this.y = 0;
    this.renderX = 0;
    this.renderY = 0;

    // 1. Мертвая зона (Deadzone): коридор 90px (по 45px влево и вправо от якоря focusX)
    this.focusX = viewportW / 2;
    this.deadzoneHalfW = 45;

    // 2. Опережение (Look-ahead): 120px вперед по направлению движения!
    // Важно: lookDir СОХРАНЯЕТСЯ после остановки игрока, чтобы камера не откатывалась назад!
    this.lookDir = 1; // 1 — смотрим вправо, -1 — смотрим влево
    this.lookAheadX = 120;
    this.maxLookAhead = 120;

    this.targetX = 0;
  }

  setWorldSize(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;
  }

  /**
   * Мгновенная фокусировка камеры при старте уровня или возрождении на чекпоинте
   */
  snapTo(targetCenterX, facing = 1) {
    this.focusX = targetCenterX;
    this.lookDir = facing >= 0 ? 1 : -1;
    this.lookAheadX = this.lookDir * this.maxLookAhead;

    const desiredX = (this.focusX + this.lookAheadX) - this.viewportW / 2;
    this.targetX = this.clamp(desiredX, 0, Math.max(0, this.worldW - this.viewportW));
    this.x = this.targetX;
    this.renderX = Math.round(this.x);
  }

  clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  update(dt, player) {
    const playerCenterX = player.x + player.w / 2;

    // ПРИНЦИП 1: Мертвая зона (Deadzone)
    // Пока игрок двигается внутри [focusX - 45, focusX + 45], якорь focusX и направление lookDir НЕ меняются
    const leftBound = this.focusX - this.deadzoneHalfW;
    const rightBound = this.focusX + this.deadzoneHalfW;

    if (playerCenterX > rightBound) {
      // Игрок толкает правую границу Deadzone -> смещаем якорь и закрепляем взгляд ВПРАВО (+1)
      this.focusX = playerCenterX - this.deadzoneHalfW;
      this.lookDir = 1;
    } else if (playerCenterX < leftBound) {
      // Игрок толкает левую границу Deadzone -> смещаем якорь и закрепляем взгляд ВЛЕВО (-1)
      this.focusX = playerCenterX + this.deadzoneHalfW;
      this.lookDir = -1;
    } else if (Math.abs(player.vx) > 20) {
      // Плавный разворот взгляда камеры, если игрок активно бежит внутри зоны
      this.lookDir = player.facing;
    }

    // ПРИНЦИП 2: Постоянное Опережение (Persistent Look-ahead)
    // Даже когда игрок остановился (vx === 0), desiredLookAhead остается равным lookDir * 120!
    // Итог: при движении вправо и после остановки камера смещена на (-45 + 120 = +75px) ВПРАВО от героя,
    // а при движении влево и после остановки — на (+45 - 120 = -75px) ВЛЕВО от героя!
    const desiredLookAhead = this.lookDir * this.maxLookAhead;
    const lookSmooth = 1 - Math.exp(-6.0 * dt);
    this.lookAheadX += (desiredLookAhead - this.lookAheadX) * lookSmooth;

    // ПРИНЦИП 3: Жесткие границы уровня (Clamping)
    const desiredCameraX = (this.focusX + this.lookAheadX) - this.viewportW / 2;
    this.targetX = this.clamp(desiredCameraX, 0, Math.max(0, this.worldW - this.viewportW));

    // ПРИНЦИП 4: Плавное слежение (Lerp / Damp) по экспоненте времени кадра dt
    const dampSpeed = player.isDashing ? 12.0 : 7.0;
    const dampFactor = 1 - Math.exp(-dampSpeed * dt);
    this.x += (this.targetX - this.x) * dampFactor;

    // ПРИНЦИП 5: Ортографическая целочисленная привязка для четкости пикселей
    this.renderX = Math.round(this.x);
  }

  apply(ctx) {
    ctx.save();
    ctx.translate(-this.renderX, -this.renderY);
  }

  restore(ctx) {
    ctx.restore();
  }

  drawDebug(ctx) {
    ctx.save();

    const dzLeftScreen = (this.focusX - this.deadzoneHalfW) - this.renderX;
    const dzWidth = this.deadzoneHalfW * 2;

    ctx.strokeStyle = 'rgba(82, 183, 136, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(dzLeftScreen, 55, dzWidth, this.viewportH - 95);

    const lookScreenX = (this.focusX + this.lookAheadX) - this.renderX;
    ctx.strokeStyle = '#00f5d4';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lookScreenX, 65);
    ctx.lineTo(lookScreenX, this.viewportH - 55);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(dzLeftScreen - 15, 56, dzWidth + 30, 20);
    ctx.fillStyle = '#80ed99';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`DEADZONE (${dzWidth}px)`, dzLeftScreen + dzWidth / 2, 70);

    ctx.restore();
  }
}