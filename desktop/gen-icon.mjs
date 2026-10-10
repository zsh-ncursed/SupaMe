// Генератор иконки трея: PNG 64×64 без внешних зависимостей (zlib из node).
// Рисуем «облачко с репликой» — белый комиксный баббл на синем скруглённом квадрате.
// Запуск: node desktop/gen-icon.mjs → desktop/tray.png
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZE = 64;
const SS = 4; // суперсэмплинг

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTri(px, py, ax, ay, bx, by, cx, cy) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

// цвета: [r, g, b, a]
const BLUE = [30, 136, 229, 255]; // #1E88E5
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function colorAt(x, y) {
  // координаты в единицах SIZE (0..64)
  if (inRoundRect(x, y, 2, 2, 62, 62, 15)) {
    // «строки текста» внутри баббла — раньше баббла, иначе недостижимы
    if (inRoundRect(x, y, 18, 19, 46, 25, 3)) return BLUE;
    if (inRoundRect(x, y, 18, 30, 40, 36, 3)) return BLUE;
    // баббл
    if (inRoundRect(x, y, 11, 9, 53, 43, 11)) return WHITE;
    // хвостик
    if (inTri(x, y, 20, 41, 36, 41, 25, 57)) return WHITE;
    return BLUE;
  }
  return TRANSPARENT;
}

// суперсэмплинг 4×4
const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = colorAt(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        const al = c[3] / 255;
        r += c[0] * al;
        g += c[1] * al;
        b += c[2] * al;
        a += c[3];
      }
    }
    const n = SS * SS;
    const i = (py * SIZE + px) * 4;
    rgba[i] = Math.round(r / n);
    rgba[i + 1] = Math.round(g / n);
    rgba[i + 2] = Math.round(b / n);
    rgba[i + 3] = Math.round(a / n);
  }
}

// --- запись PNG ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
// scanlines с фильтром 0
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, 'tray.png');
fs.writeFileSync(out, png);
console.log(`OK: ${out} (${png.length} bytes)`);
