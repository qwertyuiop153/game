/**
 * Базовая проверка пересечения двух прямоугольников со сторонами,
 * параллельными осям координат (Axis-Aligned Bounding Box — AABB)
 */
export function checkAABB(a, b) {
  if (!a || !b) return false;
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Разрешение столкновения игрока с твердой платформой или стеной
 * с учетом координат предыдущего кадра (prevX, prevY)
 */
export function resolvePlatformCollision(player, platform) {
  if (!checkAABB(player, platform)) {
    return;
  }

  const prevBottom = player.prevY + player.h;
  const prevTop = player.prevY;
  const prevRight = player.prevX + player.w;
  const prevLeft = player.prevX;

  // 1. Приземление сверху на платформу
  if (prevBottom <= platform.y + 6 && player.vy >= 0) {
    player.y = platform.y - player.h;
    player.vy = 0;
    player.onGround = true;
    return;
  }

  // 2. Удар головой снизу о платформу
  if (prevTop >= platform.y + platform.h - 6 && player.vy < 0) {
    player.y = platform.y + platform.h;
    player.vy = 0;
    return;
  }

  // 3. Столкновение слева (уперлись в левую грань стены/платформы)
  if (prevRight <= platform.x + 6 && player.vx > 0) {
    player.x = platform.x - player.w;
    player.vx = 0;
    return;
  }

  // 4. Столкновение справа (уперлись в правую грань стены/платформы)
  if (prevLeft >= platform.x + platform.w - 6 && player.vx < 0) {
    player.x = platform.x + platform.w;
    player.vx = 0;
    return;
  }

  // Резервное выталкивание по минимальному перекрытию (если скорость была очень высокой)
  const overlapLeft = (player.x + player.w) - platform.x;
  const overlapRight = (platform.x + platform.w) - player.x;
  const overlapTop = (player.y + player.h) - platform.y;
  const overlapBottom = (platform.y + platform.h) - player.y;

  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapTop && player.vy >= 0) {
    player.y = platform.y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else if (minOverlap === overlapBottom && player.vy < 0) {
    player.y = platform.y + platform.h;
    player.vy = 0;
  } else if (minOverlap === overlapLeft) {
    player.x = platform.x - player.w;
    player.vx = 0;
  } else if (minOverlap === overlapRight) {
    player.x = platform.x + platform.w;
    player.vx = 0;
  }
}