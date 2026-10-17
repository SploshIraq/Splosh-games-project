const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { FONT, clean } = require('./util');
const bg = require('./bg');
const { GifWriter } = require('./gif');


let counter = 0;
const PI2 = Math.PI * 2;
const GOLD = ['#e8fffb', '#7be7d8', '#26b6a8', '#12766f', '#b5fff2'];
const goldGrad = (x, x0, y0, x1, y1) => {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  GOLD.forEach((c, i) => g.addColorStop(i / (GOLD.length - 1), c));
  return g;
};
const rgba = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const rr = (x, px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };
const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, PI2); };
const diamond = (x, cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); };
const glow = (x, cx, cy, r, col) => {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
};
const seedOf = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function star(x, cx, cy, R) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R / 2.2 : R;
    x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  x.closePath();
}
const sparkle = (x, cx, cy, r, col = '#fff6c8') => {
  x.save(); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12;
  x.beginPath(); x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill(); x.restore();
};

const att = (c, name) => {
  return new AttachmentBuilder(c.toBuffer('image/png'), { name: name || `img${Date.now()}_${counter++}.png` });
};
const nm = u => String(u?.displayName || u?.username || u).slice(0, 14);
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8'];

function frame(x, w, h) {
  x.save();
  x.strokeStyle = 'rgba(123,231,216,.86)'; x.lineWidth = 2; rr(x, 10, 10, w - 20, h - 20, 24); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; rr(x, 19, 19, w - 38, h - 38, 18); x.stroke();
  x.fillStyle = goldGrad(x, 0, 0, w, h);
  for (const [px, py] of [[28, 28], [w - 28, 28], [28, h - 28], [w - 28, h - 28]]) {
    x.beginPath(); x.arc(px, py, 3, 0, PI2); x.fill();
  }
  x.restore();
}

// يرسم الصورة الافتراضية (اذا انحطت بالامر `صورة الالعاب`) مع طبقة تغميق عشان الكتابة تبقى واضحة
const hex6 = h => (/^#[0-9a-f]{6}$/i.test(h) ? h : '#0a0f24');
function paintBg(x, w, h, c0, c1, dim) {
  const im = bg.get();
  if (!im) return false;
  const k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
  x.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  if (dim > 0) {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, rgba(hex6(c0), dim)); g.addColorStop(1, rgba(hex6(c1), dim));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  return true;
}

function base(w, h, c0 = '#091522', c1 = '#102b3a', accent = '#39cdbb', {
  frame: framed = true,
  dim = .6,
  glass = true,
} = {}) {
  const c = createCanvas(w, h), x = c.getContext('2d');
  const custom = paintBg(x, w, h, c0, c1, dim);
  if (!custom) {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  glow(x, w * .85, h * .12, Math.max(w, h) * .6, rgba(accent, .20));
  glow(x, w * .12, h * .95, Math.max(w, h) * .5, rgba(accent, .09));
  if (!custom) {
    x.strokeStyle = 'rgba(255,255,255,.026)'; x.lineWidth = 1;
    const st = Math.max(40, Math.round(Math.min(w, h) / 9));
    for (let k = -h; k < w; k += st) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke();
      x.beginPath(); x.moveTo(k + h, 0); x.lineTo(k, h); x.stroke();
    }
    const R = rng(w * 31 + h), n = Math.round(w * h / 9000);
    for (let i = 0; i < n; i++) { x.fillStyle = `rgba(255,240,200,${.05 + R() * .25})`; circ(x, R() * w, R() * h, .6 + R() * 1.5); x.fill(); }
  }
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  if (glass) {
    const inset = Math.max(16, Math.min(w, h) * .035);
    const radius = Math.max(14, inset * .72);
    x.save();
    rr(x, inset, inset, w - inset * 2, h - inset * 2, radius);
    x.clip();
    const sheen = x.createLinearGradient(inset, inset, w * .72, h * .7);
    sheen.addColorStop(0, 'rgba(255,255,255,.09)');
    sheen.addColorStop(.32, 'rgba(255,255,255,.025)');
    sheen.addColorStop(1, rgba(accent, .045));
    x.fillStyle = sheen;
    x.fillRect(inset, inset, w - inset * 2, h - inset * 2);
    x.restore();
    x.save();
    rr(x, inset, inset, w - inset * 2, h - inset * 2, radius);
    x.strokeStyle = 'rgba(255,255,255,.13)';
    x.lineWidth = Math.max(1, Math.min(w, h) * .0025);
    x.stroke();
    x.restore();
  }
  if (framed) frame(x, w, h);
  return [c, x];
}
function noise() {} // القديمة: التشويش صار جزء من base

function wrap(x, text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const label = (x, t, px, py, size = 28, color = '#fff', align = 'center') => {
  x.save();
  x.font = `bold ${size}px ${FONT}`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = Math.max(3, size * .12); x.shadowOffsetY = 2;
  x.fillText(clean(t) || '—', px, py);
  x.restore();
};
const fit = (x, t, size, maxW) => { let s = size; x.font = `bold ${s}px ${FONT}`; while (x.measureText(t).width > maxW && s > 16) { s -= 2; x.font = `bold ${s}px ${FONT}`; } return s; };
const goldLabel = (x, t, px, py, size = 34, align = 'center', maxW = 9999) => {
  t = clean(t) || '—';
  x.save();
  const s = fit(x, t, size, maxW);
  x.textAlign = align; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = Math.max(4, s * .1); x.shadowOffsetY = 3;
  x.fillStyle = goldGrad(x, 0, py - s / 2, 0, py + s / 2);
  x.fillText(t, px, py);
  x.restore();
};
function divider(x, cx, y, len) {
  x.save();
  for (const d of [-1, 1]) {
    const g = x.createLinearGradient(cx, 0, cx + d * len / 2, 0);
    g.addColorStop(0, 'rgba(123,231,216,.95)'); g.addColorStop(1, 'rgba(123,231,216,0)');
    x.fillStyle = g; x.fillRect(d > 0 ? cx + 12 : cx - len / 2, y - 1, len / 2 - 12, 2);
  }
  x.fillStyle = goldGrad(x, cx - 8, y - 8, cx + 8, y + 8); diamond(x, cx, y, 7); x.fill();
  x.restore();
}

// بطاقة نص عامة (سؤال، تعليمات...)
function card(title, text, { size = 44, w = 800, glass = true } = {}) {
  title = clean(title); text = text ? clean(text) : text;
  const tmp = createCanvas(w, 10).getContext('2d');
  tmp.font = `bold ${size}px ${FONT}`;
  const lines = text ? String(text).split('\n').flatMap(l => wrap(tmp, l, w - 144)) : [];
  const lineHeight = size + 18;
  const h = Math.max(260, 200 + lines.length * lineHeight + 34);
  const [c, x] = base(w, h, '#08111e', '#163c46', '#7be7d8', { glass });
  x.save();
  x.shadowColor = 'rgba(0,0,0,.42)'; x.shadowBlur = 26;
  rr(x, 34, 100, w - 68, h - 142, 26);
  const panel = x.createLinearGradient(34, 100, w - 34, h - 42);
  panel.addColorStop(0, 'rgba(12,29,43,.72)');
  panel.addColorStop(.55, 'rgba(8,19,31,.55)');
  panel.addColorStop(1, 'rgba(16,43,52,.68)');
  x.fillStyle = panel;
  x.fill();
  x.restore();
  x.save();
  rr(x, 34, 100, w - 68, h - 142, 26);
  x.strokeStyle = 'rgba(255,255,255,.16)';
  x.lineWidth = 1.5;
  x.stroke();
  x.restore();
  const badgeWidth = Math.min(w - 120, Math.max(164, tmp.measureText(title).width + 76));
  rr(x, (w - badgeWidth) / 2, 30, badgeWidth, 48, 24);
  x.fillStyle = 'rgba(123,231,216,.11)';
  x.fill();
  x.strokeStyle = 'rgba(123,231,216,.38)';
  x.lineWidth = 1.3;
  x.stroke();
  goldLabel(x, title, w / 2, 54, 33, 'center', badgeWidth - 32);
  divider(x, w / 2, 92, Math.min(w - 180, 380));
  lines.forEach((l, i) => label(x, l, w / 2, 130 + i * lineHeight + size / 2, size));
  return att(c);
}

function classicCard(title, text, options = {}) {
  const { size = 44, w = 800 } = options;
  title = clean(title);
  text = text ? clean(text) : text;
  const tmp = createCanvas(w, 10).getContext('2d');
  tmp.font = `bold ${size}px ${FONT}`;
  const lines = text ? String(text).split('\n').flatMap(line => wrap(tmp, line, w - 144)) : [];
  const lineHeight = size + 18;
  const h = Math.max(260, 200 + lines.length * lineHeight + 34);
  const [c, x] = base(w, h, '#091522', '#102b3a', '#39cdbb', { glass: false });
  x.save();
  x.shadowColor = 'rgba(0,0,0,.3)';
  x.shadowBlur = 20;
  rr(x, 38, 104, w - 76, h - 150, 22);
  x.fillStyle = 'rgba(6,16,27,.54)';
  x.fill();
  x.restore();
  goldLabel(x, title, w / 2, 52, 38, 'center', w - 120);
  divider(x, w / 2, 88, Math.min(w - 180, 360));
  lines.forEach((line, i) => label(x, line, w / 2, 128 + i * lineHeight + size / 2, size));
  return att(c);
}

// بطاقة سؤال للالعاب الفردية (التصميم من الصورة النموذج cut.png):
// عنوان ابيض كبير فوق، وتحته صندوق غامق بحواف دائرية فيه السؤال، وتوهج برتقالي من تحت وخط برتقالي سفلي.
// الخلفية شفافة (او الصورة الافتراضية اذا انحطت بالامر `صورة الالعاب`).
// image = صورة محملة (loadImage) تنعرض تحت الصندوق، panel = ترسمها فوق لوحة بيضاء (للشعارات)
// big = نص كبير داخل الصندوق (عملية حسابية، كلمة...)، noise = خطوط تشويش داخل الصندوق للالعاب الكتابية
function questionCard({ title = '', text = '', big = '', image = null, panel = false, bigSize = 0, noise = false, w = 1100 } = {}) {
  const strip = v => clean(String(v || '').replace(/\*\*/g, ''));
  title = strip(title); text = strip(text); big = clean(String(big || ''));
  const s = w / 1322; // كل القياسات من الصورة النموذج (عرضها 1322) ونحولها لعرض البطاقة
  const ORANGE = '#f95100', BOX = '#181818';
  const ts = Math.round(46 * s), lh = Math.round(ts * 1.4), padV = Math.round(30 * s), padH = Math.round(60 * s);
  const minBoxW = Math.round(860 * s), maxBoxW = w - Math.round(140 * s);
  const tmp = createCanvas(w, 10).getContext('2d');
  tmp.font = `bold ${ts}px ${FONT}`;
  const lines = text ? text.split('\n').flatMap(l => wrap(tmp, l, maxBoxW - padH * 2)) : [];
  const widest = Math.max(0, ...lines.map(l => tmp.measureText(l).width));
  const bs0 = bigSize || Math.round(92 * s * 1.1);
  const bs = big ? fit(tmp, big, bs0, maxBoxW - padH * 2) : 0;
  const bigW = big ? tmp.measureText(big).width : 0;
  const boxW = Math.round(Math.max(minBoxW, Math.min(maxBoxW, Math.max(widest, bigW) + padH * 2)));
  const content = lines.length * lh + (big ? (lines.length ? Math.round(14 * s) : 0) + Math.round(bs * 1.25) : 0);
  const boxH = Math.max(Math.round(114 * s), content + padV * 2);
  const border = Math.max(4, Math.round(6 * s)), radius = Math.round(38 * s);

  let iw = 0, ih = 0;
  if (image) {
    const k = panel ? Math.min(300 / image.width, 210 / image.height) : Math.min(640 / image.width, 340 / image.height);
    iw = image.width * k * (w / 1100); ih = image.height * k * (w / 1100);
  }
  const pad = panel ? Math.round(40 * s) : 0, gap = Math.round(34 * s);
  const boxY = title ? Math.round(184 * s) : Math.round(46 * s);
  const bottom = Math.round(64 * s); // مساحة شارة العلامة التجارية
  const h = boxY + boxH + border + (image ? gap + ih + pad * 2 : 0) + bottom;

  const c = createCanvas(w, h), x = c.getContext('2d');
  const background = x.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, '#090d16');
  background.addColorStop(.56, '#17191d');
  background.addColorStop(1, '#24130c');
  x.fillStyle = background;
  x.fillRect(0, 0, w, h);
  if (bg.has()) {
    paintBg(x, w, h, '#090d16', '#24130c', .68);
    x.fillStyle = 'rgba(7,10,16,.38)';
    x.fillRect(0, 0, w, h);
  }
  glow(x, w * .5, boxY + boxH * .5, w * .55, 'rgba(249,81,0,.08)');
  x.save();
  rr(x, Math.round(16 * s), Math.round(16 * s), w - Math.round(32 * s), h - Math.round(32 * s), Math.round(26 * s));
  x.strokeStyle = 'rgba(255,255,255,.09)';
  x.lineWidth = Math.max(1, Math.round(1.5 * s));
  x.stroke();
  x.restore();
  const cx = w / 2, bx = Math.round(cx - boxW / 2);

  if (title) { // العنوان: ابيض عريض بظل ناعم
    x.save();
    const tsz = fit(x, title, Math.round(104 * s), w - Math.round(120 * s));
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = Math.round(15 * s); x.shadowOffsetY = Math.round(7 * s);
    x.fillText(title, cx, Math.round(76 * s));
    x.restore();
  }
  if (title) {
    const badgeY = Math.round(158 * s), badgeW = Math.round(214 * s), badgeH = Math.round(34 * s);
    rr(x, cx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2);
    x.fillStyle = 'rgba(249,81,0,.13)';
    x.fill();
    x.strokeStyle = 'rgba(249,81,0,.58)';
    x.lineWidth = Math.max(1, Math.round(1.5 * s));
    x.stroke();
    x.save();
    x.fillStyle = ORANGE;
    x.beginPath();
    x.arc(cx - badgeW / 2 + badgeH * .65, badgeY, Math.max(3, badgeH * .12), 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#ffe3d1';
    x.font = `bold ${Math.round(19 * s)}px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('تحدي فردي', cx + badgeH * .12, badgeY);
    x.restore();
  }

  // الخط البرتقالي السفلي: نفس الصندوق مزاح لتحت، والغامق فوقه يخلي منه هلال رفيع
  x.save();
  x.shadowColor = 'rgba(249,81,0,.35)';
  x.shadowBlur = 24 * s;
  rr(x, bx, boxY + border, boxW, boxH, radius); x.fillStyle = ORANGE; x.fill();
  x.restore();
  rr(x, bx, boxY, boxW, boxH, radius); x.fillStyle = BOX; x.fill();
  x.save();
  rr(x, bx, boxY, boxW, boxH, radius);
  x.strokeStyle = 'rgba(255,255,255,.09)';
  x.lineWidth = Math.max(1, Math.round(1.5 * s));
  x.stroke();
  x.restore();

  x.save();
  rr(x, bx, boxY, boxW, boxH, radius); x.clip();
  // توهج برتقالي من اسفل الصندوق بالنص (قوي بالنص ويخف للأطراف)
  x.save();
  x.translate(cx, boxY + boxH); x.scale(1, 90 / 340);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 340 * s);
  g.addColorStop(0, 'rgba(249,81,0,.30)'); g.addColorStop(.5, 'rgba(249,81,0,.14)'); g.addColorStop(1, 'rgba(249,81,0,0)');
  x.fillStyle = g; x.fillRect(-340 * s, -340 * s, 680 * s, 340 * s);
  x.restore();
  if (noise) {
    for (let i = 0; i < 8; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 2;
      x.beginPath(); x.moveTo(bx + Math.random() * boxW, boxY + Math.random() * boxH); x.lineTo(bx + Math.random() * boxW, boxY + Math.random() * boxH); x.stroke();
    }
  }
  x.restore();

  // نص الصندوق
  x.save();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let ty = boxY + (boxH - content) / 2;
  x.font = `bold ${ts}px ${FONT}`;
  lines.forEach((l, i) => x.fillText(l, cx, ty + i * lh + lh / 2));
  if (big) {
    ty += lines.length * lh + (lines.length ? Math.round(14 * s) : 0);
    x.font = `bold ${bs}px ${FONT}`;
    x.fillText(big, cx, ty + bs * .62);
  }
  x.restore();

  if (image) {
    const y = boxY + boxH + border + gap;
    if (panel) {
      x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 24;
      rr(x, cx - iw / 2 - pad, y, iw + pad * 2, ih + pad * 2, 30); x.fillStyle = '#f7f7f2'; x.fill(); x.restore();
      x.drawImage(image, cx - iw / 2, y + pad, iw, ih);
      x.save();
      rr(x, cx - iw / 2 - pad, y, iw + pad * 2, ih + pad * 2, 30);
      x.strokeStyle = 'rgba(249,81,0,.62)';
      x.lineWidth = Math.max(2, Math.round(3 * s));
      x.stroke();
      x.restore();
    } else {
      x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 22;
      rr(x, cx - iw / 2, y, iw, ih, 18); x.fillStyle = '#000'; x.fill(); x.restore();
      x.save();
      rr(x, cx - iw / 2, y, iw, ih, 18);
      x.clip();
      x.drawImage(image, cx - iw / 2, y, iw, ih);
      x.restore();
      x.save();
      rr(x, cx - iw / 2, y, iw, ih, 18);
      x.strokeStyle = 'rgba(249,81,0,.62)';
      x.lineWidth = Math.max(2, Math.round(3 * s));
      x.stroke();
      x.restore();
    }
  }
  x.save();
  x.fillStyle = 'rgba(255,255,255,.58)';
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.font = `bold ${Math.round(17 * s)}px ${FONT}`;
  x.fillText('اكتب إجابتك في الدردشة', Math.round(40 * s), h - Math.round(34 * s));
  x.restore();
  return att(c);
}

/* ───────────── رسومات اللعبة (موتيف مختلف لكل لعبة) ───────────── */
const person = (x, px, py, s, col) => {
  x.fillStyle = col; circ(x, px, py - s * .3, s * .22); x.fill();
  x.beginPath(); x.ellipse(px, py + s * .52, s * .4, s * .36, 0, Math.PI, PI2); x.fill();
};
const arrow = (x, x0, y, x1, th, hw, col) => {
  const d = Math.sign(x1 - x0), hl = hw * 1.1;
  x.fillStyle = col; x.beginPath();
  x.moveTo(x0, y - th / 2); x.lineTo(x1 - d * hl, y - th / 2); x.lineTo(x1 - d * hl, y - hw);
  x.lineTo(x1, y); x.lineTo(x1 - d * hl, y + hw); x.lineTo(x1 - d * hl, y + th / 2); x.lineTo(x0, y + th / 2);
  x.closePath(); x.fill();
};
const metal = (x, cx, cy, r, c1, c2) => {
  const g = x.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
  g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
};

const M = {};
M.wheel = (x, cx, cy, R, a, o = {}) => {
  const n = 18, r = R * (o.waves || o.reverse || o.chain ? .6 : .74), st = PI2 / n, rot = -Math.PI / 2 - st / 2;
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 25;
  circ(x, cx, cy, r + 14); x.fillStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.fill(); x.restore();
  for (let i = 0; i < n; i++) {
    x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, rot + i * st, rot + (i + 1) * st); x.closePath();
    x.fillStyle = o.teams ? (i % 2 ? '#2a62ff' : '#e0334c') : i === 0 ? '#0b8f4d' : i % 2 ? '#14141a' : '#a3142e';
    x.fill(); x.strokeStyle = 'rgba(246,215,116,.55)'; x.lineWidth = 1.5; x.stroke();
  }
  const gl = x.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r);
  gl.addColorStop(0, 'rgba(255,255,255,.24)'); gl.addColorStop(.6, 'rgba(255,255,255,0)');
  circ(x, cx, cy, r); x.fillStyle = gl; x.fill();
  for (let i = 0; i < n; i++) { const an = rot + i * st; circ(x, cx + Math.cos(an) * (r + 7), cy + Math.sin(an) * (r + 7), 3.2); x.fillStyle = '#fff6c8'; x.fill(); }
  circ(x, cx, cy, r * .5); x.fillStyle = '#0d0d12'; x.fill(); x.strokeStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.lineWidth = 5; x.stroke();
  x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(i * Math.PI / 2 + .4) * r * .5, cy + Math.sin(i * Math.PI / 2 + .4) * r * .5); x.stroke(); }
  circ(x, cx, cy, r * .2); x.fillStyle = goldGrad(x, cx - r * .2, cy - r * .2, cx + r * .2, cy + r * .2); x.fill();
  x.save(); x.shadowColor = '#fff'; x.shadowBlur = 12; circ(x, cx + Math.cos(-.9) * r * .66, cy + Math.sin(-.9) * r * .66, 7); x.fillStyle = '#fff'; x.fill(); x.restore();
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 8;
  x.beginPath(); x.moveTo(cx, cy - r + 6); x.lineTo(cx - 15, cy - r - 26); x.lineTo(cx + 15, cy - r - 26); x.closePath();
  x.fillStyle = goldGrad(x, cx - 15, cy - r - 26, cx + 15, cy - r + 6); x.fill(); x.restore();
  if (o.waves) for (let k = 0; k < 3; k++) {
    x.strokeStyle = rgba(a, .85 - k * .25); x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, cy, r + 34 + k * 17, -.5, .5); x.stroke();
    x.beginPath(); x.arc(cx, cy, r + 34 + k * 17, Math.PI - .5, Math.PI + .5); x.stroke();
  }
  if (o.reverse) {
    const ra = r + 36, t0 = Math.PI * .15, t1 = Math.PI * .95;
    x.strokeStyle = a; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, cy, ra, t0, t1); x.stroke();
    const px = cx + Math.cos(t0) * ra, py = cy + Math.sin(t0) * ra, dx = Math.sin(t0), dy = -Math.cos(t0), qx = Math.cos(t0), qy = Math.sin(t0);
    x.fillStyle = a; x.beginPath(); x.moveTo(px + dx * 26, py + dy * 26); x.lineTo(px + qx * 17, py + qy * 17); x.lineTo(px - qx * 17, py - qy * 17); x.closePath(); x.fill();
  }
  if (o.chain) for (let i = 0; i < 14; i++) {
    const an = i * PI2 / 14; x.save(); x.translate(cx + Math.cos(an) * (r + 40), cy + Math.sin(an) * (r + 40)); x.rotate(an + Math.PI / 2);
    x.strokeStyle = goldGrad(x, -9, -14, 9, 14); x.lineWidth = 4.5; rr(x, i % 2 ? -7 : -10, -14, i % 2 ? 14 : 20, 28, 9); x.stroke(); x.restore();
  }
};
M.xo = (x, cx, cy, R, a) => {
  const s = R * 1.3, ox = cx - s / 2, oy = cy - s / 2, c = s / 3; x.lineCap = 'round';
  x.save(); x.shadowColor = a; x.shadowBlur = 14; x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6;
  for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(ox + i * c, oy + 6); x.lineTo(ox + i * c, oy + s - 6); x.stroke(); x.beginPath(); x.moveTo(ox + 6, oy + i * c); x.lineTo(ox + s - 6, oy + i * c); x.stroke(); }
  x.restore();
  const B = ['X', 'O', 'X', '', 'X', 'O', 'O', '', 'X'];
  B.forEach((v, k) => {
    const mx = ox + (k % 3) * c + c / 2, my = oy + Math.floor(k / 3) * c + c / 2, q = c * .27;
    x.save(); x.lineWidth = 12; x.shadowBlur = 16;
    if (v === 'X') { x.strokeStyle = x.shadowColor = '#ff4d6d'; x.beginPath(); x.moveTo(mx - q, my - q); x.lineTo(mx + q, my + q); x.moveTo(mx + q, my - q); x.lineTo(mx - q, my + q); x.stroke(); }
    if (v === 'O') { x.strokeStyle = x.shadowColor = '#4db8ff'; circ(x, mx, my, q * 1.1); x.stroke(); }
    x.restore();
  });
  x.save(); x.strokeStyle = '#f7d774'; x.shadowColor = '#f7d774'; x.shadowBlur = 18; x.lineWidth = 8;
  x.beginPath(); x.moveTo(ox + 14, oy + 14); x.lineTo(ox + s - 14, oy + s - 14); x.stroke(); x.restore();
};
M.connect = (x, cx, cy, R, a) => {
  const cell = R * .23, bw = cell * 7, bh = cell * 6, ox = cx - bw / 2, oy = cy - bh / 2;
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 18; rr(x, ox, oy, bw, bh, 16);
  const g = x.createLinearGradient(0, oy, 0, oy + bh); g.addColorStop(0, '#2c4fc9'); g.addColorStop(1, '#10247a'); x.fillStyle = g; x.fill(); x.restore();
  const win = new Set(['5,0', '4,1', '3,2', '2,3']);
  for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) {
    const px = ox + k * cell + cell / 2, py = oy + r * cell + cell / 2, v = (r * 3 + k * 5) % 7, w = win.has(r + ',' + k);
    circ(x, px, py, cell * .38); x.fillStyle = '#050a22'; x.fill();
    if (w || v < 2 || v === 3) {
      const yel = w || v === 3; circ(x, px, py, cell * .34);
      x.fillStyle = metal(x, px, py, cell * .34, yel ? '#fff3a0' : '#ff9a9a', yel ? '#d9a300' : '#b3202a'); x.fill();
      if (w) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke(); }
    }
  }
};
M.mine = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .35));
  const r = R * .42;
  x.strokeStyle = '#1b1b1f'; x.lineWidth = 12; x.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const an = i * PI2 / 12; x.beginPath(); x.moveTo(cx + Math.cos(an) * r * .8, cy + Math.sin(an) * r * .8); x.lineTo(cx + Math.cos(an) * r * 1.42, cy + Math.sin(an) * r * 1.42); x.stroke(); circ(x, cx + Math.cos(an) * r * 1.46, cy + Math.sin(an) * r * 1.46, 8); x.fillStyle = '#2a2a30'; x.fill(); }
  circ(x, cx, cy, r); x.fillStyle = metal(x, cx, cy, r, '#5a5a66', '#0b0b0e'); x.fill(); x.strokeStyle = a; x.lineWidth = 4; x.stroke();
  x.save(); x.shadowColor = a; x.shadowBlur = 22; circ(x, cx, cy - r * .1, r * .17); x.fillStyle = a; x.fill(); x.restore();
};
M.treasure = (x, cx, cy, R, a) => {
  glow(x, cx, cy - 10, R * 1.05, rgba('#ffd45a', .4));
  x.strokeStyle = rgba('#ffe58a', .35); x.lineWidth = 5; for (let i = 0; i < 9; i++) { const an = -Math.PI + (i + .5) * Math.PI / 9; x.beginPath(); x.moveTo(cx + Math.cos(an) * R * .35, cy + Math.sin(an) * R * .3); x.lineTo(cx + Math.cos(an) * R * .95, cy + Math.sin(an) * R * .85); x.stroke(); }
  const w = R * 1.15, ox = cx - w / 2, wood = x.createLinearGradient(0, cy, 0, cy + R * .55); wood.addColorStop(0, '#9b6416'); wood.addColorStop(1, '#4a2b07');
  rr(x, ox + 8, cy - R * .42, w - 16, R * .34, [14, 14, 0, 0]); x.fillStyle = wood; x.fill(); x.strokeStyle = goldGrad(x, ox, cy, ox + w, cy); x.lineWidth = 4; x.stroke();
  x.fillStyle = goldGrad(x, cx - 60, cy - 30, cx + 60, cy + 10); x.beginPath(); x.ellipse(cx, cy - 6, w / 2 - 12, 20, 0, 0, PI2); x.fill();
  for (let i = 0; i < 7; i++) { circ(x, cx - 54 + i * 18, cy - 20 - (i % 3) * 7, 11); x.fillStyle = goldGrad(x, cx - 54 + i * 18, cy - 30, cx - 44 + i * 18, cy - 10); x.fill(); x.strokeStyle = '#8f5f10'; x.lineWidth = 1.5; x.stroke(); }
  rr(x, ox, cy, w, R * .55, 12); x.fillStyle = wood; x.fill(); x.strokeStyle = goldGrad(x, ox, cy, ox + w, cy + R * .5); x.lineWidth = 5; x.stroke();
  x.fillStyle = goldGrad(x, ox, cy, ox + 20, cy); for (const bx of [ox + w * .16, ox + w * .78]) x.fillRect(bx, cy, 16, R * .55);
  rr(x, cx - 15, cy + 8, 30, 34, 7); x.fillStyle = goldGrad(x, cx - 15, cy, cx + 15, cy + 40); x.fill(); circ(x, cx, cy + 22, 5); x.fillStyle = '#3a2305'; x.fill();
  sparkle(x, cx - R * .6, cy - R * .5, 13); sparkle(x, cx + R * .55, cy - R * .6, 17); sparkle(x, cx + R * .15, cy - R * .78, 10);
};
M.guess = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .3));
  x.save(); x.font = `bold ${R * 1.45}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = a; x.shadowBlur = 28; x.fillStyle = goldGrad(x, 0, cy - R * .7, 0, cy + R * .7); x.fillText('?', cx, cy + R * .06); x.restore();
  for (let i = 0; i < 3; i++) { const an = -2.4 + i * 1.2; circ(x, cx + Math.cos(an) * R * .82, cy + Math.sin(an) * R * .82, 8 + i * 2); x.fillStyle = rgba(a, .85); x.fill(); }
};
M.hide = (x, cx, cy, R, a) => {
  const dw = R * .95, dh = R * 1.35, ox = cx - dw / 2, oy = cy - dh / 2;
  rr(x, ox - 10, oy - 10, dw + 20, dh + 20, [60, 60, 8, 8]); x.fillStyle = '#1a1208'; x.fill(); x.strokeStyle = goldGrad(x, ox, oy, ox + dw, oy + dh); x.lineWidth = 5; x.stroke();
  rr(x, ox, oy, dw, dh, [50, 50, 4, 4]); const g = x.createLinearGradient(0, oy, 0, oy + dh); g.addColorStop(0, '#000'); g.addColorStop(1, '#0d0a14'); x.fillStyle = g; x.fill();
  x.beginPath(); x.ellipse(cx, cy - R * .08, R * .36, R * .2, 0, 0, PI2); x.fillStyle = '#f4f4f4'; x.fill();
  circ(x, cx + R * .08, cy - R * .08, R * .15); x.fillStyle = metal(x, cx, cy, R * .15, a, '#07202a'); x.fill();
  circ(x, cx + R * .08, cy - R * .08, R * .07); x.fillStyle = '#000'; x.fill(); circ(x, cx + R * .12, cy - R * .13, R * .03); x.fillStyle = '#fff'; x.fill();
  x.strokeStyle = '#000'; x.lineWidth = 6; x.beginPath(); x.ellipse(cx, cy - R * .08, R * .36, R * .2, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
  glow(x, cx + R * .08, cy - R * .08, R * .5, rgba(a, .18));
};
M.bar = (x, cx, cy, R, a) => {
  const defs = [[-R * .56, '#ff5fae', R * .68, 0], [0, '#38c6ff', R * .8, 1], [R * .56, '#ff3b3b', R * .68, 2]];
  rr(x, cx - R * .85, cy + R * .48, R * 1.7, 14, 7); x.fillStyle = goldGrad(x, cx - R, cy, cx + R, cy); x.fill();
  for (const [dx, col, h, k] of defs) {
    const px = cx + dx, top = cy + R * .48 - h, tw = R * .42, bw = R * .24;
    x.strokeStyle = k === 1 ? '#ffd1ec' : '#ffe9a8'; x.lineWidth = 5; x.beginPath(); x.moveTo(px + 6, top - 18); x.lineTo(px + 22, top + h * .45); x.stroke();
    x.beginPath(); x.moveTo(px - tw / 2, top); x.lineTo(px + tw / 2, top); x.lineTo(px + bw / 2, top + h); x.lineTo(px - bw / 2, top + h); x.closePath();
    const g = x.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, col + 'dd'); g.addColorStop(1, col); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(px - tw / 2 + 8, top + 8, 6, h * .6);
    circ(x, px - tw / 2 + 2, top, 13); x.fillStyle = k === 2 ? '#9cff6a' : '#ffb340'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
  }
  x.save(); x.shadowColor = '#ff3b3b'; x.shadowBlur = 14; label(x, 'X', cx + R * .56, cy + R * .1, 36, '#fff'); x.restore();
};
M.silence = (x, cx, cy, R, a) => {
  const k = R / 165; glow(x, cx, cy, R, rgba(a, .22));
  x.beginPath(); [[-80, -28], [-38, -28], [10, -72], [10, 72], [-38, 28], [-80, 28]].forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](cx + px * k, cy + py * k)); x.closePath();
  x.fillStyle = goldGrad(x, cx - 80 * k, cy - 70 * k, cx + 10 * k, cy + 70 * k); x.fill();
  x.strokeStyle = rgba(a, .5); x.lineWidth = 7; x.lineCap = 'round'; for (let i = 0; i < 2; i++) { x.beginPath(); x.arc(cx + 14 * k, cy, (36 + i * 28) * k, -.8, .8); x.stroke(); }
  x.lineWidth = 22; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(cx - 92 * k, cy - 92 * k); x.lineTo(cx + 92 * k, cy + 92 * k); x.stroke();
  x.lineWidth = 12; x.strokeStyle = '#e8283c'; x.stroke();
};
M.replica = (x, cx, cy, R, a) => {
  const cols = ['#e8283c', '#2f6bff', '#f5c518', '#22c06a'], lit = 2;
  for (let i = 0; i < 4; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI / 2 + .06, a1 = a0 + Math.PI / 2 - .12;
    x.save(); if (i === lit) { x.shadowColor = cols[i]; x.shadowBlur = 30; }
    x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R * .78, a0, a1); x.closePath(); x.fillStyle = i === lit ? cols[i] : cols[i] + '88'; x.fill();
    x.strokeStyle = goldGrad(x, cx - R, cy - R, cx + R, cy + R); x.lineWidth = 3; x.stroke(); x.restore();
  }
  circ(x, cx, cy, R * .26); x.fillStyle = '#0b0b10'; x.fill(); x.strokeStyle = goldGrad(x, cx - 30, cy - 30, cx + 30, cy + 30); x.lineWidth = 5; x.stroke();
  sparkle(x, cx, cy, R * .12);
};
M.squid = (x, cx, cy, R, a) => {
  const y1 = cy - R * .3, s = R * .27, pink = '#ff2d87';
  x.lineWidth = 8; x.strokeStyle = pink; x.fillStyle = rgba(pink, .2);
  circ(x, cx - R * .6, y1, s * .75); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(cx, y1 - s * .85); x.lineTo(cx + s * .85, y1 + s * .7); x.lineTo(cx - s * .85, y1 + s * .7); x.closePath(); x.fill(); x.stroke();
  rr(x, cx + R * .6 - s * .7, y1 - s * .7, s * 1.4, s * 1.4, 6); x.fill(); x.stroke();
  const y2 = cy + R * .45;
  rr(x, cx - R * .6, y2 - 38, R * 1.2, 76, 38); x.fillStyle = '#0a0a0d'; x.fill(); x.strokeStyle = goldGrad(x, cx - R, y2, cx + R, y2); x.lineWidth = 4; x.stroke();
  x.save(); x.shadowColor = '#ff2a2a'; x.shadowBlur = 26; circ(x, cx - R * .3, y2, 25); x.fillStyle = '#ff2a2a'; x.fill(); x.restore();
  circ(x, cx + R * .3, y2, 25); x.fillStyle = '#12351f'; x.fill();
};
M.buttons = (x, cx, cy, R, a) => {
  const cols = ['#ff4d6d', '#4db8ff', '#ffd166', '#7cf29a', '#c77dff', '#ff9a3c'], sp = R * .56;
  for (let i = 0; i < 9; i++) {
    const px = cx + ((i % 3) - 1) * sp, py = cy + (Math.floor(i / 3) - 1) * sp, col = cols[i % 6], on = i === 4;
    x.save(); x.shadowColor = on ? col : 'rgba(0,0,0,.6)'; x.shadowBlur = on ? 30 : 10; circ(x, px, py, R * .22);
    x.fillStyle = metal(x, px, py, R * .22, '#ffffff', col); x.fill(); x.restore();
    x.strokeStyle = on ? '#fff' : goldGrad(x, px - 20, py - 20, px + 20, py + 20); x.lineWidth = on ? 5 : 3; circ(x, px, py, R * .22); x.stroke();
    if (on) { x.strokeStyle = rgba(col, .6); x.lineWidth = 3; circ(x, px, py, R * .3); x.stroke(); }
  }
};
M.mafia = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .25)); x.save(); circ(x, cx, cy, R - 2); x.clip();
  x.beginPath(); x.moveTo(cx - R * .7, cy + R * .95); x.quadraticCurveTo(cx - R * .6, cy + R * .45, cx - R * .18, cy + R * .4); x.lineTo(cx + R * .18, cy + R * .4); x.quadraticCurveTo(cx + R * .6, cy + R * .45, cx + R * .7, cy + R * .95); x.closePath(); x.fillStyle = '#0d0d12'; x.fill();
  x.beginPath(); x.moveTo(cx - R * .16, cy + R * .4); x.lineTo(cx, cy + R * .7); x.lineTo(cx + R * .16, cy + R * .4); x.closePath(); x.fillStyle = '#eee'; x.fill();
  x.beginPath(); x.moveTo(cx - 8, cy + R * .52); x.lineTo(cx + 8, cy + R * .52); x.lineTo(cx + 12, cy + R * .85); x.lineTo(cx, cy + R * .95); x.lineTo(cx - 12, cy + R * .85); x.closePath(); x.fillStyle = a; x.fill();
  x.beginPath(); x.ellipse(cx, cy + R * .12, R * .27, R * .33, 0, 0, PI2); x.fillStyle = '#16161c'; x.fill();
  x.save(); x.shadowColor = a; x.shadowBlur = 12; x.fillStyle = '#f2f2f2'; x.fillRect(cx - R * .19, cy + R * .06, R * .13, 5); x.fillRect(cx + R * .06, cy + R * .06, R * .13, 5); x.restore();
  x.beginPath(); x.moveTo(cx - R * .3, cy - R * .08); x.quadraticCurveTo(cx - R * .34, cy - R * .62, cx - R * .1, cy - R * .6); x.quadraticCurveTo(cx, cy - R * .5, cx + R * .1, cy - R * .6); x.quadraticCurveTo(cx + R * .34, cy - R * .62, cx + R * .3, cy - R * .08); x.closePath(); x.fillStyle = '#08080a'; x.fill();
  x.fillStyle = a; x.fillRect(cx - R * .31, cy - R * .2, R * .62, R * .1);
  x.beginPath(); x.ellipse(cx, cy - R * .06, R * .66, R * .15, 0, 0, PI2); x.fillStyle = '#0b0b0e'; x.fill(); x.strokeStyle = goldGrad(x, cx - R, cy, cx + R, cy); x.lineWidth = 3; x.stroke(); x.restore();
};
M.outsider = (x, cx, cy, R, a) => {
  const sp = R * .55;
  for (let i = 0; i < 9; i++) {
    const px = cx + ((i % 3) - 1) * sp, py = cy + (Math.floor(i / 3) - 1) * sp * 1.05 + 8, odd = i === 2;
    person(x, px, py, R * .38, odd ? a : 'rgba(205,215,230,.55)');
    if (odd) { x.save(); x.shadowColor = a; x.shadowBlur = 20; person(x, px, py, R * .38, a); x.restore(); }
  }
  const mx = cx + sp, my = cy - sp * 1.05 + 8;
  x.strokeStyle = goldGrad(x, mx - 40, my - 40, mx + 40, my + 40); x.lineWidth = 7; circ(x, mx, my, R * .3); x.stroke();
  x.lineCap = 'round'; x.lineWidth = 11; x.beginPath(); x.moveTo(mx + R * .21, my + R * .21); x.lineTo(mx + R * .48, my + R * .48); x.stroke();
};
M.flags = (x, cx, cy, R, a) => {
  const fx = cx - R * .45, top = cy - R * .72, fw = R * 1.15, fh = R * .66;
  x.strokeStyle = goldGrad(x, fx, top, fx, cy + R); x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(fx, top - 10); x.lineTo(fx, cy + R * .85); x.stroke();
  circ(x, fx, top - 14, 8); x.fillStyle = goldGrad(x, fx - 8, top - 22, fx + 8, top - 6); x.fill();
  const wave = (t, o) => top + o + Math.sin(t * Math.PI * 2.2) * 9 * t;
  const cols = ['#2f9bff', '#f4f4f4', '#f7d774'];
  cols.forEach((col, b) => {
    x.beginPath();
    for (let i = 0; i <= 30; i++) { const t = i / 30; x[i ? 'lineTo' : 'moveTo'](fx + t * fw, wave(t, fh / 3 * b)); }
    for (let i = 30; i >= 0; i--) { const t = i / 30; x.lineTo(fx + t * fw, wave(t, fh / 3 * (b + 1))); }
    x.closePath(); x.fillStyle = col; x.fill();
  });
  x.save(); x.shadowColor = '#e8283c'; x.shadowBlur = 10; star(x, fx + fw * .5, wave(.5, fh / 2), 14); x.fillStyle = '#e8283c'; x.fill(); x.restore();
};
M.capitals = (x, cx, cy, R, a) => {
  const r = R * .68; glow(x, cx, cy, R, rgba(a, .25));
  circ(x, cx, cy, r); x.fillStyle = metal(x, cx, cy, r, '#3f9ad8', '#06203d'); x.fill();
  x.save(); circ(x, cx, cy, r); x.clip(); x.fillStyle = 'rgba(80,200,120,.75)';
  for (const [dx, dy, rx, ry] of [[-.25, -.2, .3, .22], [.25, .1, .22, .32], [-.1, .45, .2, .14], [.4, -.4, .15, .1]]) { x.beginPath(); x.ellipse(cx + dx * r, cy + dy * r, rx * r, ry * r, .4, 0, PI2); x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2;
  for (const k of [.35, .7]) { x.beginPath(); x.ellipse(cx, cy, r * k, r, 0, 0, PI2); x.stroke(); }
  for (const k of [-.5, 0, .5]) { x.beginPath(); x.moveTo(cx - r, cy + k * r); x.lineTo(cx + r, cy + k * r); x.stroke(); }
  x.restore(); x.strokeStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.lineWidth = 6; circ(x, cx, cy, r); x.stroke();
  const px = cx + r * .32, py = cy - r * .25;
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 12; x.beginPath(); x.arc(px, py - 30, 26, Math.PI * .8, Math.PI * .2); x.lineTo(px, py + 18); x.closePath(); x.fillStyle = '#e8283c'; x.fill(); x.restore();
  circ(x, px, py - 30, 10); x.fillStyle = '#fff'; x.fill();
};
M.math = (x, cx, cy, R, a) => {
  const t = R * .6, g = R * .1, syms = ['+', '−', '×', '÷'];
  syms.forEach((s, i) => {
    const px = cx + (i % 2 ? 1 : -1) * (t / 2 + g / 2), py = cy + (i < 2 ? -1 : 1) * (t / 2 + g / 2);
    rr(x, px - t / 2, py - t / 2, t, t, 16); x.fillStyle = rgba(a, .18); x.fill(); x.strokeStyle = goldGrad(x, px - t / 2, py - t / 2, px + t / 2, py + t / 2); x.lineWidth = 4; x.stroke();
    x.save(); x.font = `bold ${t * .8}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = a; x.shadowBlur = 14; x.fillStyle = goldGrad(x, 0, py - t / 2, 0, py + t / 2); x.fillText(s, px, py + 2); x.restore();
  });
};
M.letters = (x, cx, cy, R, a, o = {}) => {
  const L = o.letters || ['ف', 'ك', 'ك'], s = R * .52, pos = o.link ? [[-.6, .25, -.12], [0, -.3, .1], [.6, .25, -.06]] : [[-.55, -.1, -.28], [.05, .35, .2], [.55, -.2, .12]];
  if (o.link) { x.strokeStyle = rgba(a, .9); x.lineWidth = 6; x.setLineDash([2, 12]); x.lineCap = 'round'; x.beginPath(); pos.forEach(([dx, dy], i) => x[i ? 'lineTo' : 'moveTo'](cx + dx * R, cy + dy * R)); x.stroke(); x.setLineDash([]); }
  L.forEach((ch, i) => {
    const [dx, dy, rot] = pos[i]; x.save(); x.translate(cx + dx * R, cy + dy * R); x.rotate(rot);
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 14; rr(x, -s / 2, -s / 2, s, s, 14); x.fillStyle = '#12121a'; x.fill(); x.shadowBlur = 0;
    x.strokeStyle = goldGrad(x, -s / 2, -s / 2, s / 2, s / 2); x.lineWidth = 4; x.stroke();
    x.font = `bold ${s * .72}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = goldGrad(x, 0, -s / 2, 0, s / 2); x.fillText(ch, 0, 4); x.restore();
  });
};
M.speed = (x, cx, cy, R, a) => {
  const r = R * .56, ox = R * .1; cx += ox;
  x.strokeStyle = rgba(a, .8); x.lineWidth = 7; x.lineCap = 'round'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - r - R * .55 + i * 14, cy - 40 + i * 40); x.lineTo(cx - r - R * .1 + i * 8, cy - 40 + i * 40); x.stroke(); }
  rr(x, cx - 14, cy - r - 30, 28, 22, 5); x.fillStyle = goldGrad(x, cx - 14, cy - r - 30, cx + 14, cy - r - 8); x.fill();
  circ(x, cx, cy, r + 10); x.fillStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.fill();
  circ(x, cx, cy, r); x.fillStyle = metal(x, cx, cy, r, '#2a2a38', '#06060a'); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.65)'; x.lineWidth = 3; for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; x.beginPath(); x.moveTo(cx + Math.cos(an) * r * .82, cy + Math.sin(an) * r * .82); x.lineTo(cx + Math.cos(an) * r * .94, cy + Math.sin(an) * r * .94); x.stroke(); }
  x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r * .8, -Math.PI / 2, -Math.PI / 2 + 1.1); x.closePath(); x.fillStyle = rgba(a, .35); x.fill();
  x.save(); x.shadowColor = a; x.shadowBlur = 14; x.strokeStyle = a; x.lineWidth = 6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(-Math.PI / 2 + 1.1) * r * .78, cy + Math.sin(-Math.PI / 2 + 1.1) * r * .78); x.stroke(); x.restore();
  circ(x, cx, cy, 9); x.fillStyle = '#fff'; x.fill();
};
M.opposite = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .22));
  x.save(); x.shadowColor = a; x.shadowBlur = 20;
  arrow(x, cx - R * .62, cy - R * .26, cx + R * .62, R * .2, R * .26, '#f7d774');
  arrow(x, cx + R * .62, cy + R * .26, cx - R * .62, R * .2, R * .26, a); x.restore();
};
M.plural = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .22));
  person(x, cx - R * .5, cy + R * .05, R * .8, 'rgba(255,255,255,.45)'); person(x, cx + R * .5, cy + R * .05, R * .8, 'rgba(255,255,255,.45)');
  x.save(); x.shadowColor = a; x.shadowBlur = 22; person(x, cx, cy + R * .12, R * 1.05, a); x.restore();
  x.font = `bold ${R * .5}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = goldGrad(x, 0, cy - R * .8, 0, cy - R * .3); x.fillText('+', cx + R * .72, cy - R * .62);
};
M.singular = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .3)); circ(x, cx, cy + 5, R * .72); x.strokeStyle = goldGrad(x, cx - R, cy - R, cx + R, cy + R); x.lineWidth = 5; x.stroke();
  x.save(); x.shadowColor = a; x.shadowBlur = 24; person(x, cx, cy + R * .08, R * 1.15, a); x.restore();
  x.font = `bold ${R * .45}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = goldGrad(x, 0, cy - R * .8, 0, cy - R * .3); x.fillText('1', cx + R * .7, cy - R * .6);
};
M.truefalse = (x, cx, cy, R, a) => {
  const r = R * .7;
  x.save(); x.beginPath(); x.rect(cx - r - 5, cy - r - 5, r + 5, r * 2 + 10); x.clip(); circ(x, cx, cy, r); x.fillStyle = metal(x, cx - r * .4, cy, r, '#4cf59a', '#0a5d33'); x.fill(); x.restore();
  x.save(); x.beginPath(); x.rect(cx, cy - r - 5, r + 5, r * 2 + 10); x.clip(); circ(x, cx, cy, r); x.fillStyle = metal(x, cx + r * .4, cy, r, '#ff7a7a', '#7a0f1c'); x.fill(); x.restore();
  x.strokeStyle = '#fff'; x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(cx - r * .62, cy + 4); x.lineTo(cx - r * .38, cy + r * .3); x.lineTo(cx - r * .1, cy - r * .3); x.stroke();
  x.beginPath(); x.moveTo(cx + r * .18, cy - r * .3); x.lineTo(cx + r * .62, cy + r * .3); x.moveTo(cx + r * .62, cy - r * .3); x.lineTo(cx + r * .18, cy + r * .3); x.stroke();
  circ(x, cx, cy, r); x.strokeStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.lineWidth = 7; x.stroke();
  x.fillStyle = goldGrad(x, cx - 4, cy - r, cx + 4, cy + r); x.fillRect(cx - 3, cy - r, 6, r * 2);
};
M.memory = (x, cx, cy, R, a) => {
  const cw = R * .46, ch = R * .62, g = R * .1;
  for (let i = 0; i < 6; i++) {
    const px = cx + ((i % 3) - 1) * (cw + g), py = cy + (Math.floor(i / 3) - .5) * (ch + g) + 0, up = i === 1 || i === 4;
    x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 12; rr(x, px - cw / 2, py - ch / 2, cw, ch, 12); x.fillStyle = up ? '#f6f1de' : '#161232'; x.fill(); x.restore();
    x.strokeStyle = goldGrad(x, px - cw / 2, py - ch / 2, px + cw / 2, py + ch / 2); x.lineWidth = 3; x.stroke();
    if (up) { x.save(); x.shadowColor = a; x.shadowBlur = 12; star(x, px, py, cw * .33); x.fillStyle = i === 1 ? '#e8283c' : '#2f6bff'; x.fill(); x.restore(); }
    else { x.fillStyle = rgba(a, .85); diamond(x, px, py, cw * .22); x.fill(); x.strokeStyle = rgba(a, .35); x.lineWidth = 2; rr(x, px - cw / 2 + 8, py - ch / 2 + 8, cw - 16, ch - 16, 7); x.stroke(); }
  }
};
M.number = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .25));
  for (let i = 0; i < 3; i++) { x.strokeStyle = i === 1 ? rgba(a, .9) : 'rgba(255,255,255,.35)'; x.lineWidth = i === 1 ? 5 : 3; circ(x, cx, cy, R * (.35 + i * .2)); x.stroke(); }
  x.strokeStyle = rgba(a, .9); x.lineWidth = 4; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { x.beginPath(); x.moveTo(cx + dx * R * .62, cy + dy * R * .62); x.lineTo(cx + dx * R * .92, cy + dy * R * .92); x.stroke(); }
  x.save(); x.font = `bold ${R * .6}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = a; x.shadowBlur = 20; x.fillStyle = goldGrad(x, 0, cy - R * .3, 0, cy + R * .3); x.fillText('7', cx, cy + 4); x.restore();
};
M.chat = (x, cx, cy, R, a) => {
  const bub = (px, py, w, h, col, tail, dots) => {
    x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14; rr(x, px, py, w, h, 28); x.fillStyle = col; x.fill();
    x.beginPath(); x.moveTo(px + (tail > 0 ? w - 40 : 30), py + h - 2); x.lineTo(px + (tail > 0 ? w - 12 : 12), py + h + 30); x.lineTo(px + (tail > 0 ? w - 70 : 70), py + h - 2); x.closePath(); x.fill(); x.restore();
    for (let i = 0; i < 3; i++) { circ(x, px + w / 2 + (i - 1) * 26, py + h / 2, 7); x.fillStyle = dots; x.fill(); }
  };
  bub(cx - R * .72, cy - R * .6, R * .95, R * .55, '#f4efe0', -1, '#8f5f10');
  bub(cx - R * .22, cy + R * .1, R * .95, R * .55, '#8fa3c4', 1, '#fff');
};
M.logo = (x, cx, cy, R, a) => {
  const hex = (r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + i * Math.PI / 3; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * r, cy + Math.sin(an) * r); } x.closePath(); };
  glow(x, cx, cy, R, rgba(a, .22)); hex(R * .8); x.fillStyle = '#12121a'; x.fill(); x.strokeStyle = goldGrad(x, cx - R, cy - R, cx + R, cy + R); x.lineWidth = 8; x.stroke();
  hex(R * .62); x.strokeStyle = rgba(a, .5); x.lineWidth = 3; x.stroke();
  x.save(); x.shadowColor = a; x.shadowBlur = 24; star(x, cx, cy + 4, R * .34); x.fillStyle = goldGrad(x, cx - 40, cy - 40, cx + 40, cy + 40); x.fill(); x.restore();
};
M.russian = (x, cx, cy, R, a) => {
  const r = R * .72; glow(x, cx, cy, R, rgba(a, .25));
  circ(x, cx, cy, r); x.fillStyle = metal(x, cx, cy, r, '#6a6a76', '#14141a'); x.fill(); x.strokeStyle = goldGrad(x, cx - r, cy - r, cx + r, cy + r); x.lineWidth = 6; x.stroke();
  for (let i = 0; i < 6; i++) {
    const an = -Math.PI / 2 + i * Math.PI / 3, px = cx + Math.cos(an) * r * .55, py = cy + Math.sin(an) * r * .55;
    circ(x, px, py, r * .2); x.fillStyle = '#050507'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.stroke();
    if (i === 0) { circ(x, px, py, r * .14); x.fillStyle = goldGrad(x, px - 12, py - 12, px + 12, py + 12); x.fill(); }
    x.save(); x.translate(cx, cy); x.rotate(an + Math.PI / 6); x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(r * .84, -5, r * .2, 10); x.restore();
  }
  circ(x, cx, cy, r * .13); x.fillStyle = goldGrad(x, cx - 14, cy - 14, cx + 14, cy + 14); x.fill();
};
M.bomb = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .3)); const r = R * .55, bx = cx - R * .08, by = cy + R * .15;
  circ(x, bx, by, r); x.fillStyle = metal(x, bx, by, r, '#70707c', '#050507'); x.fill();
  x.save(); x.translate(bx + r * .55, by - r * .78); x.rotate(.7); rr(x, -22, -14, 44, 28, 6); x.fillStyle = goldGrad(x, -22, -14, 22, 14); x.fill(); x.restore();
  x.strokeStyle = '#d9c9a0'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(bx + r * .7, by - r * .95); x.quadraticCurveTo(bx + r * 1.0, by - r * 1.25, bx + r * .8, by - r * 1.55); x.stroke();
  x.save(); x.shadowColor = a; x.shadowBlur = 28; star(x, bx + r * .8, by - r * 1.6, 24); x.fillStyle = '#fff3a0'; x.fill(); star(x, bx + r * .8, by - r * 1.6, 13); x.fillStyle = a; x.fill(); x.restore();
};
M.boom = (x, cx, cy, R, a) => {
  const burst = (r0, r1, n, col, rot) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const an = rot + i * Math.PI / n, r = i % 2 ? r0 : r1; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * r, cy + Math.sin(an) * r); } x.closePath(); x.fillStyle = col; x.fill(); };
  x.save(); x.shadowColor = a; x.shadowBlur = 35;
  burst(R * .5, R * .95, 11, '#c0391b', 0); burst(R * .38, R * .74, 11, '#ff8a1f', .15); burst(R * .24, R * .5, 11, '#ffd23f', .3); x.restore();
  circ(x, cx, cy, R * .17); x.fillStyle = '#fff8d0'; x.fill();
};
M.chairs = (x, cx, cy, R, a) => {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + i * PI2 / n, px = cx + Math.cos(an) * R * .62, py = cy + Math.sin(an) * R * .62;
    x.save(); x.translate(px, py); x.rotate(an + Math.PI / 2);
    x.fillStyle = i === 2 ? a : '#2b3c63'; x.strokeStyle = goldGrad(x, -20, -20, 20, 20); x.lineWidth = 3;
    rr(x, -22, -34, 44, 12, 5); x.fill(); x.stroke(); rr(x, -22, -16, 44, 32, 7); x.fill(); x.stroke();
    x.strokeStyle = '#d4a22c'; x.lineWidth = 4; x.beginPath(); x.moveTo(-16, 16); x.lineTo(-16, 30); x.moveTo(16, 16); x.lineTo(16, 30); x.stroke(); x.restore();
  }
  x.save(); x.font = `bold ${R * .6}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = a; x.shadowBlur = 18; x.fillStyle = goldGrad(x, 0, cy - R * .3, 0, cy + R * .3); x.fillText('♫', cx, cy + 4); x.restore();
};
M.rps = (x, cx, cy, R, a) => {
  const spots = [[-R * .55, R * .28], [R * .55, R * .28], [0, -R * .5]], r = R * .36;
  spots.forEach(([dx, dy], i) => {
    const px = cx + dx, py = cy + dy;
    circ(x, px, py, r); x.fillStyle = '#10141c'; x.fill(); x.strokeStyle = goldGrad(x, px - r, py - r, px + r, py + r); x.lineWidth = 4; x.stroke();
    x.save(); x.translate(px, py);
    if (i === 0) { x.fillStyle = '#9aa3b5'; x.beginPath(); [[-26, 6], [-18, -18], [4, -26], [24, -12], [26, 14], [6, 24], [-16, 22]].forEach(([a1, b1], k) => x[k ? 'lineTo' : 'moveTo'](a1, b1)); x.closePath(); x.fill(); x.strokeStyle = '#e8ecf5'; x.lineWidth = 2; x.stroke(); }
    if (i === 1) { x.fillStyle = '#f4f1e6'; rr(x, -22, -22, 44, 44, 5); x.fill(); x.fillStyle = '#c9c4b2'; x.beginPath(); x.moveTo(22, 8); x.lineTo(22, 22); x.lineTo(8, 22); x.closePath(); x.fill(); x.strokeStyle = '#8f5f10'; x.lineWidth = 2; for (let k = -1; k < 2; k++) { x.beginPath(); x.moveTo(-12, k * 10); x.lineTo(12, k * 10); x.stroke(); } }
    if (i === 2) { x.strokeStyle = '#dfe6f5'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(-20, 22); x.lineTo(14, -24); x.moveTo(20, 22); x.lineTo(-14, -24); x.stroke(); x.strokeStyle = a; x.lineWidth = 5; circ(x, -18, 22, 8); x.stroke(); circ(x, 18, 22, 8); x.stroke(); }
    x.restore();
  });
};
M.knowledge = (x, cx, cy, R, a) => {
  glow(x, cx, cy - R * .2, R, rgba('#ffe58a', .35)); const r = R * .38, by = cy - R * .22;
  circ(x, cx, by, r); x.fillStyle = metal(x, cx, by, r, '#fff8c4', '#e6a700'); x.fill(); x.strokeStyle = goldGrad(x, cx - r, by - r, cx + r, by + r); x.lineWidth = 4; x.stroke();
  x.strokeStyle = '#8f5f10'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 12, by + 20); x.quadraticCurveTo(cx, by - 18, cx + 12, by + 20); x.stroke();
  x.fillStyle = goldGrad(x, cx - 20, by + r, cx + 20, by + r + 30); rr(x, cx - 20, by + r - 4, 40, 12, 4); x.fill(); rr(x, cx - 15, by + r + 10, 30, 10, 4); x.fill();
  const bk = cy + R * .5;
  x.fillStyle = '#f4efe0'; x.strokeStyle = goldGrad(x, cx - R * .7, bk, cx + R * .7, bk); x.lineWidth = 4;
  x.beginPath(); x.moveTo(cx, bk - 14); x.quadraticCurveTo(cx - R * .35, bk - 30, cx - R * .7, bk - 14); x.lineTo(cx - R * .7, bk + 34); x.quadraticCurveTo(cx - R * .35, bk + 18, cx, bk + 34); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(cx, bk - 14); x.quadraticCurveTo(cx + R * .35, bk - 30, cx + R * .7, bk - 14); x.lineTo(cx + R * .7, bk + 34); x.quadraticCurveTo(cx + R * .35, bk + 18, cx, bk + 34); x.closePath(); x.fill(); x.stroke();
  sparkle(x, cx + R * .6, cy - R * .6, 14); sparkle(x, cx - R * .62, cy - R * .4, 10);
};
M.crown = (x, cx, cy, R, a) => {
  glow(x, cx, cy, R, rgba(a, .3)); const w = R * 1.3, h = R * .85, ox = cx - w / 2, oy = cy - h / 2;
  x.save(); x.shadowColor = a; x.shadowBlur = 22;
  x.beginPath(); x.moveTo(ox, oy + h); x.lineTo(ox - 6, oy + h * .12); x.lineTo(ox + w * .25, oy + h * .5); x.lineTo(cx, oy); x.lineTo(ox + w * .75, oy + h * .5); x.lineTo(ox + w + 6, oy + h * .12); x.lineTo(ox + w, oy + h); x.closePath();
  x.fillStyle = goldGrad(x, ox, oy, ox + w, oy + h); x.fill(); x.restore();
  rr(x, ox, oy + h - 14, w, 22, 8); x.fillStyle = goldGrad(x, ox, oy + h, ox + w, oy + h + 20); x.fill();
  [[ox + w * .2, '#e8283c'], [cx, '#2f6bff'], [ox + w * .8, '#22c06a']].forEach(([px, col]) => { circ(x, px, oy + h - 3, 9); x.fillStyle = col; x.fill(); x.strokeStyle = '#fff6c8'; x.lineWidth = 2; x.stroke(); });
  for (const px of [ox - 6, cx, ox + w + 6]) { circ(x, px, px === cx ? oy - 4 : oy + h * .1, 8); x.fillStyle = '#fff6c8'; x.fill(); }
};

/* ───────────── هوية كل لعبة: [خلفية1، خلفية2، لون مميز، شارة انجليزية، رسمة، ميزات، خيارات] ───────────── */
const GAME_THEMES = {
  'روليت': ['#061329', '#0c397c', '#38bdf8', 'LUCKY WHEEL', 'wheel', ['عجلة الحظ تختار', 'طرد كل جولة', 'آخر اثنين تحسمهم العجلة']],
  'روليت فويس': ['#06111a', '#0b5368', '#00e5ff', 'VOICE WHEEL', 'wheel', ['عجلة الحظ', 'طرد من الفويس', 'آخر لاعب يفوز'], { waves: 1 }],
  'روليت تيم': ['#18080a', '#263b72', '#ffcf40', 'TEAM WHEEL', 'wheel', ['فريقين متنافسين', 'العجلة تختار', 'فريق واحد يفوز'], { teams: 1 }],
  'روليت عكس': ['#100611', '#43105b', '#d96cff', 'REVERSE WHEEL', 'wheel', ['العجلة تنجّي لاعب', 'آخر واحد يخسر', 'جولات متتالية'], { reverse: 1 }],
  'روليت عكس فويس': ['#071018', '#173b4d', '#64e8ff', 'VOICE REVERSE', 'wheel', ['العجلة تنجّي لاعب', 'آخر واحد يخسر', 'داخل الفويس'], { reverse: 1, waves: 1 }],
  'روليت سلسلة': ['#07120e', '#18563b', '#4dffb1', 'WORD CHAIN', 'wheel', ['العجلة تختار لاعب', 'كلمة بآخر حرف', 'سلسلة كلمات'], { chain: 1 }],
  'اكس': ['#090d1f', '#173a69', '#55c7ff', 'TIC TAC TOE', 'xo', ['لوحة 3×3', 'لاعبين اثنين', 'ثلاثة بخط تفوز']],
  'وصل': ['#0b1020', '#202b67', '#ffcf40', 'CONNECT 4', 'connect', ['7 أعمدة × 6 صفوف', 'اربعة بخط واحد', 'لاعبين اثنين']],
  'لغم': ['#0b100d', '#4a1717', '#ff4d4d', 'MINEFIELD', 'mine', ['خانات مخفية', 'تجنب الألغام', 'حظ وذكاء']],
  'كنز': ['#171006', '#62420d', '#ffd45a', 'TREASURE HUNT', 'treasure', ['اول من يلقى الكنز', 'تلميحات حار وبارد', 'فخاخ تجمّد']],
  'خمن': ['#130a20', '#4a1c67', '#d995ff', 'GUESS', 'guess', ['خمّن قبل الكل', 'ذكاء وسرعة', 'لاعبين كثر']],
  'هايد': ['#071017', '#173c4a', '#71e7ff', 'HIDE & SEEK', 'hide', ['غميضة بالبيت', 'اختبئ بغرفة', 'فتّش ولاقيهم']],
  'بار': ['#170b19', '#63234f', '#ff7edb', 'JUICE BAR', 'bar', ['كاسات عصير', 'كأس واحد مسموم', 'كل لاعب كأس مختلف']],
  'سكات': ['#080c12', '#26303b', '#dce8f2', 'SILENCE', 'silence', ['مرات ممنوع تكتب', 'مرات لازم تكتب', 'ركّز او تطلع']],
  'ريبلكا': ['#100c08', '#5a3a16', '#ffb84d', 'REPLICA', 'replica', ['احفظ نمط الألوان', 'كرره بالأزرار', 'يطول كل جولة']],
  'ريبلكا حروف': ['#0a1020', '#3b176f', '#b68cff', 'ARABIC WORD DUEL', 'letters', ['تحدي أسماء وكلمات', 'حرف جديد كل جولة', 'إجابة خلال 30 ثانية'], { letters: ['ر', 'ب', 'ل'] }],
  'حبار': ['#071018', '#3a1230', '#ff4fa3', 'SQUID GAME', 'squid', ['ضوء اخضر وأحمر', 'اتحرك = تطلع', 'اوصل للنهاية']],
  'ازرار': ['#120b17', '#3d1761', '#c77dff', 'BUTTON RUSH', 'buttons', ['اضغط الزر المطلوب', 'اسرع واحد يكسب', 'ردة فعل']],
  'مافيا': ['#080808', '#401313', '#ff3b3b', 'MAFIA', 'mafia', ['ادوار سرية', 'تصويت وإقصاء', 'خدعة وذكاء']],
  'برا السالفة': ['#07100d', '#24503c', '#73ffad', 'OUTSIDER', 'outsider', ['واحد ما يعرف الموضوع', 'اكشفوه بالنقاش', 'صوّتوا عليه']],
  'اعلام': ['#07101d', '#194d6b', '#4ecbff', 'FLAGS', 'flags', ['خمّن الدولة', 'صورة العلم', 'اسرع اجابة']],
  'خمن العلم': ['#07101d', '#194d6b', '#4ecbff', 'GUESS THE FLAG', 'flags', ['خمّن الدولة', 'صورة العلم', 'اسرع اجابة']],
  'عواصم': ['#090f19', '#1c4a5c', '#80e6b2', 'CAPITALS', 'capitals', ['عواصم الدول', 'جغرافيا', 'اسرع اجابة']],
  'حساب': ['#0c0b18', '#37256b', '#a98cff', 'MATH', 'math', ['عمليات حسابية', 'جمع طرح ضرب', 'سرعة بديهة']],
  'فكك': ['#130d08', '#5b3718', '#ffbd69', 'UNSCRAMBLE', 'letters', ['فكّك الكلمة', 'حروف بينها مسافة', 'اسرع اجابة'], { letters: ['ف', 'ك', 'ك'] }],
  'ربط': ['#080e18', '#164b61', '#63e6ff', 'WORD LINK', 'letters', ['رتّب الحروف', 'كوّن الكلمة', 'اسرع اجابة'], { letters: ['ر', 'ب', 'ط'], link: 1 }],
  'اسرع': ['#160b08', '#6b2414', '#ff6b35', 'SPEED TYPE', 'speed', ['اكتب الكلمة', 'ضد الوقت', 'اسرع كاتب']],
  'عكس': ['#090d18', '#30306e', '#9f9cff', 'OPPOSITE', 'opposite', ['اكتب العكس', 'كبير ← صغير', 'اسرع اجابة']],
  'جمع': ['#07120b', '#1c5b36', '#62f09a', 'PLURAL', 'plural', ['اكتب الجمع', 'لغة عربية', 'اسرع اجابة']],
  'مفرد': ['#120b08', '#63331b', '#ff9f66', 'SINGULAR', 'singular', ['اكتب المفرد', 'لغة عربية', 'اسرع اجابة']],
  'صح-خطا': ['#08110e', '#235d45', '#68ffb0', 'TRUE / FALSE', 'truefalse', ['صح ولا خطأ', 'قرار سريع', 'ثقافة عامة']],
  'ذاكرة': ['#080b18', '#282b70', '#a7a7ff', 'MEMORY', 'memory', ['احفظ الأرقام', 'تختفي بعد ثواني', 'اكتبها من ذاكرتك']],
  'تخمين': ['#100a16', '#4c2361', '#e1a1ff', 'NUMBER GUESS', 'number', ['رقم من 1 الى 10', 'خمّنوه قبل الكل', 'حظ وحدس']],
  'كت': ['#0c0d12', '#31353f', '#f1f1f1', 'KAT', 'chat', ['اسئلة جريئة', 'تعارف وضحك', 'جاوب بصراحة']],
  'شعار': ['#090909', '#353535', '#ffd45a', 'LOGO QUIZ', 'logo', ['خمّن الشعار', 'ماركات عالمية', 'اسرع اجابة']],
  'معرفة': ['#080f1a', '#1c3f6b', '#ffe58a', 'KNOWLEDGE', 'knowledge', ['اسئلة معلومات', 'ثقافة عامة', 'اسرع اجابة']],
  'النقر السريع': ['#160b08', '#6b2414', '#ff6b35', 'QUICK CLICK', 'speed', ['ردة فعل سريعة', 'اضغط قبل الكل', 'تحدي مباشر']],
  'الكتابة السريعة': ['#160b08', '#6b2414', '#ff6b35', 'SPEED TYPE', 'speed', ['اكتب الكلمة', 'ضد الوقت', 'اسرع كاتب']],
  'فصل الكلمات': ['#130d08', '#5b3718', '#ffbd69', 'WORD SPLIT', 'letters', ['رتّب الحروف', 'اكتشف الكلمة', 'تركيز وسرعة'], { letters: ['ف', 'ص', 'ل'] }],
  'دمج الكلمات': ['#080e18', '#164b61', '#63e6ff', 'WORD MERGE', 'letters', ['ادمج الكلمات', 'اكتبها متصلة', 'تحدي لغوي'], { letters: ['د', 'م', 'ج'], link: 1 }],
  'اعكس النص': ['#090d18', '#30306e', '#9f9cff', 'REVERSE TEXT', 'opposite', ['اعكس ترتيب الحروف', 'ركّز بالتفاصيل', 'اكتب بسرعة']],
  'اعثر على الحرف': ['#080e18', '#164b61', '#63e6ff', 'FIND THE LETTER', 'letters', ['دقّق بالنص', 'احسب التكرار', 'سرعة ملاحظة'], { letters: ['ع', 'ث', 'ر'] }],
  'أكمل الحرف الناقص': ['#130d08', '#5b3718', '#ffbd69', 'MISSING LETTER', 'letters', ['اكمل الكلمة', 'تحدي مفردات', 'اسرع اجابة'], { letters: ['ك', 'م', 'ل'] }],
  'رتب الأرقام': ['#0c0b18', '#37256b', '#a98cff', 'NUMBER ORDER', 'math', ['رتّب الأرقام', 'تركيز وسرعة', 'تحدي ذهني']],
  'خمن اللون': ['#120b17', '#3d1761', '#c77dff', 'COLOR PICK', 'buttons', ['لاحظ اللون المختلف', 'اختيار سريع', 'تركيز بصري']],
  'اعثر على الإيموجي المختلف': ['#07100d', '#24503c', '#73ffad', 'ODD EMOJI', 'outsider', ['اعثر على المختلف', 'دقّة الملاحظة', 'اضغط قبل الكل']],
  'اكشف النص': ['#080b18', '#282b70', '#a7a7ff', 'REVEAL TEXT', 'memory', ['حروف تظهر تدريجياً', 'خمّن الكلمة', 'اختبر ذاكرتك']],
  'خمن الدولة': ['#07101d', '#194d6b', '#4ecbff', 'GUESS THE COUNTRY', 'flags', ['صورة حقيقية', 'جغرافيا', 'أقرب تخمين يفوز']],
  'خمن الرسمة': ['#130a20', '#4a1c67', '#d995ff', 'GUESS THE DRAWING', 'guess', ['رسمة تكشف تدريجياً', 'خمّن قبل الكل', 'ذكاء وسرعة']],
  'خمن الكلمة': ['#080e18', '#164b61', '#63e6ff', 'GUESS THE WORD', 'letters', ['تلميحات عن الكلمة', 'خمّن معناها', 'تحدي مفردات'], { letters: ['خ', 'م', 'ن'] }],
  'روسي': ['#09090d', '#4a1218', '#ff4545', 'RUSSIAN ROULETTE', 'russian', ['مسدس بطلقة واحدة', 'كل لاعب يسحب', 'حظ قاتل']],
  'بومب': ['#100806', '#57200f', '#ff7138', 'HOT BOMB', 'bomb', ['قنبلة تنتقل', 'تنفجر بأي لحظة', 'مرّرها بسرعة']],
  'انفجار': ['#120a05', '#67300d', '#ffbd45', 'BOOM', 'boom', ['عد تنازلي', 'انفجار مفاجئ', 'آخر ناجٍ يفوز']],
  'كراسي': ['#0b0f18', '#283a56', '#6db4ff', 'MUSICAL CHAIRS', 'chairs', ['الموسيقى تتوقف', 'كراسي اقل من اللاعبين', 'اجلس بسرعة']],
  'حجرة': ['#0b0e0b', '#284d30', '#8dff9f', 'ROCK PAPER SCISSORS', 'rps', ['حجرة ورقة مقص', 'لاعبين اثنين', 'اختيار سري']],
};
const DEFAULT_THEME = ['#080b18', '#242044', '#f1c40f', 'GAME NIGHT', 'crown', ['تحدي ممتع', 'نقاط للفائز', 'حظاً موفقاً']];

// الاسم يمكن أن يختلف قليلاً (مثلاً "روليت  فويس")، نطابقه بعد تنظيفه
const themeFor = title => GAME_THEMES[title] || GAME_THEMES[String(title).trim().replace(/\s+/g, ' ')] || DEFAULT_THEME;

function medallion(x, cx, cy, R, accent) {
  glow(x, cx, cy, R * 1.5, rgba(accent, .28));
  circ(x, cx, cy, R); const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(1, rgba(accent, .16)); x.fillStyle = g; x.fill();
  x.save(); x.shadowColor = rgba(accent, .8); x.shadowBlur = 20; x.strokeStyle = goldGrad(x, cx - R, cy - R, cx + R, cy + R); x.lineWidth = 6; circ(x, cx, cy, R + 8); x.stroke(); x.restore();
  x.strokeStyle = rgba(accent, .55); x.lineWidth = 2; circ(x, cx, cy, R + 24); x.stroke();
  x.strokeStyle = 'rgba(246,215,116,.5)'; x.lineWidth = 2;
  for (let i = 0; i < 72; i++) { const an = i * PI2 / 72, l = i % 6 ? 6 : 13; x.beginPath(); x.moveTo(cx + Math.cos(an) * (R + 30), cy + Math.sin(an) * (R + 30)); x.lineTo(cx + Math.cos(an) * (R + 30 + l), cy + Math.sin(an) * (R + 30 + l)); x.stroke(); }
}

function gameBanner(title, subtitle = 'استعدوا للتحدي', themeTitle = title) {
  const [c0, c1, accent, badge, type, feats = [], opts = {}] = themeFor(themeTitle);
  const custom = bg.has();
  const w = 1200, h = 500, [c, x] = base(w, h, c0, c1, accent, { dim: custom ? .12 : .6, frame: !custom });
  if (custom) {
    // الصورة الافتراضية تبين يسار الغلاف، واليمين نغمّقه تدريجياً عشان النص (والاطار ينرسم فوق الكل)
    const gr = x.createLinearGradient(w * .22, 0, w * .56, 0);
    [[0, 0], [.2, .05], [.45, .28], [.7, .7], [.88, .86], [1, .88]].forEach(([p, a]) => gr.addColorStop(p, `rgba(6,8,18,${a})`));
    x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(6,8,18,.88)'; x.fillRect(w * .56, 0, w * .44 + 1, h);
    frame(x, w, h);
  } else {
    // لوحة مائلة + شعاع ضوء خلف الرسمة
    const g = x.createLinearGradient(0, h, w * .7, 0); g.addColorStop(0, 'rgba(255,255,255,.015)'); g.addColorStop(1, rgba(accent, .13)); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = rgba(accent, .07); x.beginPath(); x.moveTo(w * .46, 0); x.lineTo(w, 0); x.lineTo(w, h); x.lineTo(w * .36, h); x.closePath(); x.fill();
    const mcx = 300, mcy = 252, R = 168;
    medallion(x, mcx, mcy, R, accent);
    (M[type] || M.crown)(x, mcx, mcy, R, accent, opts);
  }
  x.save();
  rr(x, 614, 32, 554, 436, 28);
  const glass = x.createLinearGradient(614, 32, 1168, 468);
  glass.addColorStop(0, 'rgba(255,255,255,.09)');
  glass.addColorStop(.5, 'rgba(8,19,31,.52)');
  glass.addColorStop(1, rgba(accent, .08));
  x.fillStyle = glass;
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.16)';
  x.lineWidth = 1.5;
  x.stroke();
  x.restore();
  const topGlow = x.createLinearGradient(650, 0, 1120, 0);
  topGlow.addColorStop(0, 'rgba(255,255,255,0)');
  topGlow.addColorStop(.48, rgba(accent, .8));
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = topGlow;
  x.fillRect(680, 34, 420, 2);
  // النصوص (يمين، لأن العربي يُقرأ من اليمين)
  const RX = w - 74, MW = 560;
  label(x, badge, RX, 80, 20, accent, 'right');
  x.fillStyle = goldGrad(x, RX - 130, 0, RX, 0); x.fillRect(RX - 130, 100, 130, 4);
  goldLabel(x, title, RX, 188, 88, 'right', MW);
  x.save(); const ss = fit(x, clean(subtitle), 30, MW); x.restore(); label(x, subtitle, RX, 262, Math.min(30, ss), '#e9ecfb', 'right');
  divider(x, RX - MW / 2, 304, MW);
  // شرائح الميزات
  let px = RX; const chips = feats.slice(0, 3); let fs = 22;
  const tmp = createCanvas(10, 10).getContext('2d');
  const widths = () => chips.map(t => { tmp.font = `bold ${fs}px ${FONT}`; return tmp.measureText(clean(t)).width + 42; });
  while (widths().reduce((a, b) => a + b, 0) + 12 * (chips.length - 1) > MW && fs > 15) fs--;
  const ws = widths();
  chips.forEach((t, i) => {
    const cw = ws[i]; px -= cw;
    rr(x, px, 336, cw, 46, 23); x.fillStyle = rgba(accent, .14); x.fill(); x.strokeStyle = rgba(accent, .75); x.lineWidth = 1.6; x.stroke();
    label(x, t, px + cw / 2, 360, fs, '#fff'); px -= 12;
  });
  label(x, 'EXCLUSIVE GAME ART', RX, 425, 16, 'rgba(255,255,255,.5)', 'right');
  return att(c, `game_${String(title).replace(/[^\p{L}\p{N}]+/gu, '_')}_${Date.now()}.png`);
}

function lobbyImage(title, subtitle, players, {
  min = 2,
  max = 25,
  seconds = 0,
  hostId = '',
  status = 'التسجيل مفتوح',
} = {}) {
  const [c0, c1, accent, badge, type, , opts = {}] = themeFor(title);
  const w = 1200, h = 650, [c, x] = base(w, h, c0, c1, accent, { glass: false, frame: false });
  const panelX = 438, panelY = 38, panelW = 724, panelH = 574;

  x.save();
  rr(x, panelX, panelY, panelW, panelH, 30);
  const panel = x.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  panel.addColorStop(0, 'rgba(10,22,36,.84)');
  panel.addColorStop(.52, 'rgba(9,17,31,.76)');
  panel.addColorStop(1, rgba(accent, .13));
  x.fillStyle = panel;
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.2)';
  x.lineWidth = 2;
  x.stroke();
  x.restore();

  const iconX = 218, iconY = 276, iconR = 150;
  medallion(x, iconX, iconY, iconR, accent);
  (M[type] || M.crown)(x, iconX, iconY, iconR, accent, opts);
  label(x, badge, iconX, 486, 22, accent);
  label(x, 'dev.splosh', iconX, 522, 16, 'rgba(255,255,255,.62)');

  rr(x, panelX + 34, panelY + 28, 184, 36, 18);
  x.fillStyle = rgba(accent, .16);
  x.fill();
  x.strokeStyle = rgba(accent, .65);
  x.lineWidth = 1.4;
  x.stroke();
  circ(x, panelX + 54, panelY + 46, 5);
  x.fillStyle = '#53e09a';
  x.fill();
  label(x, status, panelX + 138, panelY + 47, 17, '#e8fff5');

  label(x, title, panelX + panelW - 34, panelY + 91, 54, accent, 'right');
  const temp = createCanvas(10, 10).getContext('2d');
  temp.font = `bold 21px ${FONT}`;
  const descriptionLines = wrap(temp, clean(subtitle) || 'استعدوا للتحدي', panelW - 74).slice(0, 2);
  descriptionLines.forEach((line, i) => label(x, line, panelX + panelW - 36, panelY + 133 + i * 28, 21, '#d4e1ef', 'right'));

  const countY = panelY + 192, countX = panelX + 34, countW = 190;
  rr(x, countX, countY, countW, 54, 16);
  x.fillStyle = 'rgba(255,255,255,.065)';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.13)';
  x.lineWidth = 1;
  x.stroke();
  label(x, `${players.length} / ${max}`, countX + countW / 2, countY + 19, 23, accent);
  label(x, 'عدد اللاعبين', countX + countW / 2, countY + 42, 14, '#a8bacb');

  const minX = countX + countW + 12;
  rr(x, minX, countY, 196, 54, 16);
  x.fillStyle = 'rgba(255,255,255,.065)';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.13)';
  x.stroke();
  label(x, String(min), minX + 98, countY + 19, 23, '#ffd479');
  label(x, 'الحد الأدنى للبدء', minX + 98, countY + 42, 14, '#a8bacb');

  const timeX = minX + 208, timeW = panelX + panelW - 34 - timeX;
  rr(x, timeX, countY, timeW, 54, 16);
  x.fillStyle = 'rgba(255,255,255,.065)';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.13)';
  x.stroke();
  label(x, `${Math.max(0, seconds)} ث`, timeX + timeW / 2, countY + 19, 23, '#c6b3ff');
  label(x, 'متبقي للتسجيل', timeX + timeW / 2, countY + 42, 14, '#a8bacb');

  const barX = panelX + 34, barY = panelY + 263, barW = panelW - 68;
  rr(x, barX, barY, barW, 11, 6);
  x.fillStyle = 'rgba(255,255,255,.1)';
  x.fill();
  const progress = Math.min(1, players.length / Math.max(1, max));
  if (progress > 0) {
    rr(x, barX, barY, Math.max(12, barW * progress), 11, 6);
    const fill = x.createLinearGradient(barX, 0, barX + barW * progress, 0);
    fill.addColorStop(0, accent);
    fill.addColorStop(1, '#e8fffb');
    x.fillStyle = fill;
    x.fill();
  }

  label(x, `قائمة اللاعبين  •  ${players.length}`, panelX + panelW - 36, panelY + 299, 19, '#e7f0fa', 'right');
  const slots = Math.min(max, Math.max(min, players.length));
  const columns = 5, cellW = 124, cellH = 34, gapX = 8, gapY = 7;
  const listX = panelX + 34, listY = panelY + 326;
  for (let i = 0; i < slots; i++) {
    const col = i % columns, rowIndex = Math.floor(i / columns);
    const px = listX + col * (cellW + gapX), py = listY + rowIndex * (cellH + gapY);
    const player = players[i];
    rr(x, px, py, cellW, cellH, 12);
    x.fillStyle = player ? (player.id === hostId ? rgba(accent, .22) : 'rgba(255,255,255,.075)') : 'rgba(255,255,255,.025)';
    x.fill();
    x.strokeStyle = player ? rgba(accent, player.id === hostId ? .78 : .34) : 'rgba(255,255,255,.12)';
    x.lineWidth = 1;
    x.stroke();
    if (player) {
      circ(x, px + 17, py + cellH / 2, 10);
      x.fillStyle = player.id === hostId ? accent : 'rgba(255,255,255,.2)';
      x.fill();
      label(x, player.id === hostId ? '★' : String(i + 1), px + 17, py + cellH / 2, 11, '#07121d');
      label(x, nm(player), px + cellW - 9, py + cellH / 2, 14, '#f3f7ff', 'right');
    } else {
      label(x, 'مكان شاغر', px + cellW / 2, py + cellH / 2, 13, 'rgba(214,226,239,.48)');
    }
  }

  if (players.length < min) {
    label(x, `باقي ${min - players.length} لاعب للبدء`, panelX + 178, panelY + panelH - 23, 15, '#ffd479');
  } else {
    label(x, 'اكتمل العدد • ابدأ الآن', panelX + 178, panelY + panelH - 23, 15, '#92f1c5');
  }
  return att(c, `lobby_${String(title).replace(/[^\p{L}\p{N}]+/gu, '_')}_${Date.now()}.png`);
}

/* ───────────── صور داخل اللعب ───────────── */
// ---- العجلة: مقسمة لطبقات (خلفية ثابتة / الجزء الدوار / الطبقة العلوية الثابتة) عشان نقدر نسوي منها GIF
const W = { S: 700, cx: 350, cy: 340, r: 240 };

function wheelBack() {
  const { S, cx, cy, r } = W, c = createCanvas(S, S), x = c.getContext('2d');
  x.save();
  x.shadowColor = 'rgba(0,0,0,.7)';
  x.shadowBlur = 28;
  circ(x, cx, cy, r + 25);
  x.fillStyle = '#111318';
  x.fill();
  x.restore();
  circ(x, cx, cy, r + 17);
  x.fillStyle = '#f4f5f7';
  x.fill();
  circ(x, cx, cy, r + 9);
  x.fillStyle = '#25272d';
  x.fill();
  for (let i = 0; i < 36; i++) {
    const a = i * PI2 / 36, tickR = r + 13;
    circ(x, cx + Math.cos(a) * tickR, cy + Math.sin(a) * tickR, i % 3 === 0 ? 3 : 2);
    x.fillStyle = i % 2 ? '#aeb3bc' : '#fff';
    x.fill();
  }
  return [c, x];
}

function wheelRotor(x, names, rot, sel = -1) {
  const { cx, cy, r } = W, n = names.length, step = PI2 / n;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * step, a1 = a0 + step;
    x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0, a1); x.closePath();
    const lightSector = i % 2 === 0;
    const sector = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    if (lightSector) {
      sector.addColorStop(0, '#ffffff');
      sector.addColorStop(1, '#d9dde3');
    } else {
      sector.addColorStop(0, '#292c32');
      sector.addColorStop(1, '#08090c');
    }
    x.fillStyle = sector;
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = '#737780';
    x.stroke();
  }
  if (sel >= 0) {
    const a0 = rot + sel * step, a1 = a0 + step;
    x.save(); x.shadowColor = '#7be7d8'; x.shadowBlur = 20; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0, a1); x.closePath(); x.lineWidth = 5; x.strokeStyle = '#7be7d8'; x.stroke(); x.restore();
  }
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * step, a1 = a0 + step;
    const mid = (a0 + a1) / 2, flip = Math.cos(mid) < 0;
    x.save(); x.translate(cx, cy); x.rotate(mid + (flip ? Math.PI : 0));
    label(x, nm(names[i]).slice(0, 12), flip ? -(r - 18) : r - 18, 0, Math.max(14, Math.min(28, 400 / n)), i % 2 === 0 ? '#17191d' : '#fff', flip ? 'left' : 'right'); x.restore();
  }
}

function wheelTop(x) {
  const { cx, cy, r } = W;
  const sh = x.createRadialGradient(cx, cy, r * .2, cx, cy, r); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.2)'); circ(x, cx, cy, r); x.fillStyle = sh; x.fill();
  circ(x, cx, cy, r + 2); x.strokeStyle = '#f7f8fa'; x.lineWidth = 3; x.stroke();
  circ(x, cx, cy, 44); x.fillStyle = '#f4f5f7'; x.fill();
  circ(x, cx, cy, 34); x.fillStyle = '#17191e'; x.fill();
  circ(x, cx, cy, 21); x.fillStyle = '#343840'; x.fill();
  circ(x, cx, cy, 9); x.fillStyle = '#f4f5f7'; x.fill();
  x.save(); x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 10;
  x.beginPath(); x.moveTo(cx - 27, cy - r - 45); x.lineTo(cx + 27, cy - r - 45); x.lineTo(cx, cy - r + 7); x.closePath(); x.fillStyle = '#f5f6f8'; x.fill();
  x.strokeStyle = '#17191e'; x.lineWidth = 4; x.stroke(); x.restore();
}

// الزاوية اللي تخلي قطعة sel تقف تحت المؤشر (فوق)
const wheelStop = (n, sel) => -Math.PI / 2 - (sel + 0.5) * (PI2 / n);

function wheelImage(names, sel = -1) {
  const [c, x] = wheelBack();
  wheelRotor(x, names, sel >= 0 ? wheelStop(names.length, sel) : Math.random() * PI2, sel);
  wheelTop(x);
  return att(c);
}

// روليت GIF: العجلة تدور وتبطّأ لين توقف على اللاعب المختار (sel). ترجع { file, ms } (ms = مدة الحركة)
// الترميز يتم على دفعات (setImmediate) عشان ما يعلّق البوت
async function wheelSpinGif(names, sel) {
  const n = names.length, G = 420, N = 50, DELAY = 6, HOLD = 120; // 50 فريم × 60ms = 3 ثواني + وقفة ثانية ونص
  const [back] = wheelBack(); mark(back);
  const top = createCanvas(W.S, W.S); wheelTop(top.getContext('2d'));
  const work = createCanvas(W.S, W.S), wx = work.getContext('2d');
  const out = createCanvas(G, G), ox = out.getContext('2d');
  const final = wheelStop(n, sel), start = Math.random() * PI2;
  const total = (((final - start) % PI2) + PI2) % PI2 + PI2 * 3; // 3 لفات + الفرق للوقوف
  const frames = [];
  for (let f = 0; f <= N; f++) {
    const t = f / N, e = 1 - (1 - t) * (1 - t); // تباطؤ تدريجي
    wx.drawImage(back, 0, 0);
    wheelRotor(wx, names, start + total * e, f === N ? sel : -1);
    wx.drawImage(top, 0, 0);
    ox.drawImage(work, 0, 0, G, G);
    frames.push(ox.getImageData(0, 0, G, G).data);
    if (f % 5 === 4) await new Promise(r => setImmediate(r));
  }
  const g = new GifWriter(G, G, { transparent: true });
  g.setPalette(g.buildPalette([frames[0], frames[Math.floor(N / 3)], frames[Math.floor(N * 2 / 3)], frames[N]]));
  for (let f = 0; f <= N; f++) {
    g.addFrame(frames[f], f === N ? HOLD : DELAY);
    if (f % 5 === 4) await new Promise(r => setImmediate(r));
  }
  return { file: new AttachmentBuilder(g.finish(), { name: `wheel_${Date.now()}_${counter++}.gif` }), ms: N * DELAY * 10 };
}

function playersImage(title, alive, dead = [], { glass = true } = {}) {
  const all = [...alive.map(u => [u, false]), ...dead.map(u => [u, true])];
  const rows = Math.max(1, Math.ceil(all.length / 2)), w = 800, h = 175 + rows * 58;
  const [c, x] = base(w, h, '#091522', '#102b3a', '#39cdbb', { glass });
  goldLabel(x, title, w / 2, 52, 34, 'center', w - 120); divider(x, w / 2, 88, 260);
  all.forEach(([u, d], i) => {
    const px = 40 + (i % 2) * 370, py = 116 + Math.floor(i / 2) * 58;
    rr(x, px, py, 350, 48, 14); x.fillStyle = d ? 'rgba(231,76,60,.13)' : 'rgba(255,255,255,.07)'; x.fill();
    x.strokeStyle = d ? 'rgba(231,76,60,.55)' : 'rgba(246,215,116,.4)'; x.lineWidth = 1.5; x.stroke();
    circ(x, px + 26, py + 24, 16); x.fillStyle = d ? '#5a2a2a' : goldGrad(x, px + 10, py + 8, px + 42, py + 40); x.fill();
    label(x, String(i + 1), px + 26, py + 25, 18, d ? '#caa' : '#2a1a05');
    label(x, nm(u), px + 54, py + 25, 25, d ? '#95a5a6' : '#fff', 'left');
    if (d) { x.strokeStyle = '#e74c3c'; x.lineWidth = 3; x.beginPath(); x.moveTo(px + 50, py + 24); x.lineTo(px + 334, py + 24); x.stroke(); }
    else { x.save(); x.shadowColor = '#2ecc71'; x.shadowBlur = 10; circ(x, px + 330, py + 24, 6); x.fillStyle = '#2ecc71'; x.fill(); x.restore(); }
  });
  return att(c);
}

function columnsImage(title, cols) {
  const rows = Math.max(...cols.map(k => k.items.length)), w = 800, h = 210 + rows * 50;
  const [c, x] = base(w, h, '#091522', '#102b3a', '#39cdbb', { glass: false });
  goldLabel(x, title, w / 2, 50, 34, 'center', w - 120); divider(x, w / 2, 86, 260);
  cols.forEach((k, ci) => {
    const px = 30 + ci * 385;
    rr(x, px, 108, 355, 46, 14); const g = x.createLinearGradient(px, 0, px + 355, 0); g.addColorStop(0, k.color); g.addColorStop(1, rgba(k.color, .55)); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5; x.stroke();
    label(x, k.title, px + 177, 131, 28);
    k.items.forEach((t, i) => {
      rr(x, px, 164 + i * 50, 355, 42, 12); x.fillStyle = 'rgba(255,255,255,.08)'; x.fill(); x.strokeStyle = 'rgba(246,215,116,.3)'; x.lineWidth = 1; x.stroke();
      label(x, nm(t), px + 16, 186 + i * 50, 24, '#fff', 'left');
    });
  });
  return att(c);
}

function trackImage(title, rows, goal) {
  const w = 800, h = 155 + rows.length * 56, [c, x] = base(w, h, '#0b1a12', '#173a26');
  goldLabel(x, title, w / 2, 48, 32, 'center', w - 120);
  rows.forEach((r, i) => {
    const y = 84 + i * 56, frac = Math.min(1, r.steps / goal), col = r.dead ? '#e74c3c' : '#2ecc71';
    label(x, nm(r.name), 38, y + 20, 24, r.dead ? '#e74c3c' : '#fff', 'left');
    rr(x, 200, y + 2, 550, 36, 18); x.fillStyle = 'rgba(0,0,0,.45)'; x.fill(); x.strokeStyle = 'rgba(246,215,116,.35)'; x.lineWidth = 1.5; x.stroke();
    const fw = Math.max(36, 550 * frac); rr(x, 200, y + 2, fw, 36, 18);
    const g = x.createLinearGradient(200, 0, 200 + fw, 0); g.addColorStop(0, rgba(col, .45)); g.addColorStop(1, col); x.fillStyle = g; x.fill();
    x.save(); x.shadowColor = col; x.shadowBlur = 14; circ(x, 200 + fw - 18, y + 20, 13); x.fillStyle = r.dead ? '#fff' : goldGrad(x, 200 + fw - 30, y, 200 + fw, y + 40); x.fill(); x.restore();
  });
  for (let k = 0; k < Math.ceil((rows.length * 56 + 10) / 10); k++) for (let j = 0; j < 2; j++) { x.fillStyle = (k + j) % 2 ? '#fff' : '#111'; x.fillRect(752 + j * 10, 78 + k * 10, 10, 10); }
  return att(c);
}

function xoImage(b, line) {
  const S = 540, [c, x] = base(S, S, '#0b1330', '#173a69', '#55c7ff'), cell = S / 3;
  x.save(); x.lineCap = 'round'; x.shadowColor = '#f7d774'; x.shadowBlur = 14; x.strokeStyle = goldGrad(x, 0, 0, S, S); x.lineWidth = 7;
  for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * cell, 40); x.lineTo(i * cell, S - 40); x.stroke(); x.beginPath(); x.moveTo(40, i * cell); x.lineTo(S - 40, i * cell); x.stroke(); }
  x.restore();
  b.forEach((v, k) => {
    const cx = (k % 3) * cell + cell / 2, cy = Math.floor(k / 3) * cell + cell / 2;
    x.save(); x.lineWidth = 15; x.lineCap = 'round'; x.shadowBlur = 20;
    if (v === 'X') { x.strokeStyle = x.shadowColor = '#ff4d6d'; x.beginPath(); x.moveTo(cx - 45, cy - 45); x.lineTo(cx + 45, cy + 45); x.moveTo(cx + 45, cy - 45); x.lineTo(cx - 45, cy + 45); x.stroke(); }
    else if (v === 'O') { x.strokeStyle = x.shadowColor = '#4db8ff'; circ(x, cx, cy, 48); x.stroke(); }
    x.restore();
  });
  if (line) {
    const p = k => [(k % 3) * cell + cell / 2, Math.floor(k / 3) * cell + cell / 2], [a, z] = [p(line[0]), p(line[2])];
    x.save(); x.strokeStyle = '#fff6c8'; x.shadowColor = '#f1c40f'; x.shadowBlur = 26; x.lineWidth = 11; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(z[0], z[1]); x.stroke(); x.restore();
  }
  return att(c);
}

function c4Image(b) {
  const cell = 90, w = 7 * cell + 40, h = 6 * cell + 40 + 56, [c, x] = base(w, h, '#0a1230', '#1c3170', '#ffcf40');
  for (let col = 0; col < 7; col++) label(x, String(col + 1), 20 + col * cell + cell / 2, 38, 26, '#f7d774');
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 20; rr(x, 20, 62, 7 * cell, 6 * cell, 22);
  const g = x.createLinearGradient(0, 62, 0, 62 + 6 * cell); g.addColorStop(0, '#2c4fc9'); g.addColorStop(1, '#10247a'); x.fillStyle = g; x.fill(); x.restore();
  x.strokeStyle = goldGrad(x, 20, 50, w, h); x.lineWidth = 3; rr(x, 20, 62, 7 * cell, 6 * cell, 22); x.stroke();
  for (let r = 0; r < 6; r++) for (let col = 0; col < 7; col++) {
    const v = b[r][col], px = 20 + col * cell + cell / 2, py = 62 + r * cell + cell / 2;
    circ(x, px, py, 39); x.fillStyle = '#050a22'; x.fill();
    if (v) {
      x.save(); x.shadowColor = v === 1 ? '#ff4d4d' : '#ffd23f'; x.shadowBlur = 14; circ(x, px, py, 35);
      x.fillStyle = v === 1 ? metal(x, px, py, 35, '#ff9a9a', '#b3202a') : metal(x, px, py, 35, '#fff3a0', '#d9a300'); x.fill(); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2; circ(x, px, py, 25); x.stroke();
    }
  }
  return att(c);
}

function houseImage(rooms) {
  const w = 800, h = 155 + Math.ceil(rooms.length / 4) * 150, [c, x] = base(w, h, '#1a130c', '#4a3624', '#ffb84d');
  goldLabel(x, '🏠 البيت', w / 2, 52, 34, 'center', w - 120); divider(x, w / 2, 88, 260);
  rooms.forEach((r, i) => {
    const px = 20 + (i % 4) * 195, py = 110 + Math.floor(i / 4) * 150;
    const [a, b] = r.state === 'found' ? ['#e04b3a', '#7a1710'] : r.state === 'searched' ? ['#8b97a0', '#3c464e'] : ['#3d5a80', '#1a2a44'];
    x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14; rr(x, px, py, 180, 130, 16);
    const g = x.createLinearGradient(px, py, px, py + 130); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fill(); x.restore();
    x.strokeStyle = r.state === 'found' ? '#ffd23f' : goldGrad(x, px, py, px + 180, py + 130); x.lineWidth = r.state === 'found' ? 4 : 2.5; rr(x, px, py, 180, 130, 16); x.stroke();
    circ(x, px + 160, py + 22, 6); x.fillStyle = goldGrad(x, px + 150, py + 12, px + 170, py + 32); x.fill();
    label(x, r.name, px + 90, py + 40, 28);
    if (r.note) label(x, r.note, px + 90, py + 90, 22);
  });
  return att(c);
}

// cells: 'hidden' | 'safe' | 'bomb' | 'treasure' | 'empty'
function gridImage(rows, cols, cells, title = '') {
  const cell = 100, w = cols * cell + 40, h = rows * cell + 130, [c, x] = base(w, h, '#0b1a12', '#1a3d28', '#4dffb1');
  if (title) goldLabel(x, title, w / 2, 38, 30, 'center', w - 100);
  cells.forEach((t, i) => {
    const px = 20 + (i % cols) * cell, py = 70 + Math.floor(i / cols) * cell, cx = px + cell / 2, cy = py + cell / 2;
    rr(x, px + 5, py + 5, cell - 10, cell - 10, 16);
    const g = x.createLinearGradient(px, py, px, py + cell);
    if (t === 'hidden') { g.addColorStop(0, '#4a6b54'); g.addColorStop(1, '#1f3526'); } else { g.addColorStop(0, '#f2f6f3'); g.addColorStop(1, '#c6d5ca'); }
    x.fillStyle = g; x.fill(); x.strokeStyle = t === 'hidden' ? 'rgba(246,215,116,.45)' : 'rgba(0,0,0,.2)'; x.lineWidth = 2; x.stroke();
    if (t === 'hidden') { x.fillStyle = 'rgba(255,255,255,.08)'; rr(x, px + 9, py + 9, cell - 18, (cell - 18) / 2.4, 10); x.fill(); x.fillStyle = 'rgba(246,215,116,.4)'; diamond(x, cx, cy + 6, 12); x.fill(); }
    if (t === 'safe') { x.save(); x.shadowColor = '#2ecc71'; x.shadowBlur = 16; diamond(x, cx, cy, 30); x.fillStyle = metal(x, cx, cy, 30, '#9affc2', '#1c9c58'); x.fill(); x.restore(); }
    if (t === 'bomb') {
      x.strokeStyle = '#e74c3c'; x.lineWidth = 5; x.lineCap = 'round';
      for (let a = 0; a < 8; a++) { x.beginPath(); x.moveTo(cx + Math.cos(a * Math.PI / 4) * 24, cy + Math.sin(a * Math.PI / 4) * 24); x.lineTo(cx + Math.cos(a * Math.PI / 4) * 40, cy + Math.sin(a * Math.PI / 4) * 40); x.stroke(); }
      circ(x, cx, cy, 26); x.fillStyle = metal(x, cx, cy, 26, '#666', '#080808'); x.fill();
    }
    if (t === 'treasure') { x.save(); x.shadowColor = '#ffd23f'; x.shadowBlur = 22; star(x, cx, cy, 40); x.fillStyle = goldGrad(x, cx - 40, cy - 40, cx + 40, cy + 40); x.fill(); x.restore(); }
    if (t === 'empty') { x.fillStyle = '#95a5a6'; circ(x, cx, cy, 10); x.fill(); }
  });
  return att(c);
}

function cupsImage(n, { bad = -1, picks = new Map() } = {}) {
  const w = Math.max(800, n * 110 + 40), h = 350, [c, x] = base(w, h, '#220e2e', '#4a1f5a', '#ff7edb');
  goldLabel(x, 'بار العصيرات', w / 2, 48, 32, 'center', w - 120); divider(x, w / 2, 82, 240);
  rr(x, 24, 236, w - 48, 14, 7); x.fillStyle = goldGrad(x, 0, 236, w, 250); x.fill();
  for (let i = 0; i < n; i++) {
    const px = 30 + i * 110, col = i === bad ? '#ff3b3b' : picks.has(i) ? '#2ecc71' : '#38c6ff';
    x.beginPath(); x.moveTo(px, 105); x.lineTo(px + 90, 105); x.lineTo(px + 72, 234); x.lineTo(px + 18, 234); x.closePath();
    const g = x.createLinearGradient(0, 105, 0, 234); g.addColorStop(0, col + 'cc'); g.addColorStop(1, col); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(px + 12, 114, 6, 90);
    x.strokeStyle = '#ffe9a8'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(px + 62, 82); x.lineTo(px + 52, 160); x.stroke();
    circ(x, px + 45, 170, 20); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill(); label(x, String(i + 1), px + 45, 171, 28);
    if (picks.has(i)) label(x, nm(picks.get(i)).slice(0, 8), px + 45, 282, 20, '#fff6c8');
  }
  return att(c);
}

function patternImage(seq) {
  const w = Math.max(seq.length * 140 + 20, 400), [c, x] = base(w, 225, '#13132a', '#2c2c54');
  seq.forEach((s, i) => {
    const px = 20 + i * 140; x.save(); x.shadowColor = s.hex; x.shadowBlur = 20; rr(x, px, 35, 120, 120, 22);
    const g = x.createLinearGradient(px, 35, px, 155); g.addColorStop(0, '#ffffff66'); g.addColorStop(.35, s.hex); g.addColorStop(1, s.hex); x.fillStyle = s.hex; x.fill();
    x.fillStyle = g; x.fill(); x.restore();
    x.strokeStyle = goldGrad(x, px, 35, px + 120, 155); x.lineWidth = 3; rr(x, px, 35, 120, 120, 22); x.stroke();
  });
  return att(c);
}

function logoImage(img) {
  const [c, x] = base(500, 400, '#0a0f24', '#211a46');
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 24; rr(x, 70, 60, 360, 280, 28); x.fillStyle = '#f7f7f2'; x.fill(); x.restore();
  x.strokeStyle = goldGrad(x, 70, 60, 430, 340); x.lineWidth = 5; rr(x, 70, 60, 360, 280, 28); x.stroke();
  const k = Math.min(230 / img.width, 230 / img.height);
  x.drawImage(img, 250 - (img.width * k) / 2, 200 - (img.height * k) / 2, img.width * k, img.height * k);
  return att(c);
}

module.exports = { att, card, classicCard, questionCard, gameBanner, lobbyImage, wheelImage, wheelSpinGif, playersImage, columnsImage, trackImage, xoImage, c4Image, houseImage, gridImage, cupsImage, patternImage, logoImage };
