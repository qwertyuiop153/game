import { Player } from '../entities/Player.js';
import { Boss } from '../entities/Boss.js';
import { Level } from '../world/Level.js';
import { Camera } from './Camera.js';
import { checkAABB, resolvePlatformCollision } from './collision.js';

const STORAGE_KEY = 'castlevania_manor_best_v2';

export class Game {
  constructor(canvas, input, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sound = sound;

    this.viewportW = canvas.width;  // 800
    this.viewportH = canvas.height; // 450

    this.level = new Level();
    this.player = new Player(this.level.cryptSpawn.x, this.level.cryptSpawn.y);
    this.boss = new Boss();

    this.camera = new Camera(
      this.viewportW,
      this.viewportH,
      this.level.worldWidth,
      this.level.worldHeight
    );

    this.state = 'PLAYING';
    this.rafId = null;
    this.lastTime = 0;
    this.debugMode = false;

    this.score = 0;
    this.bestScore = this.loadBestScore();

    this.toastMessage = 'Пробуждение в Склепе... Подойди к пьедесталу справа и возьми свой Меч!';
    this.toastTimer = 8.0;

    this.camera.snapTo(this.player.x + this.player.w / 2, 1);
    this.bindSystemEvents();
    this.updateHUD();
  }

  bindSystemEvents() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.input.clearKeys();
        this.sound.stopMusic();
        if (this.state === 'PLAYING') {
          this.state = 'PAUSED';
          this.updateHUD();
        }
      }
    });

    window.addEventListener('blur', () => {
      this.input.clearKeys();
    });
  }

  unlockAudioAndMusic() {
    this.sound.init();
    if (this.state === 'PLAYING') {
      this.sound.startMusic();
    }
    this.updateHUD();
  }

  toggleMute() {
    const muted = this.sound.toggleMute();
    if (!muted && this.state === 'PLAYING') {
      this.sound.startMusic();
    }
    this.updateHUD();
  }

  loadBestScore() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  saveBestScore(newScore) {
    if (newScore > this.bestScore) {
      this.bestScore = newScore;
      try {
        localStorage.setItem(STORAGE_KEY, String(this.bestScore));
      } catch {
        // Ignore storage errors
      }
    }
  }

  startLoop() {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();

    const loop = (now) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  startOrResume() {
    this.sound.init();
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.sound.startMusic();
      this.lastTime = performance.now();
    } else if (this.state === 'WIN' || this.state === 'GAMEOVER') {
      this.restartFromCheckpoint();
      return;
    } else {
      this.sound.startMusic();
    }
    this.lastTime = performance.now();
    this.updateHUD();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.input.clearKeys();
      this.sound.stopMusic();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.sound.startMusic();
      this.lastTime = performance.now();
    }
    this.updateHUD();
  }

  toggleDebug() {
    this.debugMode = !this.debugMode;
  }

  /**
   * Переход во 2-й уровень (Тронный Зал — Битва с Боссом)
   */
  enterLevel2BossArena() {
    this.level.loadLevel2();
    this.boss.reset();
    this.player.resetToSpawn(this.level.throneSpawn.x, this.level.throneSpawn.y, true, true);
    this.camera.setWorldSize(this.level.worldWidth, this.level.worldHeight);
    this.camera.snapTo(this.player.x + this.player.w / 2, 1);

    this.sound.playPickup();
    this.showToast('⚔ УРОВЕНЬ 2: ТРОННЫЙ ЗАЛ! Срази Архивампира Ксавьера (изучай его 3 механики)!', 6.5);
    this.updateHUD();
  }

  restartFromCheckpoint() {
    this.input.clearKeys();
    this.sound.init();

    // Если игрок уже победил Босса (WIN), начинаем новую игру с Уровня 1 (Склеп)
    if (this.state === 'WIN') {
      this.level.entranceCheckpoint.activated = false;
      this.level.loadLevel1(false);
      this.player.resetToSpawn(this.level.cryptSpawn.x, this.level.cryptSpawn.y, false, false);
      this.score = 0;
      this.camera.setWorldSize(this.level.worldWidth, this.level.worldHeight);
      this.camera.snapTo(this.player.x + this.player.w / 2, 1);
      this.showToast('Новая игра! Лорд Малакор восстал в Склепе.', 5.0);
    } else if (this.level.currentLevel === 2) {
      // Если погибли на Боссе (Уровень 2) — возрождаемся сразу в Тронном Зале со всеми реликвиями!
      this.level.loadLevel2();
      this.boss.reset();
      this.player.resetToSpawn(this.level.throneSpawn.x, this.level.throneSpawn.y, true, true);
      this.camera.setWorldSize(this.level.worldWidth, this.level.worldHeight);
      this.camera.snapTo(this.player.x + this.player.w / 2, 1);
      this.showToast('🔥 Возрождение в Тронном Зале! Используй рывок [SHIFT], Pogo [S+J] и руби Кристаллы!', 5.5);
    } else if (this.level.entranceCheckpoint.activated) {
      // Если погибли в Главном Холле (Уровень 1) — возрождаемся перед Входом в Поместье с мечом!
      const cp = this.level.entranceCheckpoint;
      this.level.loadLevel1(true);
      this.player.resetToSpawn(cp.x, cp.y, true, false);
      this.score = 0;
      this.camera.setWorldSize(this.level.worldWidth, this.level.worldHeight);
      this.camera.snapTo(this.player.x + this.player.w / 2, 1);
      this.showToast('🔥 Возрождение у Входа в Поместье! Меч при тебе — собери 3 реликвии Холла!', 5.0);
    } else {
      this.level.loadLevel1(false);
      this.player.resetToSpawn(this.level.cryptSpawn.x, this.level.cryptSpawn.y, false, false);
      this.score = 0;
      this.camera.setWorldSize(this.level.worldWidth, this.level.worldHeight);
      this.camera.snapTo(this.player.x + this.player.w / 2, 1);
      this.showToast('Лорд Малакор восстал из гроба! Подбери Меч у саркофага.', 5.0);
    }

    this.state = 'PLAYING';
    this.sound.startMusic();
    this.lastTime = performance.now();
    this.updateHUD();
  }

  showToast(msg, duration = 5.0) {
    this.toastMessage = msg;
    this.toastTimer = duration;
  }

  getCollectedRelicsCount() {
    if (this.level.currentLevel === 2) return 3;
    return this.level.items.filter((i) => i.collected).length;
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
    }

    this.player.update(dt, this.input, this.level.worldWidth);

    if (this.player.justJumped) this.sound.playJump();
    if (this.player.justSwung) this.sound.playSwing();

    // Коллизии с полом и платформами (работают на обоих уровнях)
    for (const seg of this.level.groundSegments) {
      resolvePlatformCollision(this.player, seg);
    }
    for (const plat of this.level.platforms) {
      resolvePlatformCollision(this.player, plat);
    }

    if (this.level.currentLevel === 1) {
      this.updateLevel1(dt);
    } else {
      this.updateLevel2Boss(dt);
    }

    this.camera.update(dt, this.player);
    this.updateHUD();
  }

  updateLevel1() {
    // Подбор Меча у гроба
    if (!this.level.swordPedestal.taken && checkAABB(this.player, this.level.swordPedestal)) {
      this.level.swordPedestal.taken = true;
      this.player.hasSword = true;
      this.score += 50;
      this.saveBestScore(this.score);
      this.sound.playPickup();
      this.showToast('⚔ МЕЧ "КРОВОПИЙЦА" ВЗЯТ! Жми [J / Z] для удара (влево/вправо, +W вверх, +S в прыжке вниз).', 6.5);
    }

    const swordBox = this.player.getSwordHitbox();
    if (swordBox) {
      if (!this.level.cryptBarricade.broken && checkAABB(swordBox, this.level.cryptBarricade)) {
        this.level.cryptBarricade.broken = true;
        this.score += 50;
        this.saveBestScore(this.score);
        this.sound.playHitObject(false);
        this.player.hitSoundPlayedThisSwing = true;
        this.showToast('💥 Преграда Склепа разрублена! Выходи ко Входу в Поместье →', 4.5);
      }

      for (const t of this.level.targets) {
        if (checkAABB(swordBox, t)) {
          const isDownStrike = this.player.attackDir === 'DOWN';
          if (!this.player.hitSoundPlayedThisSwing) {
            this.sound.playHitObject(isDownStrike);
            this.player.hitSoundPlayedThisSwing = true;
          }
          if (!t.hit) {
            t.hit = true;
            this.score += t.points;
            this.saveBestScore(this.score);
          }
          if (isDownStrike) {
            this.player.triggerPogoBounce();
          }
        }
      }
    }

    if (!this.level.cryptBarricade.broken) {
      resolvePlatformCollision(this.player, this.level.cryptBarricade);
      if (this.player.x + this.player.w >= this.level.cryptBarricade.x - 4) {
        this.showToast(
          this.player.hasSword
            ? 'Нажми [J] или [Z], чтобы разрубить ветхие врата Склепа!'
            : 'Выход заколочен! Вернись к гробу и возьми свой Меч!',
          3.0
        );
      }
    }

    if (!this.level.entranceCheckpoint.activated && this.player.x >= 740) {
      this.level.entranceCheckpoint.activated = true;
      this.sound.playPickup();
      this.showToast('🔥 ЧЕКПОИНТ: Вход в Поместье! При смерти ты возродишься здесь.', 5.0);
    }

    if (this.player.prevX < 1500 && this.player.x >= 1500) {
      this.showToast('ГЛАВНЫЙ ХОЛЛ! Собери 3 фамильные реликвии, чтобы войти в Тронный Зал к Боссу!', 5.5);
    }

    for (const item of this.level.items) {
      if (!item.collected && checkAABB(this.player, item)) {
        item.collected = true;
        this.player.relics[item.id] = true;
        this.score += item.points;
        this.saveBestScore(this.score);
        this.sound.playPickup();
        this.showToast(item.lore, 6.0);
      }
    }

    if (this.player.y > this.level.worldHeight + 25) {
      this.triggerGameOver('Лорд Малакор сорвался в пропасть!');
      return;
    }

    for (const hazard of this.level.hazards) {
      if (checkAABB(this.player, hazard) && !this.player.isDashing) {
        this.triggerGameOver(`Ловушка сквоттеров: ${hazard.name}!`);
        return;
      }
    }

    // Переход на Уровень 2 при входе во Врата Тронного Зала со всеми 3 реликвиями!
    if (this.level.finishDoor && checkAABB(this.player, this.level.finishDoor)) {
      if (this.getCollectedRelicsCount() === 3) {
        this.score += 300;
        this.saveBestScore(this.score);
        this.enterLevel2BossArena();
      } else {
        this.showToast('Врата Тронного зала запечатаны! Собери все 3 реликвии в Главном Холле.', 3.0);
      }
    }
  }

  /**
   * Логика Уровня 2: Битва с Архивампиром Ксавьером (3 механики)
   */
  updateLevel2Boss(dt) {
    this.boss.update(dt, this.player, this.sound);

    const swordBox = this.player.getSwordHitbox();
    if (swordBox) {
      // 1. Проверка разрубания сфер и Кристалла Крови мечом
      if (this.boss.checkSwordInteractions(swordBox, this.sound)) {
        if (!this.player.hitSoundPlayedThisSwing) {
          this.sound.playHitObject(false);
          this.player.hitSoundPlayedThisSwing = true;
        }
        this.score += 50;
        this.saveBestScore(this.score);
      }

      // 2. Проверка удара мечом по самому Боссу
      if (checkAABB(swordBox, this.boss)) {
        const isDownStrike = this.player.attackDir === 'DOWN';
        const result = this.boss.takeSwordHit(this.player.attackDir);

        if (result === 'DAMAGED') {
          this.sound.playHitObject(isDownStrike);
          this.player.hitSoundPlayedThisSwing = true;
          this.score += 100;
          this.saveBestScore(this.score);

          if (isDownStrike) {
            this.player.triggerPogoBounce();
          }

          if (this.boss.hp <= 0) {
            this.score += 1000;
            this.saveBestScore(this.score);
            this.state = 'WIN';
            this.input.clearKeys();
            this.sound.stopMusic();
            this.sound.playVictory();
            return;
          }
        } else if (result === 'BLOCKED') {
          if (!this.player.hitSoundPlayedThisSwing) {
            this.sound.playShieldClang();
            this.player.hitSoundPlayedThisSwing = true;
          }
          if (isDownStrike) {
            this.player.triggerPogoBounce();
          }
          this.showToast('🛡 Щит Ксавьера отразил удар! Уходи от взрывной волны или разбей Кристалл Крови!', 3.5);
        }
      }
    }

    // 3. Проверка урона игроку от Босса, его снарядов и Огненных Колонн
    let damageReason = null;

    if (this.boss.state !== 'STUNNED' && checkAABB(this.player, this.boss)) {
      damageReason = 'Столкновение с Архивампиром Ксавьером!';
    }

    for (const proj of this.boss.projectiles) {
      if (checkAABB(this.player, proj)) {
        proj.life = 0;
        damageReason = proj.type === 'wave'
          ? 'Взрывная волна Контр-Щита Босса!'
          : 'Кровавая сфера Ксавьера!';
      }
    }

    for (const p of this.boss.pillars) {
      if (p.warnTime <= 0) {
        const pillarBox = { x: p.x + 4, y: 70, w: p.w - 8, h: 320 };
        if (checkAABB(this.player, pillarBox)) {
          damageReason = 'Пламя Ритуальной Колонны!';
        }
      }
    }

    if (damageReason && this.player.takeDamage(1)) {
      this.sound.playPlayerHurt();
      if (this.player.hp <= 0) {
        this.triggerGameOver(`Поражение в Тронном Зале: ${damageReason}`);
      } else {
        this.showToast(`💔 Ранение (${damageReason})! Осталось сердец: ${this.player.hp}`, 3.0);
      }
    }
  }

  triggerGameOver(reason) {
    this.state = 'GAMEOVER';
    this.toastMessage = reason;
    this.input.clearKeys();
    this.sound.stopMusic();
    this.sound.playDeath();
    this.updateHUD();
  }

  updateHUD() {
    document.getElementById('score-val').textContent = this.score;
    document.getElementById('items-val').textContent = `${this.getCollectedRelicsCount()} / 3`;
    document.getElementById('best-val').textContent = this.bestScore;

    const hpEl = document.getElementById('hp-val');
    if (hpEl) {
      hpEl.textContent = '♥'.repeat(this.player.hp) + '♡'.repeat(this.player.maxHp - this.player.hp);
    }

    const cpEl = document.getElementById('checkpoint-val');
    if (this.level.currentLevel === 2) {
      cpEl.textContent = 'ТРОННЫЙ ЗАЛ';
    } else {
      cpEl.textContent = this.level.entranceCheckpoint.activated ? 'У ВХОДА' : 'СКЛЕП';
    }

    const zoneEl = document.getElementById('zone-indicator');
    if (this.level.currentLevel === 2) {
      zoneEl.textContent = 'УРОВЕНЬ 2: ТРОННЫЙ ЗАЛ (БОСС)';
    } else if (this.player.x < 700) {
      zoneEl.textContent = 'УРОВЕНЬ 1.1: СКЛЕП ПРОБУЖДЕНИЯ';
    } else if (this.player.x < 1500) {
      zoneEl.textContent = 'УРОВЕНЬ 1.2: ПЕРЕД ВХОДОМ В ПОМЕСТЬЕ';
    } else {
      zoneEl.textContent = 'УРОВЕНЬ 1.3: ГЛАВНЫЙ ХОЛЛ';
    }

    const setSlot = (id, active, text) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('active', active);
      el.querySelector('span').textContent = text;
    };

    setSlot('slot-sword', this.player.hasSword, this.player.hasSword ? 'ЭКИПИРОВАН [J]' : 'У ГРОБА');
    setSlot('slot-chalice', this.player.relics.chalice, this.player.relics.chalice ? 'ПРЫЖОК +25%' : 'НЕТ');
    setSlot('slot-cloak', this.player.relics.cloak, this.player.relics.cloak ? 'РЫВОК [SHIFT]' : 'НЕТ');
    setSlot('slot-ring', this.player.relics.ring, this.player.relics.ring ? 'ПЕЧАТЬ СНЯТА' : 'НЕТ');

    document.getElementById('btn-pause').textContent = this.state === 'PAUSED' ? '▶ Продолжить' : '⏸ Пауза';

    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.textContent = this.sound.isMuted ? '🔇 Звук: ВЫКЛ' : '🔊 Звук: ВКЛ';
      muteBtn.classList.toggle('sound-on', !this.sound.isMuted);
      muteBtn.classList.toggle('sound-off', this.sound.isMuted);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewportW, this.viewportH);

    this.drawParallaxSky(ctx);

    this.camera.apply(ctx);

    if (this.level.currentLevel === 1) {
      this.drawWorldBackgroundLevel1(ctx);
      this.drawHazards(ctx);
      this.drawPlatformsAndGround(ctx);
      this.drawCryptPropsAndCheckpoint(ctx);
      this.drawTargets(ctx);
      this.drawItems(ctx);
      this.drawFinishDoor(ctx);
    } else {
      this.drawWorldBackgroundLevel2(ctx);
      this.drawPlatformsAndGround(ctx);
      this.boss.draw(ctx);
    }

    this.player.draw(ctx, this.debugMode);

    this.camera.restore(ctx);

    if (this.debugMode) {
      this.camera.drawDebug(ctx);
    }

    // Отрисовка шкалы здоровья и текущей механики Босса на Уровне 2
    if (this.level.currentLevel === 2 && this.state === 'PLAYING') {
      this.drawBossHUD(ctx);
    }

    if (this.toastTimer > 0 && this.toastMessage && this.state === 'PLAYING') {
      const yPos = this.level.currentLevel === 2 ? 52 : 10;
      ctx.fillStyle = 'rgba(10, 8, 18, 0.9)';
      ctx.fillRect(16, yPos, this.viewportW - 32, 30);
      ctx.strokeStyle = '#a82039';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, yPos, this.viewportW - 32, 30);

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.toastMessage, this.viewportW / 2, yPos + 19);
    }

    if (this.state !== 'PLAYING') {
      this.drawStateOverlay(ctx);
    }
  }

  drawBossHUD(ctx) {
    const barW = 480;
    const barH = 14;
    const barX = (this.viewportW - barW) / 2;
    const barY = 12;

    ctx.fillStyle = 'rgba(12, 8, 22, 0.92)';
    ctx.fillRect(barX - 120, 6, barW + 240, 42);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 120, 6, barW + 240, 42);

    ctx.fillStyle = '#2b193d';
    ctx.fillRect(barX, barY, barW, barH);

    const hpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
    ctx.fillStyle = this.boss.isShielded ? '#00f5d4' : '#ff1e42';
    ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`АРХИВАМПИР КСАВЬЕР: ${this.boss.hp} / ${this.boss.maxHp} HP`, this.viewportW / 2, barY + 11);

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(this.boss.getPhaseLabel(), this.viewportW / 2, barY + 30);
  }

  drawParallaxSky(ctx) {
    ctx.fillStyle = '#080610';
    ctx.fillRect(0, 0, this.viewportW, this.viewportH);

    const moonX = Math.round(320 - this.camera.renderX * 0.15);
    ctx.fillStyle = '#800f2f';
    ctx.fillRect(moonX, 55, 64, 64);
    ctx.fillStyle = '#c9184a';
    ctx.fillRect(moonX + 8, 63, 48, 48);
  }

  drawWorldBackgroundLevel1(ctx) {
    ctx.fillStyle = '#110e1b';
    ctx.fillRect(0, 0, 700, 390);
    ctx.fillStyle = '#241e38';
    ctx.fillRect(0, 0, 700, 48);

    for (let x = 40; x < 680; x += 140) {
      ctx.fillStyle = '#1b162a';
      ctx.fillRect(x, 48, 22, 342);
    }

    ctx.fillStyle = '#1d1829';
    for (let x = 720; x < 1460; x += 36) {
      ctx.fillRect(x, 260, 6, 130);
      ctx.fillStyle = '#6c584c';
      ctx.fillRect(x - 2, 254, 10, 8);
      ctx.fillStyle = '#1d1829';
    }

    ctx.fillStyle = '#2b223c';
    ctx.fillRect(1450, 30, 90, 360);
    ctx.fillStyle = '#09070f';
    ctx.fillRect(1470, 250, 50, 140);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ВХОД В ПОМЕСТЬЕ', 1495, 235);

    ctx.fillStyle = '#161024';
    ctx.fillRect(1540, 0, 1660, 390);

    for (let x = 1600; x < 3120; x += 180) {
      ctx.fillStyle = '#241938';
      ctx.fillRect(x, 40, 24, 350);

      ctx.fillStyle = '#1d2549';
      ctx.fillRect(x + 65, 70, 64, 130);
      ctx.strokeStyle = '#483d73';
      ctx.strokeRect(x + 65, 70, 64, 130);
    }
  }

  drawWorldBackgroundLevel2(ctx) {
    // Готический Тронный Зал (1280px)
    ctx.fillStyle = '#140b1c';
    ctx.fillRect(0, 0, 1280, 390);

    // Колонны и багровые знамена
    for (let x = 80; x < 1240; x += 180) {
      ctx.fillStyle = '#231433';
      ctx.fillRect(x, 30, 28, 360);

      ctx.fillStyle = '#590d22';
      ctx.fillRect(x + 70, 65, 50, 140);
      ctx.strokeStyle = '#d4af37';
      ctx.strokeRect(x + 70, 65, 50, 140);
    }

    // Массивный Трон Поместья в центре (X: 600)
    ctx.fillStyle = '#3c096c';
    ctx.fillRect(595, 250, 90, 140);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(590, 242, 100, 10);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ФАМИЛЬНЫЙ ТРОН МАЛАКОРА', 640, 232);
  }

  drawCryptPropsAndCheckpoint(ctx) {
    ctx.fillStyle = '#3d3452';
    ctx.fillRect(35, 354, 72, 36);
    ctx.fillStyle = '#6c5b7b';
    ctx.fillRect(30, 346, 82, 10);
    ctx.fillStyle = '#a99fb8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('САРКОФАГ', 71, 336);

    const ped = this.level.swordPedestal;
    ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
    ctx.fillRect(ped.x - 10, 48, 48, 342);

    ctx.fillStyle = '#4a4063';
    ctx.fillRect(ped.x, 368, ped.w, 22);

    if (!ped.taken) {
      ctx.fillStyle = '#e0fbfc';
      ctx.fillRect(ped.x + 11, ped.y + 4, 6, 26);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(ped.x + 4, ped.y + 8, 20, 5);
      ctx.fillStyle = '#ff0a54';
      ctx.fillRect(ped.x + 10, ped.y, 8, 6);

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('⚔ ВОЗЬМИ МЕЧ', ped.x + 14, ped.y - 10);
    }

    const bar = this.level.cryptBarricade;
    if (!bar.broken) {
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = '#a82039';
      ctx.fillRect(bar.x + 4, bar.y + 20, bar.w - 8, 12);
      ctx.fillRect(bar.x + 4, bar.y + 65, bar.w - 8, 12);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('УДАРЬ МЕЧОМ [J]', bar.x - 15, bar.y - 10);
    }

    const cp = this.level.entranceCheckpoint;
    ctx.fillStyle = '#4a4458';
    ctx.fillRect(cp.x, 342, 24, 48);
    ctx.fillStyle = cp.activated ? '#ff2a55' : '#2b2638';
    ctx.fillRect(cp.x + 4, 326, 16, 16);
    if (cp.activated) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(cp.x + 8, 330, 8, 8);
    }
    ctx.fillStyle = cp.activated ? '#ffd166' : '#8d869c';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(cp.activated ? '🔥 ЧЕКПОИНТ АКТИВЕН' : 'ЧЕКПОИНТ ВХОДА', cp.x + 12, 316);
  }

  drawPlatformsAndGround(ctx) {
    for (const seg of this.level.groundSegments) {
      ctx.fillStyle = '#2d2338';
      ctx.fillRect(seg.x, seg.y, seg.w, seg.h);
      ctx.fillStyle = '#6d597a';
      ctx.fillRect(seg.x, seg.y, seg.w, 6);
    }

    for (const p of this.level.platforms) {
      ctx.fillStyle = '#4a304d';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#e56b6f';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }
  }

  drawTargets(ctx) {
    for (const t of this.level.targets) {
      ctx.fillStyle = t.hit ? '#52b788' : '#d4af37';
      ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, t.h - 8);
      ctx.fillStyle = t.hit ? '#80ed99' : '#ff4d6d';
      ctx.fillRect(t.x + 2, t.y, t.w - 4, 8);

      ctx.fillStyle = '#dcd6e8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.hint, t.x + t.w / 2, t.y - 6);
    }
  }

  drawHazards(ctx) {
    for (const h of this.level.hazards) {
      ctx.fillStyle = '#2b4a1c';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#80ed99';
      for (let sx = h.x + 6; sx < h.x + h.w - 8; sx += 16) {
        ctx.fillRect(sx, h.y - 8, 6, 12);
      }
    }
  }

  drawItems(ctx) {
    for (const item of this.level.items) {
      if (item.collected) continue;

      ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
      ctx.fillRect(item.x - 4, item.y - 4, item.w + 8, item.h + 8);

      if (item.id === 'chalice') {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(item.x + 3, item.y + 4, 16, 10);
        ctx.fillRect(item.x + 9, item.y + 14, 4, 7);
        ctx.fillRect(item.x + 5, item.y + 21, 12, 4);
        ctx.fillStyle = '#e6193c';
        ctx.fillRect(item.x + 5, item.y + 2, 12, 4);
      } else if (item.id === 'cloak') {
        ctx.fillStyle = '#9d4edd';
        ctx.fillRect(item.x + 2, item.y + 2, 20, 22);
        ctx.fillStyle = '#e0aaff';
        ctx.fillRect(item.x + 6, item.y + 5, 12, 6);
      } else if (item.id === 'ring') {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(item.x + 3, item.y + 8, 14, 14);
        ctx.fillStyle = '#161024';
        ctx.fillRect(item.x + 7, item.y + 12, 6, 6);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(item.x + 6, item.y + 2, 8, 6);
      }
    }
  }

  drawFinishDoor(ctx) {
    const d = this.level.finishDoor;
    if (!d) return;
    const unlocked = this.getCollectedRelicsCount() === 3;

    ctx.fillStyle = unlocked ? '#d4af37' : '#5c3c47';
    ctx.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 4);

    ctx.fillStyle = unlocked ? '#1b4332' : '#2b131d';
    ctx.fillRect(d.x, d.y, d.w, d.h);

    ctx.fillStyle = unlocked ? '#52b788' : '#e63946';
    ctx.fillRect(d.x + 14, d.y + 18, 24, 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? 'ВОЙТИ К БОССУ →' : 'ПЕЧАТЬ (НУЖНЫ 3 РЕЛИКВИИ)', d.x + d.w / 2, d.y - 10);
  }

  drawStateOverlay(ctx) {
    ctx.fillStyle = 'rgba(8, 6, 15, 0.88)';
    ctx.fillRect(0, 0, this.viewportW, this.viewportH);

    ctx.strokeStyle = '#b81d33';
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 55, this.viewportW - 140, this.viewportH - 110);

    ctx.textAlign = 'center';

    if (this.state === 'PAUSED') {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillText('ПАУЗА (ДНЕВНОЙ СОН)', this.viewportW / 2, 195);
      ctx.fillStyle = '#e6dfd5';
      ctx.font = '15px "Courier New", monospace';
      ctx.fillText('Нажми «Продолжить» или «Старт», чтобы вернуться в бой.', this.viewportW / 2, 240);
    } else if (this.state === 'WIN') {
      ctx.fillStyle = '#52b788';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillText('ПОБЕДА! АРХИВАМПИР КСАВЬЕР ПОВЕРЖЕН!', this.viewportW / 2, 145);

      ctx.fillStyle = '#e6dfd5';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('Лорд Малакор очистил Главный Холл, сокрушил лидера сквоттеров', this.viewportW / 2, 190);
      ctx.fillText('и вернул себе Фамильный Трон Поместья!', this.viewportW / 2, 216);

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText(`ИТОГОВЫЙ СЧЁТ: ${this.score}  |  РЕКОРД: ${this.bestScore}`, this.viewportW / 2, 270);
      ctx.fillText('Нажми «Заново», чтобы пройти игру с самого начала.', this.viewportW / 2, 320);
    } else if (this.state === 'GAMEOVER') {
      ctx.fillStyle = '#ff3b56';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillText('ЛОРД МАЛАКОР ОТСТУПИЛ!', this.viewportW / 2, 150);

      ctx.fillStyle = '#e6dfd5';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText(this.toastMessage, this.viewportW / 2, 200);

      let respawnNote = 'Ты возродишься у саркофага в Склепе.';
      if (this.level.currentLevel === 2) {
        respawnNote = 'Чекпоинт активен: ты возродишься сразу в ТРОННОМ ЗАЛЕ перед Боссом!';
      } else if (this.level.entranceCheckpoint.activated) {
        respawnNote = 'Чекпоинт активен: ты возродишься сразу ПЕРЕД ВХОДОМ В ПОМЕСТЬЕ с мечом!';
      }

      ctx.fillStyle = '#80ed99';
      ctx.fillText(respawnNote, this.viewportW / 2, 245);

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText('Нажми кнопку «↻ С чекпоинта / Заново» или «Старт»!', this.viewportW / 2, 310);
    }
  }
}