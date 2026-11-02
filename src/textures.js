// Placeholder art drawn at runtime, so the prototype needs no image files.

// Bear texture faces right. Its collision circle is centred on (originX, originY).
export const BEAR_TEXTURE = { width: 96, height: 72, originX: 42, originY: 36, radius: 24 };

export function createTextures(scene) {
  const g = scene.add.graphics();

  // Bear, top-down. Drawn in light greys so a tint colours it while keeping the shading.
  g.fillStyle(0xbdbdbd);
  [[24, 14], [24, 58], [60, 15], [60, 57]].forEach(([x, y]) => g.fillCircle(x, y, 7)); // paws
  g.fillStyle(0xe6e6e6);
  g.fillEllipse(28, 36, 34, 46); // haunches
  g.fillStyle(0xffffff);
  g.fillEllipse(44, 36, 56, 50); // body
  g.fillStyle(0xf4f4f4);
  g.fillCircle(55, 36, 17); // shoulder hump
  g.fillStyle(0xcfcfcf, 0.8);
  g.fillEllipse(40, 36, 46, 12); // darker fur along the spine
  g.fillStyle(0xc4c4c4);
  g.fillCircle(72, 23, 6.5); // ears
  g.fillCircle(72, 49, 6.5);
  g.fillStyle(0x8f8f8f);
  g.fillCircle(72, 23, 3);
  g.fillCircle(72, 49, 3);
  g.fillStyle(0xf0f0f0);
  g.fillCircle(75, 36, 15); // head
  g.fillStyle(0xfff6e6);
  g.fillEllipse(87, 36, 15, 12); // muzzle
  g.fillStyle(0x1a1a1a);
  g.fillCircle(94, 36, 3.5); // nose
  g.fillCircle(80, 30, 2); // eyes
  g.fillCircle(80, 42, 2);
  g.generateTexture('bear', BEAR_TEXTURE.width, BEAR_TEXTURE.height);
  g.clear();

  // Soft shadow under bears
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(32, 26, 62, 50);
  g.generateTexture('shadow', 64, 52);
  g.clear();

  // Sockeye salmon: red body, green head
  g.fillStyle(0x8e2a22);
  g.fillTriangle(9, 8, 1, 2, 1, 14); // tail
  g.fillStyle(0xd23b2f);
  g.fillEllipse(17, 8, 20, 9);
  g.fillStyle(0x4b7a3f);
  g.fillEllipse(27, 8, 9, 7);
  g.fillStyle(0xffffff);
  g.fillCircle(29, 7, 1.2);
  g.generateTexture('salmon', 33, 16);
  g.clear();

  // Berry bush (full) and (eaten)
  drawBushLeaves(g, false);
  g.fillStyle(0x7a1f3d);
  [[11, 13], [24, 10], [29, 22], [15, 27], [21, 19], [9, 23], [27, 30]].forEach(([x, y]) => {
    g.fillStyle(0x7a1f3d);
    g.fillCircle(x, y, 3.2);
    g.fillStyle(0xd9668c);
    g.fillCircle(x - 1, y - 1, 1);
  });
  g.generateTexture('bush', 40, 40);
  g.clear();
  drawBushLeaves(g, true);
  g.generateTexture('bush-empty', 40, 40);
  g.clear();

  // Tree canopy for the map edges
  g.fillStyle(0x000000, 0.2);
  g.fillCircle(44, 48, 36);
  [[0x24451f, 38, 38, 34], [0x2f5a28, 32, 32, 24], [0x3b6e31, 46, 28, 18], [0x4c8340, 30, 24, 10]].forEach(
    ([c, x, y, r]) => {
      g.fillStyle(c);
      g.fillCircle(x, y, r);
    },
  );
  g.generateTexture('tree', 84, 88);
  g.clear();

  // Water ripples, tiled and scrolled across the river
  g.fillStyle(0xffffff, 0.16);
  for (let i = 0; i < 14; i++) {
    const x = (i * 53) % 256;
    const y = (i * 37) % 128;
    g.fillRoundedRect(x, y, 34 + (i % 3) * 10, 3, 1.5);
  }
  g.generateTexture('ripples', 256, 128);
  g.destroy();
}

function drawBushLeaves(g, eaten) {
  const shades = eaten ? [0x2d4429, 0x354f30, 0x3e5a38] : [0x244a20, 0x2f5e2a, 0x3d7535];
  g.fillStyle(0x000000, 0.2);
  g.fillCircle(21, 22, 18);
  g.fillStyle(shades[0]);
  g.fillCircle(20, 20, 18);
  g.fillStyle(shades[1]);
  [[13, 14, 10], [27, 15, 10], [20, 27, 10]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
  g.fillStyle(shades[2]);
  [[15, 12, 5], [26, 13, 5], [21, 24, 5]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
}
