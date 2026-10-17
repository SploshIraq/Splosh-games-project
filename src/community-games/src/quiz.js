const fs = require('fs');
const path = require('path');
const { loadImage } = require('@napi-rs/canvas');
const { start, end } = require('./state');
const db = require('./db');
const D = require('./data');
const { rand, pick, sleep, same, norm } = require('./util');
const { questionCard } = require('./img');
const H = require('./hints');

const split = s => s.split('|');
const shuffle = a => [...a].sort(() => Math.random() - 0.5);

/*
  شكل السؤال (gen): { text, big?, imageUrl?, image?, panel?, noise?, answers }
  text = نص السؤال، big = نص كبير بالنص (مثل العملية الحسابية)، imageUrl/image = صورة تنعرض تحت النص
  كل سؤال ينرسل كصورة وحدة بدون اطار ولا ايمبد.
*/
const games = {
  'اعلام': { hints: true, gen: () => { const [n, c] = pick(D.flags); return { text: 'ما اسم هذه الدولة؟', imageUrl: `https://flagcdn.com/w640/${c}.png`, answers: split(n) }; } },
  'عواصم': { gen: () => { const [c, cap] = pick(D.capitals); return { text: `ما عاصمة ${c}؟`, answers: split(cap) }; } },
  'حساب': { time: 12000, gen: () => {
    const a = rand(2, 30), b = rand(2, 30), op = pick(['+', '-', '×']);
    const r = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return { text: 'احسب الناتج بسرعة!', big: `${a} ${op} ${b} = ?`, noise: true, answers: [String(r)] };
  } },
  'فكك': { gen: () => { const w = pick(D.words); return { text: 'فكك الكلمة الى حروف بينها مسافة', big: w, noise: true, answers: [w.split('').join(' ')] }; } },
  'ربط': { gen: () => {
    const w = pick(D.words); let l = w.split('');
    for (let k = 0; k < 5 && l.join('') === w; k++) l = shuffle(l);
    return { text: 'رتب الحروف وكوّن الكلمة', big: l.join('  '), noise: true, answers: [w] };
  } },
  // اسرع: كلمة وحدة (مو جملة) من قائمة كبيرة بـ data.js (fast)
  'اسرع': { time: 12000, gen: () => { const names = split(pick(D.fast)); return { text: 'اكتب الكلمة بسرعة!', big: names[0], noise: true, answers: names }; } },
  'عكس': { gen: () => { const [a, b] = pick(D.antonyms); return { text: `ما عكس كلمة ${a}؟`, answers: split(b) }; } },
  'جمع': { gen: () => { const [s, p] = pick(D.plurals); return { text: `ما جمع كلمة ${s}؟`, answers: split(p) }; } },
  'مفرد': { gen: () => { const [s, p] = pick(D.plurals); return { text: `ما مفرد كلمة ${p}؟`, answers: split(s) }; } },
  'صح-خطا': { time: 12000, gen: () => { const [s, t] = pick(D.tf); return { text: `صح ولا خطأ؟\n${s}`, answers: t ? ['صح', 'صحيح'] : ['خطا', 'غلط', 'خطأ'] }; } },
  'ذاكرة': { gen: () => {
    const d = Array.from({ length: 5 }, () => rand(0, 9)).join('');
    return { text: 'احفظ الارقام! بتختفي بعد 4 ثواني', big: d.split('').join('  '), noise: true,
      hideAfter: 4000, hiddenText: 'اكتب الارقام اللي شفتها!', answers: [d, d.split('').join(' ')] };
  } },
  // تخمين: رقم من 1 الى 10. التخمينات الخاطئة تحصل على تلميح نصي، مع تلميحات إضافية مع الوقت.
  'تخمين': { time: 20000, gen: () => {
    const n = rand(1, 10);
    return { text: 'خمنت رقم من 1 الى 10، خمنوه!', answers: [String(n)], guess: { min: 1, max: 10 },
      hints: H.numberHints(n, 1, 10, [5], [0.4, 0.7]) };
  } },
  // كت: الامر نفسه معرّف تحت (kat) لانه يقبل سؤال من عندك: `كت سؤالك`
  'كت': { custom: true, gen: () => ({ text: pick(D.kat), noAnswer: true }) },
  // شعارات: تنجلب من simpleicons وتتحول لصورة PNG
  'شعار': { time: 20000, hints: true, gen: async () => {
    for (const [slug, names] of shuffle(D.logos).slice(0, 5)) {
      try {
        const r = await fetch(`https://cdn.simpleicons.org/${slug}`);
        if (!r.ok) continue;
        let svg = await r.text();
        if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="256" height="256"');
        const img = await loadImage(Buffer.from(svg));
        return { text: 'ما اسم هذا الشعار؟', image: img, panel: true, answers: split(names) };
      } catch {}
    }
    return null;
  } },
};

// العاب اضافية من data/custom.json (مثل معرفة)، وتقدر تضيف اي اسم جديد
try {
  const custom = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/custom.json'), 'utf8'));
  for (const [name, list] of Object.entries(custom)) {
    games[name] = { time: 20000, gen: () => {
      if (!list.length) return null;
      const e = pick(list);
      return { text: e.q || 'ما هذا؟', imageUrl: e.image, answers: e.a };
    } };
  }
} catch {}

// ينتظر اول جواب صحيح (او ينتهي الوقت). q.hints = تلميحات تنرسل مع الوقت.
// q.guess = لعبة تخمين رقم: التخمينات الخاطئة تحصل على تلميح نصي ضمن النطاق المحدد.
function ask(ch, state, q, time) {
  return new Promise(res => {
    const ok = t => q.answers.some(a => same(a, t));
    const isNum = t => {
      if (!q.guess || !/^\d{1,3}$/.test(norm(t))) return false;
      const number = Number(norm(t));
      return number >= q.guess.min && number <= q.guess.max;
    };
    let winner = null;
    const c = state.track(ch.createMessageCollector({
      time,
      filter: m => !m.author.bot && (q.guess ? isNum(m.content) : ok(m.content)),
    }));
    const cancel = H.schedule(t => ch.send(t).catch(() => {}), q.hints, time, () => c.ended || state.stopped);
    c.on('collect', m => {
      if (ok(m.content)) { winner = m; return c.stop('win'); }
      const hint = H.numberGuessFeedback(norm(m.content), q.answers[0]);
      void m.reply({ content: hint, allowedMentions: { repliedUser: false } })
        .catch(error => console.error('تعذّر إرسال تلميح تخمين الرقم:', error));
    });
    c.on('end', () => { cancel(); res(winner); });
  });
}

async function fetchImage(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return loadImage(Buffer.from(await r.arrayBuffer()));
}

// يبني صورة السؤال (صورة وحدة)
async function questionFile(title, q) {
  let image = q.image || null;
  if (!image && q.imageUrl) {
    try { image = await fetchImage(q.imageUrl); }
    catch (e) { console.warn('ما قدرت اجلب صورة السؤال:', e.message); }
  }
  return questionCard({ title, text: q.text, big: q.big, image, panel: q.panel, noise: q.noise });
}

async function run(msg, name, def, gameName = name, count = 1) {
  const ch = msg.channel;
  const state = start(ch, msg.author.id);
  const scores = new Map();
  try {
    const rounds = Math.max(1, Math.min(10, count || 1)); // سؤال واحد افتراضياً، واذا كتبت رقم (مثل: عواصم 5) تصير جولات
    for (let i = 1; i <= rounds && !state.stopped; i++) {
      const q = await def.gen();
      if (!q) { await ch.send('📭 ما قدرت اجهز سؤال للعبة هذي (تأكد من الانترنت او من `data/custom.json`)'); break; }
      const title = rounds > 1 ? `${gameName} • ${i}/${rounds}` : gameName;
      const sent = await ch.send({ files: [await questionFile(title, q)] });
      if (q.noAnswer) break;
      if (q.hideAfter) {
        await sleep(q.hideAfter);
        if (state.stopped) break;
        await sent.edit({ files: [questionCard({ title, text: q.hiddenText })], attachments: [] }).catch(() => {});
      }
      if (def.hints && !q.hints) q.hints = H.textHints(q.answers[0]);
      const win = await ask(ch, state, q, def.time ?? 15000);
      if (state.stopped) break;
      if (win) {
        const pts = db.mult();
        db.addPoints(win.author.id, pts, gameName);
        scores.set(win.author.id, (scores.get(win.author.id) || 0) + 1);
        await win.react('✅').catch(() => {});
        await ch.send(`🎉 ${win.author} جاوب صح! **+${pts}**`);
      } else {
        await ch.send({ files: [questionCard({ title: 'انتهى الوقت', text: 'الجواب:', big: q.answers[0] })] });
      }
      if (i < rounds) await sleep(1500);
    }
    if (rounds > 1 && scores.size && !state.stopped) {
      const top = [...scores].sort((a, b) => b[1] - a[1]);
      const medals = ['🥇', '🥈', '🥉'];
      await ch.send(`🏁 نتيجة ${gameName}\n${top.map(([id, n], k) => `${medals[k] || '▫️'} <@${id}> — ${n}`).join('\n')}`);
    }
  } finally { end(ch, state); }
}

// كت: `كت` = سؤال عشوائي، و `كت سؤالك هنا` = يسوي صورة بنفس شكل سؤال كت من كلامك
// ما يحتاج لعبة شغالة وما يوقف اللعبة اللي بالروم
async function kat(msg, args) {
  const t = args.join(' ')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<@!?(\d+)>/g, (_, id) => '@' + (msg.mentions.users.get(id)?.username ?? ''))
    .replace(/<@&(\d+)>/g, (_, id) => '@' + (msg.guild.roles.cache.get(id)?.name ?? ''))
    .replace(/<#(\d+)>/g, (_, id) => '#' + (msg.guild.channels.cache.get(id)?.name ?? ''))
    .replace(/\s+/g, ' ').trim();
  if (t.length > 200) return msg.reply('السؤال طويل شوي، خليه اقل من 200 حرف');
  return msg.channel.send({ files: [questionCard({ title: 'كتتويت', text: t || pick(D.kat) })] });
}

module.exports = { games, run, kat };
