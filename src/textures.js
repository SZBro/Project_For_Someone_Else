// Placeholder art drawn at runtime, so the prototype needs no image files.

// Bear texture faces right. Its collision circle is centred on (originX, originY).
export const BEAR_TEXTURE = { width: 88, height: 64, originX: 40, originY: 32, radius: 24 };

export function createTextures(scene) {
  const g = scene.add.graphics();

  // Bear, top-down: body, head, ears. Drawn white-ish so tint can colour it.
  g.fillStyle(0xffffff);
  g.fillEllipse(40, 32, 58, 48);
  g.fillCircle(68, 32, 15);
  g.fillCircle(70, 19, 6);
  g.fillCircle(70, 45, 6);
  g.fillStyle(0x222222);
  g.fillCircle(81, 32, 3); // nose
  g.generateTexture('bear', BEAR_TEXTURE.width, BEAR_TEXTURE.height);
  g.clear();

  // Salmon
  g.fillStyle(0xe8735a);
  g.fillEllipse(18, 8, 22, 10);
  g.fillTriangle(8, 8, 1, 2, 1, 14);
  g.generateTexture('salmon', 30, 16);
  g.clear();

  // Berry bush (full)
  g.fillStyle(0x2f5e2a);
  g.fillCircle(18, 18, 17);
  g.fillStyle(0xb3243d);
  [[10, 12], [22, 9], [26, 20], [14, 24], [19, 17], [8, 21]].forEach(([x, y]) => g.fillCircle(x, y, 3));
  g.generateTexture('bush', 36, 36);
  g.clear();

  // Berry bush (eaten)
  g.fillStyle(0x3b5434);
  g.fillCircle(18, 18, 17);
  g.generateTexture('bush-empty', 36, 36);
  g.destroy();
}
