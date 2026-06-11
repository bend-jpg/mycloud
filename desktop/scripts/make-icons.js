// Génère les icônes de l'app desktop SANS dépendance externe.
// Dessine le logo MyTitanCloud (nuage blanc sur carré arrondi en dégradé
// turquoise→bleu, identique au logo du site) par rendu logiciel pur, puis
// écrit :
//   build/icon.ico       (Windows — entrées BMP 16/24/32/48/64/128/256)
//   build/icon.png       (512px — electron-builder le convertit en .icns mac
//                          et l'utilise pour Linux ; aussi icône de fenêtre)
//   build/tray-icon.png  (32px — icône de la barre des tâches)
//
// Usage : node desktop/scripts/make-icons.js
// Les fichiers générés sont committés — le CI n'a pas besoin de relancer ça.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "build");
fs.mkdirSync(OUT, { recursive: true });

// --- Rendu du logo -------------------------------------------------------
// Couleurs du brand (mêmes que styles.css : --accent → --blue en 135°)
const C1 = [0x4f, 0xd1, 0xb0]; // turquoise
const C2 = [0x4f, 0xa8, 0xff]; // bleu

function renderLogo(size) {
  const px = new Uint8Array(size * size * 4); // RGBA
  const SS = 4; // supersampling 4×4 par pixel
  const inv = 1 / (size * SS);

  // Géométrie en coordonnées unitaires (y vers le bas)
  const margin = 0.03;
  const radius = 0.225; // coins arrondis du carré
  // Nuage lucide (viewBox 24) ≈ union de 2 cercles + rectangle plat en bas,
  // réduit à 72% et recentré
  const S = 0.72, OX = 0.5 - 0.5 * S, OY = 0.48 - 0.5 * S;
  const cloud = {
    ax: OX + 0.375 * S, ay: OY + 0.5 * S, ar: 0.2917 * S,
    bx: OX + 0.729 * S, by: OY + 0.604 * S, br: 0.1875 * S,
    bottom: OY + 0.7917 * S,
  };

  function inRoundedSquare(x, y) {
    const lo = margin, hi = 1 - margin, r = radius;
    if (x < lo || x > hi || y < lo || y > hi) return false;
    const cx = Math.max(lo + r, Math.min(hi - r, x));
    const cy = Math.max(lo + r, Math.min(hi - r, y));
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  function inCloud(x, y) {
    const { ax, ay, ar, bx, by, br, bottom } = cloud;
    const da = (x - ax) ** 2 + (y - ay) ** 2 <= ar * ar;
    const db = (x - bx) ** 2 + (y - by) ** 2 <= br * br;
    const rect = x >= ax && x <= bx && y >= ay && y <= bottom;
    return da || db || rect;
  }

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bgHits = 0, fgHits = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i * SS + si + 0.5) * inv;
          const y = (j * SS + sj + 0.5) * inv;
          if (inRoundedSquare(x, y)) {
            bgHits++;
            if (inCloud(x, y)) fgHits++;
          }
        }
      }
      const total = SS * SS;
      const bgA = bgHits / total, fgA = fgHits / total;
      // Dégradé 135° : t varie du coin haut-gauche au bas-droit
      const t = (i / size + j / size) / 2;
      let r = C1[0] + (C2[0] - C1[0]) * t;
      let g = C1[1] + (C2[1] - C1[1]) * t;
      let b = C1[2] + (C2[2] - C1[2]) * t;
      // Nuage blanc par-dessus
      r = r * (1 - fgA / Math.max(bgA, 1e-6)) + 255 * (fgA / Math.max(bgA, 1e-6));
      g = g * (1 - fgA / Math.max(bgA, 1e-6)) + 255 * (fgA / Math.max(bgA, 1e-6));
      b = b * (1 - fgA / Math.max(bgA, 1e-6)) + 255 * (fgA / Math.max(bgA, 1e-6));
      const o = (j * size + i) * 4;
      px[o] = Math.round(Math.min(255, r));
      px[o + 1] = Math.round(Math.min(255, g));
      px[o + 2] = Math.round(Math.min(255, b));
      px[o + 3] = Math.round(bgA * 255);
    }
  }
  return px;
}

// --- Encodeur PNG minimal (zlib natif + CRC32) ---------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // scanlines avec filtre 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, j * size * 4, size * 4).copy(raw, j * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Encodeur ICO (entrées BMP 32-bit BGRA + masque AND) ------------------

function bmpEntry(px, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);          // biSize
  header.writeInt32LE(size, 4);         // biWidth
  header.writeInt32LE(size * 2, 8);     // biHeight (XOR + AND)
  header.writeUInt16LE(1, 12);          // biPlanes
  header.writeUInt16LE(32, 14);         // biBitCount
  header.writeUInt32LE(size * size * 4, 20); // biSizeImage

  // XOR : BGRA, lignes de bas en haut
  const xor = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    const srcRow = size - 1 - j;
    for (let i = 0; i < size; i++) {
      const s = (srcRow * size + i) * 4;
      const d = (j * size + i) * 4;
      xor[d] = px[s + 2];     // B
      xor[d + 1] = px[s + 1]; // G
      xor[d + 2] = px[s];     // R
      xor[d + 3] = px[s + 3]; // A
    }
  }
  // AND : 1bpp tout à 0 (transparence gérée par le canal alpha)
  const andRow = ((size + 31) >> 5) * 4;
  const and = Buffer.alloc(andRow * size);
  return Buffer.concat([header, xor, and]);
}

function encodeIco(sizes) {
  const entries = sizes.map((s) => ({ size: s, data: bmpEntry(renderLogo(s), s) }));
  const dirSize = 6 + entries.length * 16;
  let offset = dirSize;
  const head = Buffer.alloc(dirSize);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type icon
  head.writeUInt16LE(entries.length, 4);
  entries.forEach((e, idx) => {
    const o = 6 + idx * 16;
    head[o] = e.size >= 256 ? 0 : e.size;     // width (0 = 256)
    head[o + 1] = e.size >= 256 ? 0 : e.size; // height
    head.writeUInt16LE(1, o + 4);             // planes
    head.writeUInt16LE(32, o + 6);            // bitcount
    head.writeUInt32LE(e.data.length, o + 8); // bytes
    head.writeUInt32LE(offset, o + 12);       // offset
    offset += e.data.length;
  });
  return Buffer.concat([head, ...entries.map((e) => e.data)]);
}

// --- Go -------------------------------------------------------------------

fs.writeFileSync(path.join(OUT, "icon.ico"), encodeIco([16, 24, 32, 48, 64, 128, 256]));
fs.writeFileSync(path.join(OUT, "icon.png"), encodePng(renderLogo(512), 512));
fs.writeFileSync(path.join(OUT, "tray-icon.png"), encodePng(renderLogo(32), 32));
console.log("✔ build/icon.ico, build/icon.png (512), build/tray-icon.png (32) générés");
