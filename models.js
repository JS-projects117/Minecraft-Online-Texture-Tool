// Model registry — defines every model the editor can paint.
//
// Each model declares:
//   id             unique key
//   label          human-readable name
//   category       "players" | "blocks" | "mobs" | "items"
//   info           short technical descriptor (e.g. "64×64 skin")
//   desc           one-line description
//   textureWidth   pixel width of the texture canvas
//   textureHeight  pixel height of the texture canvas
//   parts          array of part definitions consumed by model3d.js
//   cameraDistance camera Z distance in viewer
//   cameraOffsetY  how far below origin to translate the model root (so it centers)
//   drawDefault    fn(ctx) — paints the model's default texture into a 2D context
//   export         async fn(textureCanvas) → { filename, blob, files? } — produces a download
//
// A "part" looks like:
//   { name, size:[w,h,d], position:[x,y,z], faces:{right,left,top,bottom,front,back}, overlay? }
// Where each face is [x, y, w, h] in texture pixels.
// "right" / "left" use Minecraft's convention — the player's right side is at -X.
// "overlay" is optional (player has one; blocks don't).

window.MODELS = {};

/* ============================================================
   PLAYER MODEL (classic 64×64 skin)
   ============================================================ */
window.MODELS.player = {
  id: "player",
  label: "player",
  shortLabel: "steve",
  category: "players",
  info: "64×64 skin",
  desc: "the classic 4-pixel-arm humanoid",
  textureWidth: 64,
  textureHeight: 64,
  cameraDistance: 80,
  cameraOffsetY: -16,
  parts: [
    {
      name: "head",
      size: [8, 8, 8],
      position: [0, 28, 0],
      faces: {
        right:  [0,  8,  8, 8],
        front:  [8,  8,  8, 8],
        left:   [16, 8,  8, 8],
        back:   [24, 8,  8, 8],
        top:    [8,  0,  8, 8],
        bottom: [16, 0,  8, 8],
      },
      overlay: {
        right:  [32, 8,  8, 8],
        front:  [40, 8,  8, 8],
        left:   [48, 8,  8, 8],
        back:   [56, 8,  8, 8],
        top:    [40, 0,  8, 8],
        bottom: [48, 0,  8, 8],
      },
      overlayScale: 1.125,
    },
    {
      name: "body",
      size: [8, 12, 4],
      position: [0, 18, 0],
      faces: {
        right:  [16, 20, 4, 12],
        front:  [20, 20, 8, 12],
        left:   [28, 20, 4, 12],
        back:   [32, 20, 8, 12],
        top:    [20, 16, 8, 4],
        bottom: [28, 16, 8, 4],
      },
      overlay: {
        right:  [16, 36, 4, 12],
        front:  [20, 36, 8, 12],
        left:   [28, 36, 4, 12],
        back:   [32, 36, 8, 12],
        top:    [20, 32, 8, 4],
        bottom: [28, 32, 8, 4],
      },
      overlayScale: 1.125,
    },
    {
      name: "rightArm",
      size: [4, 12, 4],
      position: [-6, 18, 0],
      faces: {
        right:  [40, 20, 4, 12],
        front:  [44, 20, 4, 12],
        left:   [48, 20, 4, 12],
        back:   [52, 20, 4, 12],
        top:    [44, 16, 4, 4],
        bottom: [48, 16, 4, 4],
      },
      overlay: {
        right:  [40, 36, 4, 12],
        front:  [44, 36, 4, 12],
        left:   [48, 36, 4, 12],
        back:   [52, 36, 4, 12],
        top:    [44, 32, 4, 4],
        bottom: [48, 32, 4, 4],
      },
      overlayScale: 1.125,
    },
    {
      name: "leftArm",
      size: [4, 12, 4],
      position: [6, 18, 0],
      faces: {
        right:  [32, 52, 4, 12],
        front:  [36, 52, 4, 12],
        left:   [40, 52, 4, 12],
        back:   [44, 52, 4, 12],
        top:    [36, 48, 4, 4],
        bottom: [40, 48, 4, 4],
      },
      overlay: {
        right:  [48, 52, 4, 12],
        front:  [52, 52, 4, 12],
        left:   [56, 52, 4, 12],
        back:   [60, 52, 4, 12],
        top:    [52, 48, 4, 4],
        bottom: [56, 48, 4, 4],
      },
      overlayScale: 1.125,
    },
    {
      name: "rightLeg",
      size: [4, 12, 4],
      position: [-2, 6, 0],
      faces: {
        right:  [0,  20, 4, 12],
        front:  [4,  20, 4, 12],
        left:   [8,  20, 4, 12],
        back:   [12, 20, 4, 12],
        top:    [4,  16, 4, 4],
        bottom: [8,  16, 4, 4],
      },
      overlay: {
        right:  [0,  36, 4, 12],
        front:  [4,  36, 4, 12],
        left:   [8,  36, 4, 12],
        back:   [12, 36, 4, 12],
        top:    [4,  32, 4, 4],
        bottom: [8,  32, 4, 4],
      },
      overlayScale: 1.125,
    },
    {
      name: "leftLeg",
      size: [4, 12, 4],
      position: [2, 6, 0],
      faces: {
        right:  [16, 52, 4, 12],
        front:  [20, 52, 4, 12],
        left:   [24, 52, 4, 12],
        back:   [28, 52, 4, 12],
        top:    [20, 48, 4, 4],
        bottom: [24, 48, 4, 4],
      },
      overlay: {
        right:  [0,  52, 4, 12],
        front:  [4,  52, 4, 12],
        left:   [8,  52, 4, 12],
        back:   [12, 52, 4, 12],
        top:    [4,  48, 4, 4],
        bottom: [8,  48, 4, 4],
      },
      overlayScale: 1.125,
    },
  ],

  drawDefault(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);

    const SKIN  = "#B5896A", SKIN_D = "#8A6447";
    const HAIR  = "#291B11", HAIR_D = "#1A1009";
    const EYE_W = "#F0F0F0", EYE    = "#5A8FCB";
    const MOUTH = "#5B3B2F", NOSE   = "#8E6346";
    const SHIRT = "#3AAFE3", SHIRT_D= "#258AB8";
    const PANTS = "#3B4A75", PANTS_D= "#2A3658";
    const SHOE  = "#523B2A";

    // Overlay colors (full minecraft armor layer) — distinct leather-armor look
    const JKT   = "#5C3A1F";   // brown chestplate
    const JKT_D = "#3F2814";
    const SLV   = "#5C3A1F";
    const LEG_OV= "#4A2F1A";   // brown leggings overlay
    const HAT   = "#1A0E08";

    const r = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const px = (color, x, y) => { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); };

    // ---- Head ----
    r(HAIR, 8, 0, 8, 8);
    r(HAIR_D, 9, 1, 1, 1); r(HAIR_D, 13, 2, 1, 1); r(HAIR_D, 10, 5, 1, 1); r(HAIR_D, 12, 6, 1, 1);
    r(SKIN, 16, 0, 8, 8);
    r(SKIN, 0, 8, 8, 8);   r(HAIR, 0, 8, 8, 2); r(HAIR, 0, 10, 1, 6);
    r(SKIN, 8, 8, 8, 8);   r(HAIR, 8, 8, 8, 2);
    r(EYE_W, 9, 12, 2, 1); r(EYE_W, 13, 12, 2, 1);
    px(EYE, 10, 12); px(EYE, 14, 12);
    px(NOSE, 11, 13); px(NOSE, 12, 13);
    r(MOUTH, 10, 14, 4, 1);
    r(SKIN, 16, 8, 8, 8);  r(HAIR, 16, 8, 8, 2); r(HAIR, 23, 10, 1, 6);
    r(HAIR, 24, 8, 8, 5);  r(SKIN, 24, 13, 8, 3);

    // ---- Body ----
    r(SKIN_D, 20, 16, 8, 4);
    r(PANTS_D, 28, 16, 8, 4);
    r(SHIRT, 16, 20, 4, 12);
    r(SHIRT, 20, 20, 8, 12); r(SHIRT_D, 20, 31, 8, 1);
    r(SHIRT, 28, 20, 4, 12);
    r(SHIRT, 32, 20, 8, 12); r(SHIRT_D, 32, 20, 8, 1);

    // ---- Right arm ----
    r(SKIN_D, 44, 16, 4, 4);
    r(SKIN_D, 48, 16, 4, 4);
    r(SHIRT, 40, 20, 4, 4); r(SKIN, 40, 24, 4, 8);
    r(SHIRT, 44, 20, 4, 4); r(SKIN, 44, 24, 4, 8);
    r(SHIRT, 48, 20, 4, 4); r(SKIN, 48, 24, 4, 8);
    r(SHIRT, 52, 20, 4, 4); r(SKIN, 52, 24, 4, 8);

    // ---- Left arm ----
    r(SKIN_D, 36, 48, 4, 4);
    r(SKIN_D, 40, 48, 4, 4);
    r(SHIRT, 32, 52, 4, 4); r(SKIN, 32, 56, 4, 8);
    r(SHIRT, 36, 52, 4, 4); r(SKIN, 36, 56, 4, 8);
    r(SHIRT, 40, 52, 4, 4); r(SKIN, 40, 56, 4, 8);
    r(SHIRT, 44, 52, 4, 4); r(SKIN, 44, 56, 4, 8);

    // ---- Right leg ----
    r(PANTS_D, 4, 16, 4, 4); r(SHOE, 8, 16, 4, 4);
    r(PANTS, 0, 20, 4, 9); r(SHOE, 0, 29, 4, 3);
    r(PANTS, 4, 20, 4, 9); r(SHOE, 4, 29, 4, 3);
    r(PANTS, 8, 20, 4, 9); r(SHOE, 8, 29, 4, 3);
    r(PANTS, 12, 20, 4, 9); r(SHOE, 12, 29, 4, 3);

    // ---- Left leg ----
    r(PANTS_D, 20, 48, 4, 4); r(SHOE, 24, 48, 4, 4);
    r(PANTS, 16, 52, 4, 9); r(SHOE, 16, 61, 4, 3);
    r(PANTS, 20, 52, 4, 9); r(SHOE, 20, 61, 4, 3);
    r(PANTS, 24, 52, 4, 9); r(SHOE, 24, 61, 4, 3);
    r(PANTS, 28, 52, 4, 9); r(SHOE, 28, 61, 4, 3);

    // =========== OVERLAY LAYER (full armor) ===========
    // Hat (top + 4 sides of head overlay)
    r(HAT, 40, 0, 8, 8);
    r(HAT, 32, 8, 8, 1); r(HAT, 40, 8, 8, 1);
    r(HAT, 48, 8, 8, 1); r(HAT, 56, 8, 8, 1);

    // Jacket (body overlay)
    r(JKT_D, 20, 32, 8, 4);
    r(JKT_D, 28, 32, 8, 4);
    r(JKT, 16, 36, 4, 12);
    r(JKT, 20, 36, 8, 12); r(JKT_D, 20, 47, 8, 1);
    r(JKT, 28, 36, 4, 12);
    r(JKT, 32, 36, 8, 12); r(JKT_D, 32, 36, 8, 1);

    // Right arm sleeve (overlay)
    r(JKT_D, 44, 32, 4, 4);
    r(JKT_D, 48, 32, 4, 4);
    r(SLV, 40, 36, 4, 12);
    r(SLV, 44, 36, 4, 12);
    r(SLV, 48, 36, 4, 12);
    r(SLV, 52, 36, 4, 12);

    // Left arm sleeve (overlay)
    r(JKT_D, 52, 48, 4, 4);
    r(JKT_D, 56, 48, 4, 4);
    r(SLV, 48, 52, 4, 12);
    r(SLV, 52, 52, 4, 12);
    r(SLV, 56, 52, 4, 12);
    r(SLV, 60, 52, 4, 12);

    // Right leg overlay (pants ridge / boot top)
    r(LEG_OV, 4, 32, 4, 4);
    r(LEG_OV, 8, 32, 4, 4);
    r(LEG_OV, 0, 36, 4, 12);
    r(LEG_OV, 4, 36, 4, 12);
    r(LEG_OV, 8, 36, 4, 12);
    r(LEG_OV, 12, 36, 4, 12);

    // Left leg overlay
    r(LEG_OV, 4, 48, 4, 4);
    r(LEG_OV, 8, 48, 4, 4);
    r(LEG_OV, 0, 52, 4, 12);
    r(LEG_OV, 4, 52, 4, 12);
    r(LEG_OV, 8, 52, 4, 12);
    r(LEG_OV, 12, 52, 4, 12);
  },

  async export(textureCanvas) {
    const blob = await new Promise(r => textureCanvas.toBlob(r, "image/png"));
    return { filename: "skin.png", blob };
  },
};

/* ============================================================
   BLOCK MODEL (cube — 6 × 16×16 faces)
   ============================================================
   Texture atlas (cross unfold), 64×48:
     .  T  .  .
     L  F  R  B
     .  U  .  .
*/
window.MODELS.block = {
  id: "block",
  label: "block",
  shortLabel: "cube",
  category: "blocks",
  info: "16×16 per face",
  desc: "paint a 6-face cube; export each unique face",
  textureWidth: 64,
  textureHeight: 48,
  cameraDistance: 50,
  cameraOffsetY: -8,
  parts: [
    {
      name: "cube",
      size: [16, 16, 16],
      position: [0, 8, 0],
      faces: {
        top:    [16, 0,  16, 16],
        left:   [0,  16, 16, 16],
        front:  [16, 16, 16, 16],
        right:  [32, 16, 16, 16],
        back:   [48, 16, 16, 16],
        bottom: [16, 32, 16, 16],
      },
      // no overlay
    },
  ],

  drawDefault(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 48);

    // Default: grass block (classic, immediately recognizable)
    const GRASS  = "#7BAC4D", GRASS_D = "#5E8A36", GRASS_L = "#9DC967";
    const DIRT   = "#8B6B43", DIRT_D = "#6E5232", DIRT_L = "#A48256";
    const STONE_GR = "#3D2A18";

    // Helper to paint a 16×16 face with noise
    function noise(rx, ry, base, dark, light) {
      const seed = (x, y) => ((x * 374761393 + y * 668265263 + rx * 2147483647 + ry * 137) >>> 0) % 100;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = seed(x, y);
          let col = base;
          if (n < 18) col = dark;
          else if (n > 82) col = light;
          ctx.fillStyle = col;
          ctx.fillRect(rx + x, ry + y, 1, 1);
        }
      }
    }

    // top — grass with a darker top edge
    noise(16, 0, GRASS, GRASS_D, GRASS_L);

    // bottom — pure dirt
    noise(16, 32, DIRT, DIRT_D, DIRT_L);

    // 4 sides — dirt with green grass ridge on top + dark mossy spots
    [[0, 16], [16, 16], [32, 16], [48, 16]].forEach(([rx, ry]) => {
      noise(rx, ry, DIRT, DIRT_D, DIRT_L);
      // grass overhang top 3 rows, ragged
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 16; x++) {
          const n = ((x * 13 + y * 7 + rx * 3) % 10);
          if (y === 0 || (y === 1 && n < 7) || (y === 2 && n < 3)) {
            ctx.fillStyle = (n % 3 === 0) ? GRASS_D : GRASS;
            ctx.fillRect(rx + x, ry + y, 1, 1);
          }
        }
      }
      // a couple of darker pebble dots
      ctx.fillStyle = STONE_GR;
      ctx.fillRect(rx + 4, ry + 9, 1, 1);
      ctx.fillRect(rx + 11, ry + 12, 1, 1);
    });
  },

  /**
   * Block export — deduplicate identical faces, output one PNG per unique face.
   * Faces are 16×16 sub-images of the texture atlas.
   * Returns { filename, blob, files } where files is an array of {name, blob} too.
   */
  async export(textureCanvas) {
    const FACE_W = 16, FACE_H = 16;
    const part = this.parts[0];
    const faces = part.faces;

    // Read each face's pixel data + compute a hash key
    const faceData = {};
    for (const [name, rect] of Object.entries(faces)) {
      const [x, y] = rect;
      const c = document.createElement("canvas");
      c.width = FACE_W; c.height = FACE_H;
      const cx = c.getContext("2d");
      cx.imageSmoothingEnabled = false;
      cx.drawImage(textureCanvas, x, y, FACE_W, FACE_H, 0, 0, FACE_W, FACE_H);
      const img = cx.getImageData(0, 0, FACE_W, FACE_H).data;
      // Hash: simple djb2 over RGBA bytes
      let h = 5381;
      for (let i = 0; i < img.length; i++) h = (((h << 5) + h) ^ img[i]) >>> 0;
      faceData[name] = { canvas: c, hash: h.toString(16) };
    }

    // Group faces by hash
    const groups = {};
    for (const [name, fd] of Object.entries(faceData)) {
      (groups[fd.hash] = groups[fd.hash] || { canvas: fd.canvas, names: [] }).names.push(name);
    }

    // Name each unique group
    const groupNames = Object.values(groups).map(g => {
      const set = new Set(g.names);
      // Common patterns
      if (set.size === 1) return [...set][0];
      const sides = ["left", "front", "right", "back"];
      const isAllSides = sides.every(s => set.has(s)) && set.size === 4;
      if (isAllSides) return "side";
      const horiz = ["top", "bottom"];
      const isVert = horiz.every(s => set.has(s)) && set.size === 2;
      if (isVert) return "top_bottom";
      return g.names.sort().join("_");
    });
    Object.values(groups).forEach((g, i) => g.outName = groupNames[i]);

    // Build PNG blobs for each group
    const files = [];
    for (const g of Object.values(groups)) {
      const blob = await new Promise(r => g.canvas.toBlob(r, "image/png"));
      files.push({ name: g.outName + ".png", blob, faces: g.names });
    }

    // Zip them up (JSZip)
    if (!window.JSZip) throw new Error("JSZip not loaded");
    const zip = new window.JSZip();
    files.forEach(f => zip.file(f.name, f.blob));
    // Also include an atlas.png of the full texture for reference
    const atlasBlob = await new Promise(r => textureCanvas.toBlob(r, "image/png"));
    zip.file("atlas.png", atlasBlob);
    const zipBlob = await zip.generateAsync({ type: "blob" });

    return { filename: "block_textures.zip", blob: zipBlob, files };
  },
};

// Back-compat aliases (used by older parts of model3d.js)
window.PLAYER_PARTS = window.MODELS.player.parts;
window.SKIN_W = window.MODELS.player.textureWidth;
window.SKIN_H = window.MODELS.player.textureHeight;
