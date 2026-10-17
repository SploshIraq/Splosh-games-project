const { ButtonStyle } = require('discord.js');
const db = require('../db');
const { eph, btn, row, waitClick, lobby, finish } = require('../core');
const { att, card, playersImage, cupsImage, patternImage, trackImage } = require('../img');
const { pick, rand, sleep } = require('../util');

const nm = u => u.displayName || u.username;
const shuffle = a => [...a].sort(() => Math.random() - 0.5);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const showAlive = async (ch, state, alive, out) => {
  (state.dead ??= []).push(...out);
  await ch.send({ files: [playersImage(`الباقين: ${alive.length}`, alive, state.dead)] });
};
// ما نطلع الكل: لازم يبقى واحد على الاقل
const capOut = (alive, out) => (out.length >= alive.length ? shuffle(out).slice(0, alive.length - 1) : out);

// ---- بار: كاسات عصير، كل واحد يختار كاس مختلف وواحد منها مسموم
async function bar(msg, state, name) {
  let alive = await lobby(msg, state, name, { max: 24, desc: 'كل واحد يختار كاس عصير، واحد من الكاسات مسموم 🥤☠️' }); // 24 لان الكاسات = اللاعبين+1 وديسكورد يسمح بـ 25 زر بس
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const n = alive.length + 1, bad = rand(0, n - 1), picks = new Map(), picked = new Map();
    const rows = dis => chunk(Array.from({ length: n }, (_, i) =>
      btn('g' + i, picks.has(i) ? nm(picks.get(i)).slice(0, 12) : `🥤 ${i + 1}`, picks.has(i) ? ButtonStyle.Success : ButtonStyle.Primary, dis || picks.has(i))), 5).map(r => row(...r));
    const m = await ch.send({ content: '🥤 اختاروا كاس! كل كاس لشخص واحد (20 ثانية)', files: [cupsImage(n)], components: rows(false) });
    await new Promise(res => {
      const c = state.track(m.createMessageComponentCollector({ time: 20000 }));
      c.on('collect', async i => {
        if (!alive.some(a => a.id === i.user.id)) return eph(i, 'انت مو بالجولة');
        if (picked.has(i.user.id)) return eph(i, 'اخترت كاس قبل');
        const idx = +i.customId.slice(1);
        picks.set(idx, i.user); picked.set(i.user.id, idx);
        await i.update({ components: rows(false) }).catch(() => {});
        if (picked.size === alive.length) c.stop('all');
      });
      c.on('end', res);
    });
    if (state.stopped) return;
    await m.edit({ components: [] }).catch(() => {});
    let out = alive.filter(a => !picked.has(a.id));
    const poisoned = picks.get(bad);
    if (poisoned) out.push(poisoned);
    await ch.send({ content: poisoned ? `☠️ الكاس المسموم رقم **${bad + 1}** وصاحبه ${poisoned}` : `☠️ الكاس المسموم رقم **${bad + 1}** وما احد اختاره!`,
      files: [cupsImage(n, { bad, picks })] });
    out = capOut(alive, out);
    alive = alive.filter(a => !out.some(o => o.id === a.id));
    if (out.length) await showAlive(ch, state, alive, out);
    await sleep(1500);
  }
  if (!state.stopped && alive.length) await finish(ch, name, alive[0]);
}

// ---- سكات: مرات ممنوع تكتب، ومرات لازم تكتب
async function silence(msg, state, name) {
  let alive = await lobby(msg, state, name, { desc: 'لما البوت يقول سكات ممنوع احد يكتب، ولما يقول اكتب لازم تكتب! 🤫' });
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const quiet = Math.random() < 0.6, dur = rand(6, 11) * 1000, spoke = new Set();
    await ch.send({ content: quiet ? '🤫 **سكات!** ممنوع احد يكتب!' : '✍️ **اكتبوا!** لازم كل واحد يكتب شي!',
      files: [card(quiet ? '🤫 سكات!' : '✍️ اكتب الان!', quiet ? 'ممنوع تكتب شي' : 'اكتب أي شي', { size: 70 })] });
    await new Promise(res => {
      const c = state.track(ch.createMessageCollector({ time: dur, filter: m => alive.some(a => a.id === m.author.id) }));
      c.on('collect', m => { spoke.add(m.author.id); if (quiet) m.react('❌').catch(() => {}); });
      c.on('end', res);
    });
    if (state.stopped) return;
    let out = quiet ? alive.filter(a => spoke.has(a.id)) : alive.filter(a => !spoke.has(a.id));
    await ch.send(quiet ? '✅ خلاص انتهى السكات!' : '⏱️ انتهى الوقت!');
    if (!out.length) { await ch.send('😎 الكل التزم، نكمل!'); await sleep(1500); continue; }
    if (out.length >= alive.length) { await ch.send('🤝 الكل غلط! نعيد الجولة'); await sleep(1500); continue; }
    alive = alive.filter(a => !out.some(o => o.id === a.id));
    await ch.send(`💥 طلعوا: ${out.join(' ')}`);
    await showAlive(ch, state, alive, out);
    await sleep(1500);
  }
  if (!state.stopped && alive.length) await finish(ch, name, alive[0]);
}

// ---- ريبلكا: احفظ النمط وكرره بالازرار
const COL = [
  { id: 'b', label: 'ازرق', style: ButtonStyle.Primary, hex: '#5865f2' },
  { id: 'g', label: 'اخضر', style: ButtonStyle.Success, hex: '#248046' },
  { id: 'r', label: 'احمر', style: ButtonStyle.Danger, hex: '#da373c' },
  { id: 'y', label: 'رمادي', style: ButtonStyle.Secondary, hex: '#6d6f78' },
];
async function replica(msg, state, name) {
  let alive = await lobby(msg, state, name, { desc: 'البوت يعرض نمط الوان، احفظه وكرره بالازرار بنفس الترتيب. اللي يغلط او يتأخر يطلع 🎨' });
  if (!alive) return;
  const ch = msg.channel;
  for (let round = 0; alive.length > 1 && !state.stopped; round++) {
    const L = Math.min(3 + round, 8), seq = Array.from({ length: L }, () => pick(COL));
    const m = await ch.send({ content: `👀 احفظوا النمط! (${L} الوان)`, files: [patternImage(seq)] });
    await sleep(1500 + L * 700);
    if (state.stopped) return;
    const prog = new Map(), failed = new Set(), done = new Set();
    const rows = [row(...COL.map(c => btn(c.id, c.label, c.style)))];
    await m.edit({ content: '🔁 كرروا النمط بالازرار! (20 ثانية)', files: [], attachments: [], components: rows }).catch(() => {});
    await new Promise(res => {
      const c = state.track(m.createMessageComponentCollector({ time: 20000 }));
      c.on('collect', async i => {
        if (!alive.some(a => a.id === i.user.id)) return eph(i, 'انت مو بالجولة');
        if (done.has(i.user.id)) return eph(i, 'خلصت ✅');
        if (failed.has(i.user.id)) return eph(i, 'غلطت ❌');
        const p = prog.get(i.user.id) || []; p.push(i.customId); prog.set(i.user.id, p);
        if (p[p.length - 1] !== seq[p.length - 1].id) { failed.add(i.user.id); return eph(i, '❌ غلط!'); }
        if (p.length === L) { done.add(i.user.id); eph(i, '✅ صح!'); } else eph(i, `✔️ ${p.length}/${L}`);
        if (done.size + failed.size === alive.length) c.stop('all');
      });
      c.on('end', res);
    });
    if (state.stopped) return;
    await m.edit({ components: [], files: [patternImage(seq)], attachments: [], content: '🎨 النمط الصحيح:' }).catch(() => {});
    const out = alive.filter(a => !done.has(a.id));
    if (!out.length) { await ch.send('🎯 الكل نجح! نزيد الصعوبة'); await sleep(1500); continue; }
    if (out.length >= alive.length) { await ch.send('🤝 الكل غلط! نعيد بنفس الصعوبة'); round--; await sleep(1500); continue; }
    alive = alive.filter(a => done.has(a.id));
    await ch.send(`💥 طلعوا: ${out.join(' ')}`);
    await showAlive(ch, state, alive, out);
    await sleep(1500);
  }
  if (!state.stopped && alive.length) await finish(ch, name, alive[0]);
}

// ---- حبار: الضوء الاخضر والاحمر. تقدم بالاخضر، لا تتحرك بالاحمر
async function squid(msg, state, name) {
  const players = await lobby(msg, state, name, { desc: 'اضغط تقدم لما الضوء اخضر 🟢 ولا تضغط لما يصير احمر 🔴. اول واحد يوصل 12 خطوة يفوز 🦑' });
  if (!players) return;
  const ch = msg.channel, goal = 12;
  const alive = new Map(players.map(p => [p.id, p])), steps = new Map(), dead = [];
  const img = title => trackImage(title, [...alive.values()].map(u => ({ name: u, steps: steps.get(u.id) || 0 }))
    .concat(dead.map(u => ({ name: u, steps: steps.get(u.id) || 0, dead: true }))), goal);
  let phase = 'wait', winner = null; // 'wait' = لسا ما بدت اللعبة، الضغط ما يحسب
  const m = await ch.send({ content: '🦑 جاهزين...', files: [img('لعبة الحبار')], components: [row(btn('go', '🏃 تقدم', ButtonStyle.Success))] });
  const col = state.track(m.createMessageComponentCollector({ time: 240000 }));
  col.on('collect', async i => {
    if (!alive.has(i.user.id)) return eph(i, 'انت طلعت او مو بالجولة');
    await i.deferUpdate().catch(() => {});
    if (phase === 'green') {
      const s = (steps.get(i.user.id) || 0) + 1; steps.set(i.user.id, s);
      if (s >= goal) { winner = i.user; col.stop('win'); }
    } else if (phase === 'red') {
      alive.delete(i.user.id); dead.push(i.user);
      ch.send(`🔫 ${i.user} تحرك والضوء احمر!`).catch(() => {});
      if (alive.size <= 1) col.stop('last');
    }
  });
  await sleep(2000);
  while (!col.ended && !state.stopped) {
    phase = 'green';
    await m.edit({ content: '🟢 **اخضر!** اضغطوا تقدم!', files: [img('🟢 اخضر')], attachments: [] }).catch(() => {});
    await sleep(rand(3000, 6000));
    if (col.ended) break;
    phase = 'red';
    await m.edit({ content: '🔴 **احمر!** لا تضغطون!', files: [img('🔴 احمر')], attachments: [] }).catch(() => {});
    await sleep(rand(2000, 4000));
  }
  phase = 'over'; col.stop('end');
  await m.edit({ components: [], files: [img('النتيجة')], attachments: [] }).catch(() => {});
  if (state.stopped) return;
  if (!winner && alive.size === 1) winner = [...alive.values()][0];
  if (winner) await finish(ch, name, winner); else await ch.send('😵 ما فاز احد');
}

// ---- ازرار: اضغط الزر المطلوب قبل الكل
async function buttons(msg, state, name) {
  const ch = msg.channel, ROUNDS = 6, wins = new Map(), users = new Map();
  await ch.send({ content: '🔘 **ازرار** — اضغط الزر المطلوب قبل الكل! (6 جولات)', files: [card('ازرار', 'جاهزين؟', { size: 70 })] });
  await sleep(2500);
  for (let r = 1; r <= ROUNDS && !state.stopped; r++) {
    const target = rand(1, 12), cooldown = new Map();
    const rows = (dis, hit) => chunk(Array.from({ length: 12 }, (_, i) =>
      btn('b' + (i + 1), String(i + 1), hit === i + 1 ? ButtonStyle.Success : ButtonStyle.Secondary, dis)), 4).map(x => row(...x));
    const m = await ch.send({ content: `🔘 الجولة ${r}/${ROUNDS}`, files: [card(`جولة ${r}`, `اضغط الزر رقم ${target}`, { size: 80 })], components: rows(false) });
    const winnerI = await new Promise(res => {
      const c = state.track(m.createMessageComponentCollector({ time: 15000 }));
      c.on('collect', i => {
        if ((cooldown.get(i.user.id) || 0) > Date.now()) return eph(i, 'انتظر شوي ⏳');
        if (+i.customId.slice(1) !== target) { cooldown.set(i.user.id, Date.now() + 2500); return eph(i, '❌ زر غلط! تجميد 2.5 ثانية'); }
        res(i); c.stop('hit');
      });
      c.on('end', () => res(null));
    });
    if (state.stopped) return;
    if (winnerI) {
      wins.set(winnerI.user.id, (wins.get(winnerI.user.id) || 0) + 1); users.set(winnerI.user.id, winnerI.user);
      await winnerI.update({ content: `✅ ${winnerI.user} ضغط الزر **${target}** اول واحد!`, components: rows(true, target) }).catch(() => {});
    } else await m.edit({ content: `⏰ ما احد ضغط الزر ${target}`, components: rows(true, target) }).catch(() => {});
    await sleep(1200);
  }
  if (state.stopped) return;
  if (!wins.size) return ch.send('😴 ما فاز احد');
  const top = [...wins].sort((a, b) => b[1] - a[1]);
  await ch.send({ files: [card('🔘 النتيجة', top.slice(0, 6).map(([id, n]) => `${nm(users.get(id))}: ${n}`).join('\n'), { size: 40 })] });
  await finish(ch, name, users.get(top[0][0]));
}

module.exports = { 'بار': bar, 'سكات': silence, 'ريبلكا': replica, 'حبار': squid, 'ازرار': buttons };
