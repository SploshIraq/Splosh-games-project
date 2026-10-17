// الصورة الافتراضية لكل الالعاب (خلفية الصور). تتغير بالامر `صورة الالعاب`
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const FILE = path.join(__dirname, '../data/bg.jpg');
let img = null;

async function init() {
  try { if (fs.existsSync(FILE)) img = await loadImage(fs.readFileSync(FILE)); }
  catch (e) { img = null; console.warn('⚠️ ما قدرت احمل data/bg.jpg:', e.message); }
}

// يقبل Buffer لاي صورة (png/jpg/webp)، يصغرها لو كبيرة ويحفظها
async function set(buf) {
  const src = await loadImage(buf); // يرمي خطأ اذا مو صورة
  const k = Math.min(1, 1600 / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  const c = createCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  x.drawImage(src, 0, 0, w, h);
  const out = c.toBuffer('image/jpeg', 90);
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, out); fs.renameSync(tmp, FILE);
  img = await loadImage(out);
}

function clear() {
  img = null;
  try { fs.unlinkSync(FILE); } catch {}
}

module.exports = { init, set, clear, get: () => img, has: () => !!img, FILE };
