const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { drawBrandFrame } = require('./brand');

// الخط: fonts/font.ttf (عادي) و fonts/font-bold.ttf (عريض، اختياري). تقدر تبدلهم بـ Cairo او Tajawal
const fontPath = path.join(__dirname, '../fonts/font.ttf');
const boldPath = path.join(__dirname, '../fonts/font-bold.ttf');
if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, 'BotFont');
  if (fs.existsSync(boldPath)) GlobalFonts.registerFromPath(boldPath, 'BotFont');
} else console.warn('⚠️ ما لقيت fonts/font.ttf — العربي بالصور ما بيطلع صح');
const FONT = 'BotFont, sans-serif';

// خط الصور (DejaVu/Cairo..) ما فيه ايموجي، فيطلع مربعات. نشيل الايموجي من نص الصور (يبقى بنص الرسالة)
// اذا نصبت خط ايموجي على السيرفر (fonts-noto-color-emoji) حط IMG_EMOJI=1 بملف .env
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3]+ ?/gu; // مع المسافة اللي بعدها عشان ما تصير مسافتين
const clean = s => (process.env.IMG_EMOJI === '1' ? String(s) : String(s).replace(EMOJI_RE, '')).trim();

function watermark(x, w, h, placement = 'bottom-right') {
  drawBrandFrame(x, w, h);
}

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const norm = s => String(s).toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/\s+/g, ' ').trim();
const same = (a, b) => { const f = s => norm(s).replace(/^ال/, ''); return f(a) === f(b); };

function winRank(users, userId) {
  const winsFor = entry => Object.values(entry && typeof entry === 'object' ? entry.wins || {} : {}).reduce(
    (total, wins) => total + (Number.isFinite(Number(wins)) ? Math.max(0, Number(wins)) : 0),
    0,
  );
  const ranked = Object.entries(users)
    .map(([id, entry]) => ({ id, wins: winsFor(entry) }))
    .filter(entry => entry.wins > 0)
    .sort((left, right) => right.wins - left.wins || left.id.localeCompare(right.id));
  const position = ranked.findIndex(entry => entry.id === userId);
  return position < 0 ? 100 : Math.min(position + 1, 100);
}

function textImage(text, { w = 700, h = 200, size = 70, bg = ['#091522', '#12313d'] } = {}) {
  text = clean(text);
  const c = createCanvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { // خطوط تشويش عشان ما احد ينسخ بالـ OCR
    x.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`;
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath(); x.moveTo(Math.random() * w, Math.random() * h); x.lineTo(Math.random() * w, Math.random() * h); x.stroke();
  }
  let s = size;
  x.font = `bold ${s}px ${FONT}`;
  while (x.measureText(text).width > w - 60 && s > 20) { s -= 4; x.font = `bold ${s}px ${FONT}`; }
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2);
  watermark(x, w, h);
  return new AttachmentBuilder(c.toBuffer('image/png'), { name: 'q.png' });
}

async function profileCard(user, u, rank) {
  const width = 1080, height = 420;
  const c = createCanvas(width, height), x = c.getContext('2d');
  const background = x.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#07121f');
  background.addColorStop(.48, '#123844');
  background.addColorStop(1, '#171a32');
  x.fillStyle = background;
  x.fillRect(0, 0, width, height);
  const glow = x.createRadialGradient(870, 90, 12, 870, 90, 440);
  glow.addColorStop(0, 'rgba(123,231,216,.24)');
  glow.addColorStop(1, 'rgba(123,231,216,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, width, height);
  x.save();
  x.beginPath();
  x.roundRect(24, 24, width - 48, height - 48, 32);
  x.clip();
  x.fillStyle = 'rgba(4,12,22,.56)';
  x.fillRect(24, 24, width - 48, height - 48);
  const accent = x.createLinearGradient(42, 0, width - 42, 0);
  accent.addColorStop(0, 'rgba(123,231,216,0)');
  accent.addColorStop(.52, 'rgba(123,231,216,.8)');
  accent.addColorStop(1, 'rgba(123,231,216,0)');
  x.fillStyle = accent;
  x.fillRect(54, 54, width - 108, 2);
  x.restore();

  const avatarX = 870, avatarY = 205, avatarRadius = 98;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  let avatarLoaded = false;
  try {
    const res = await fetch(avatarUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const av = await loadImage(Buffer.from(await res.arrayBuffer()));
    x.save();
    x.beginPath();
    x.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    x.clip();
    x.drawImage(av, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    x.restore();
    avatarLoaded = true;
  } catch (error) {
    console.warn(`تعذّر تحميل صورة بروفايل ${user.id}:`, error.message);
  }
  if (!avatarLoaded) {
    const avatarFill = x.createLinearGradient(avatarX - avatarRadius, avatarY - avatarRadius, avatarX + avatarRadius, avatarY + avatarRadius);
    avatarFill.addColorStop(0, '#7be7d8');
    avatarFill.addColorStop(1, '#247a83');
    x.beginPath();
    x.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    x.fillStyle = avatarFill;
    x.fill();
    x.fillStyle = '#08202a';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `bold 82px ${FONT}`;
    x.fillText(clean(user.username?.[0] || 'S'), avatarX, avatarY + 3);
  }
  x.save();
  x.beginPath();
  x.arc(avatarX, avatarY, avatarRadius + 10, 0, Math.PI * 2);
  x.strokeStyle = 'rgba(123,231,216,.24)';
  x.lineWidth = 2;
  x.stroke();
  x.beginPath();
  x.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
  x.strokeStyle = '#7be7d8';
  x.lineWidth = 4;
  x.stroke();
  x.restore();

  x.textAlign = 'right';
  x.textBaseline = 'middle';
  x.fillStyle = '#7be7d8';
  x.font = `bold 23px ${FONT}`;
  x.fillText('DEV.SPLOSH  •  PLAYER PROFILE', 730, 90);

  const displayName = clean(user.globalName || user.displayName || user.username) || 'لاعب';
  let nameSize = 48;
  x.font = `bold ${nameSize}px ${FONT}`;
  while (x.measureText(displayName).width > 660 && nameSize > 28) {
    nameSize -= 2;
    x.font = `bold ${nameSize}px ${FONT}`;
  }
  x.fillStyle = '#f5fffd';
  x.fillText(displayName, 730, 145);
  x.fillStyle = '#a9c1ca';
  x.font = `24px ${FONT}`;
  x.fillText(`@${clean(user.username)}`, 730, 185);

  const totalWins = Object.values(u.wins || {}).reduce(
    (sum, wins) => sum + (Number.isFinite(Number(wins)) ? Math.max(0, Number(wins)) : 0),
    0,
  );
  const stats = [
    { x: 72, label: 'رصيد النقاط', value: Number(u.points).toLocaleString('en-US'), accent: '#7be7d8' },
    { x: 292, label: 'مرات الفوز', value: totalWins.toLocaleString('en-US'), accent: '#ffd166' },
    { x: 512, label: 'ترتيب الفوز', value: `#${rank || 100}`, accent: '#b9a2ff' },
  ];
  for (const stat of stats) {
    x.save();
    x.beginPath();
    x.roundRect(stat.x, 234, 202, 94, 20);
    x.fillStyle = 'rgba(255,255,255,.055)';
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.12)';
    x.lineWidth = 1;
    x.stroke();
    x.textAlign = 'right';
    x.textBaseline = 'middle';
    x.fillStyle = '#a9c1ca';
    x.font = `bold 18px ${FONT}`;
    x.fillText(stat.label, stat.x + 180, 260);
    x.fillStyle = stat.accent;
    let valueSize = stat.value.length > 13 ? 22 : 32;
    x.font = `bold ${valueSize}px ${FONT}`;
    while (x.measureText(stat.value).width > 170 && valueSize > 16) {
      valueSize -= 2;
      x.font = `bold ${valueSize}px ${FONT}`;
    }
    x.fillText(stat.value, stat.x + 180, 300);
    x.restore();
  }
  watermark(x, width, height, 'bottom-left');
  return new AttachmentBuilder(c.toBuffer('image/png'), { name: 'profile.png' });
}

async function serverCard(guild, gamesCount) {
  const c = createCanvas(900, 320), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 900, 320);
  g.addColorStop(0, '#091522'); g.addColorStop(1, '#13434b');
  x.fillStyle = g; x.fillRect(0, 0, 900, 320);
  x.fillStyle = 'rgba(8,20,34,.4)';
  x.beginPath(); x.roundRect(24, 24, 852, 272, 28); x.fill();
  try {
    const url = guild.iconURL({ extension: 'png', size: 256 });
    if (url) {
      const res = await fetch(url), icon = await loadImage(Buffer.from(await res.arrayBuffer()));
      x.save(); x.beginPath(); x.arc(160, 160, 105, 0, Math.PI * 2); x.clip();
      x.drawImage(icon, 55, 55, 210, 210); x.restore();
      x.strokeStyle = '#7be7d8'; x.lineWidth = 8; x.beginPath(); x.arc(160, 160, 105, 0, Math.PI * 2); x.stroke();
    }
  } catch {}
  x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.font = `bold 48px ${FONT}`; x.fillText(clean(guild.name.slice(0, 24)) || 'سيرفر', 330, 125);
  x.font = `30px ${FONT}`; x.fillStyle = '#d8d9ff';
  x.fillText(`الأعضاء: ${guild.memberCount ?? '—'}`, 330, 185);
  if (gamesCount) x.fillText(`الألعاب: ${gamesCount} لعبة`, 330, 235);
  watermark(x, 900, 320, 'top-right');
  return new AttachmentBuilder(c.toBuffer('image/png'), { name: 'server.png' });
}

module.exports = { rand, pick, sleep, norm, same, textImage, profileCard, serverCard, winRank, FONT, clean };
