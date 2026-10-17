const { ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../db');
const { eph, btn, row, lobby } = require('../core');
const { card, classicCard, playersImage } = require('../img');
const { pick, sleep, same } = require('../util');

const nm = u => u.displayName || u.username;
const shuffle = a => [...a].sort(() => Math.random() - 0.5);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const wait = async (state, ms) => { const e = Date.now() + ms; while (Date.now() < e && !state.stopped) await sleep(500); };
const whisper = (i, files, content = '') => i.reply({ content, files, flags: MessageFlags.Ephemeral }).catch(() => {});

// يرجع الشخص اللي عليه اكثر اصوات (او null اذا تعادل / ما احد صوّت)
function topVoted(votes) {
  const tally = new Map();
  votes.forEach(t => t !== 'skip' && tally.set(t, (tally.get(t) || 0) + 1));
  if (!tally.size) return null;
  const mx = Math.max(...tally.values()), tops = [...tally].filter(([, v]) => v === mx);
  return tops.length === 1 ? tops[0][0] : null;
}
function voteRows(prefix, people, skip = false) {
  const rows = chunk(people.map(p => btn(`${prefix}:${p.id}`, nm(p).slice(0, 20), ButtonStyle.Secondary)), 5).map(r => row(...r));
  if (skip) rows.push(row(btn(`${prefix}:skip`, 'تخطي', ButtonStyle.Danger)));
  return rows;
}
async function collectVotes(state, ch, prefix, voters, people, content, time, skip) {
  const votes = new Map();
  const m = await ch.send({ content, files: [classicCard('🗳️ التصويت', 'صوّتوا الان')], components: voteRows(prefix, people, skip) });
  await new Promise(res => {
    const c = state.track(m.createMessageComponentCollector({ time }));
    c.on('collect', i => {
      if (!i.customId.startsWith(prefix + ':')) return;
      if (!voters.some(v => v.id === i.user.id)) return eph(i, 'ما تقدر تصوّت');
      votes.set(i.user.id, i.customId.split(':')[1]);
      eph(i, '✅ تم تصويتك (تقدر تغيره)');
      if (votes.size === voters.length) c.stop('all');
    });
    c.on('end', res);
  });
  await m.edit({ components: [] }).catch(() => {});
  return votes;
}

/* ---------------- مافيا ---------------- */
const R = {
  mafia: ['🔪 مافيا', 'اقتل مواطن كل ليلة وخلك مخفي'],
  doctor: ['💉 دكتور', 'انقذ شخص كل ليلة من القتل'],
  detective: ['🕵️ محقق', 'اكشف هوية شخص كل ليلة'],
  citizen: ['👤 مواطن', 'اكتشف المافيا وصوّت عليهم'],
};
async function mafia(msg, state, name) {
  const players = await lobby(msg, state, name, { min: 4, max: 20, time: 45000, desc: 'مافيا ودكتور ومحقق ومواطنين 🔪 الليل للمافيا والنهار للتصويت', classic: true });
  if (!players) return;
  const ch = msg.channel, n = players.length, mc = Math.max(1, Math.floor(n / 4));
  const role = new Map();
  shuffle(players).forEach((p, i) => role.set(p.id, i < mc ? 'mafia' : i === mc ? 'doctor' : i === mc + 1 && n >= 6 ? 'detective' : 'citizen'));
  let alive = [...players]; const dead = [];
  const mafiaAlive = () => alive.filter(p => role.get(p.id) === 'mafia');
  const winner = () => { const m = mafiaAlive().length, o = alive.length - m; return m === 0 ? 'citizens' : m >= o ? 'mafia' : null; };

  const rm = await ch.send({ content: `🎭 اللعبة بدت! ${n} لاعبين، ${mc} مافيا. اضغط الزر لتعرف دورك (سري) — 20 ثانية`,
    files: [classicCard('🎭 مافيا', `${n} لاعبين\n${mc} مافيا`)], components: [row(btn('role', '🎭 اعرف دورك'))] });
  await new Promise(res => {
    const c = state.track(rm.createMessageComponentCollector({ time: 20000 }));
    c.on('collect', i => {
      const r = role.get(i.user.id);
      if (!r) return eph(i, 'مو من اللاعبين');
      const partners = r === 'mafia' ? `\nالمافيا: ${players.filter(p => role.get(p.id) === 'mafia').map(nm).join('، ')}` : '';
      whisper(i, [classicCard('دورك', `${R[r][0]}\n${R[r][1]}${partners}`, { size: 40 })]);
    });
    c.on('end', res);
  });
  await rm.edit({ components: [] }).catch(() => {});

  const endGame = async w => {
    const winners = players.filter(p => (role.get(p.id) === 'mafia') === (w === 'mafia'));
    const pts = 5 * db.mult();
    winners.forEach(p => db.addPoints(p.id, pts, name));
    await ch.send({ content: `🏆 فاز ${w === 'mafia' ? 'فريق المافيا 🔪' : 'المواطنين 👥'}! +${pts} نقطة لكل واحد من الفريق`,
      files: [classicCard('🎭 الادوار', players.map(p => `${nm(p)}: ${R[role.get(p.id)][0]}`).join('\n'), { size: 30 })] });
  };

  for (let day = 1; !state.stopped; day++) {
    // ---- الليل
    const nightMsg = await ch.send({ content: `🌙 **الليلة ${day}** — المافيا والدكتور والمحقق اضغطوا الزر (35 ثانية)`,
      files: [classicCard(`🌙 الليلة ${day}`, 'الكل نايم... الا البعض')], components: [row(btn('act', '🌙 نفّذ دورك'))] });
    const kills = new Map(), acted = new Set(); let saved = null;
    const specials = alive.filter(p => role.get(p.id) !== 'citizen').length;
    await new Promise(res => {
      const c = state.track(ch.createMessageComponentCollector({ time: 35000 }));
      c.on('collect', async i => {
        const r = role.get(i.user.id), isAlive = alive.some(a => a.id === i.user.id);
        if (i.customId === 'act') {
          if (!r || !isAlive) return eph(i, 'مو من اللاعبين الاحياء');
          if (r === 'citizen') return eph(i, '😴 انت مواطن، نام بهدوء');
          if (acted.has(i.user.id)) return eph(i, 'نفذت دورك');
          const pre = r === 'mafia' ? 'k' : r === 'doctor' ? 's' : 'i';
          const cands = r === 'mafia' ? alive.filter(p => role.get(p.id) !== 'mafia') : r === 'doctor' ? alive : alive.filter(p => p.id !== i.user.id);
          return i.reply({ content: r === 'mafia' ? '🔪 مين تبي تقتل؟' : r === 'doctor' ? '💉 مين تنقذ؟' : '🕵️ مين تحقق منه؟',
            components: voteRows(pre, cands), flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        const [pre, tid] = i.customId.split(':');
        const need = { k: 'mafia', s: 'doctor', i: 'detective' }[pre];
        if (!need || !tid) return;
        const target = alive.find(p => p.id === tid);
        if (role.get(i.user.id) !== need || !isAlive || acted.has(i.user.id) || !target) return eph(i, 'ما تقدر');
        acted.add(i.user.id);
        if (pre === 'k') kills.set(i.user.id, tid);
        if (pre === 's') saved = tid;
        const text = pre === 'i' ? `🔍 ${nm(target)}: ${role.get(tid) === 'mafia' ? '**مافيا** 🔪' : 'بريء ✅'}` : `✅ اخترت ${nm(target)}`;
        await i.update({ content: text, components: [] }).catch(() => {});
        if (acted.size >= specials) c.stop('all');
      });
      c.on('end', res);
    });
    if (state.stopped) return;
    await nightMsg.edit({ components: [] }).catch(() => {});
    let victim = null;
    if (kills.size) {
      const tally = new Map(); kills.forEach(t => tally.set(t, (tally.get(t) || 0) + 1));
      const mx = Math.max(...tally.values());
      victim = pick([...tally].filter(([, v]) => v === mx).map(([k]) => k));
    }
    let text;
    if (!victim) text = '🌅 الصباح طلع والمافيا ما قتلت احد!';
    else if (victim === saved) text = '🌅 المافيا حاولت تقتل لكن الدكتور انقذ الضحية! 💉';
    else {
      const p = alive.find(a => a.id === victim);
      alive = alive.filter(a => a.id !== victim); dead.push(p);
      text = `🌅 الصباح طلع ولقينا ${p} مقتول! كان **${R[role.get(victim)][0]}**`;
    }
    await ch.send({ content: text, files: [playersImage('الاحياء', alive, dead, { glass: false })] });
    let w = winner(); if (w) return endGame(w);

    // ---- النهار
    await ch.send({ content: '☀️ **النهار** — ناقشوا مين المافيا! التصويت بعد 45 ثانية', files: [classicCard('☀️ النهار', 'ناقشوا 45 ثانية')] });
    await wait(state, 45000);
    if (state.stopped) return;
    const votes = await collectVotes(state, ch, 'v', alive, alive, '🗳️ صوتوا على المشتبه (40 ثانية)', 40000, true);
    if (state.stopped) return;
    const out = topVoted(votes);
    if (!out) await ch.send('🤷 تعادل او ما احد صوّت، ما طلع احد!');
    else {
      const p = alive.find(a => a.id === out);
      alive = alive.filter(a => a.id !== out); dead.push(p);
      await ch.send({ content: `⚖️ طلع ${p} بالتصويت! كان **${R[role.get(out)][0]}**`, files: [playersImage('الاحياء', alive, dead, { glass: false })] });
    }
    w = winner(); if (w) return endGame(w);
    await sleep(1500);
  }
}

/* ---------------- برا السالفة ---------------- */
const TOPICS = {
  'اكلات': ['كبسة', 'شاورما', 'برجر', 'بيتزا', 'دولمة', 'مسكوف', 'باجة', 'كباب', 'سوشي', 'فلافل'],
  'حيوانات': ['اسد', 'فيل', 'زرافة', 'جمل', 'قرد', 'دلفين', 'حصان', 'ذئب', 'بطريق', 'تمساح'],
  'اماكن': ['مطار', 'مستشفى', 'مدرسة', 'سوق', 'ملعب', 'مسجد', 'سينما', 'شاطئ', 'مطعم', 'جامعة'],
  'مهن': ['طبيب', 'معلم', 'طيار', 'شرطي', 'مهندس', 'نجار', 'طباخ', 'سائق', 'محامي', 'خياط'],
  'دول': ['العراق', 'مصر', 'اليابان', 'البرازيل', 'تركيا', 'فرنسا', 'السعودية', 'كندا', 'الهند', 'المغرب'],
};
async function outsider(msg, state, name) {
  const players = await lobby(msg, state, name, { min: 3, max: 15, desc: 'الكل يعرف الكلمة الا واحد "برا السالفة" 🕵️ اكتشفوه قبل ما يكتشف السالفة!' });
  if (!players) return;
  const ch = msg.channel, cat = pick(Object.keys(TOPICS)), word = pick(TOPICS[cat]), out = pick(players);

  const rm = await ch.send({ content: `🕵️ الفئة: **${cat}** — اضغط الزر لتعرف كلمتك (سري، 20 ثانية)`,
    files: [card('برا السالفة', `الفئة: ${cat}`, { size: 60 })], components: [row(btn('role', '👁️ كلمتي'))] });
  await new Promise(res => {
    const c = state.track(rm.createMessageComponentCollector({ time: 20000 }));
    c.on('collect', i => {
      if (!players.some(p => p.id === i.user.id)) return eph(i, 'مو من اللاعبين');
      whisper(i, [card('كلمتك', i.user.id === out.id ? `انت برا السالفة! 😶\nالفئة: ${cat}\nحاول تعرف الكلمة` : `الكلمة: ${word}`, { size: 50 })]);
    });
    c.on('end', res);
  });
  await rm.edit({ components: [] }).catch(() => {});

  await ch.send({ content: '💬 **النقاش** — كل واحد يسأل غيره اسئلة عن السالفة بدون ما يذكر الكلمة! (90 ثانية)', files: [card('💬 النقاش', 'اسألوا بعض 90 ثانية', { size: 56 })] });
  await wait(state, 90000);
  if (state.stopped) return;

  const votes = await collectVotes(state, ch, 'o', players, players, '🗳️ مين برا السالفة؟ (30 ثانية)', 30000, false);
  if (state.stopped) return;
  const accused = topVoted(votes);
  let outsiderWins = true;
  if (accused === out.id) {
    await ch.send(`🎯 كشفتوه! ${out} كان برا السالفة. لكن عنده فرصة اخيرة: يخمن الكلمة بـ 20 ثانية!`);
    const g = await new Promise(res => {
      const c = state.track(ch.createMessageCollector({ time: 20000, max: 1, filter: m => m.author.id === out.id }));
      c.on('end', col => res(col.first() ?? null));
    });
    if (state.stopped) return;
    outsiderWins = !!g && same(g.content, word);
  }
  const pts = 5 * db.mult();
  if (outsiderWins) db.addPoints(out.id, pts + 3, name);
  else players.filter(p => p.id !== out.id).forEach(p => db.addPoints(p.id, pts, name));
  await ch.send({ content: outsiderWins ? `😈 فاز ${out} (برا السالفة)! الكلمة كانت **${word}**` : `🏆 فاز اللي داخل السالفة! الكلمة كانت **${word}**`,
    files: [card(outsiderWins ? '😈 فاز برا السالفة' : '🏆 فاز الباقين', `الكلمة: ${word}\nبرا السالفة: ${nm(out)}`, { size: 46 })] });
}

module.exports = { 'مافيا': mafia, 'برا السالفة': outsider };
