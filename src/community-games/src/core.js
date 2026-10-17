const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('./db');
const { start, end } = require('./state');
const { pick, rand, sleep } = require('./util');
const { card, classicCard, lobbyImage, playersImage } = require('./img');

const eph = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
const list = a => a.map(u => `• ${u}`).join('\n');
const btn = (id, label, style = ButtonStyle.Primary, dis = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(dis);
const row = (...b) => new ActionRowBuilder().addComponents(...b);

// ينتظر ضغطة زر من لاعب محدد
function waitClick(m, state, userId, time) {
  return new Promise(res => {
    const c = state.track(m.createMessageComponentCollector({ time }));
    c.on('collect', i => { if (i.user.id !== userId) return eph(i, 'مو دورك ✋'); res(i); c.stop('done'); });
    c.on('end', () => res(null));
  });
}

async function lobby(msg, state, title, { min = 2, max = 25, time = 45000, desc = '', classic = false } = {}) {
  const players = new Map();
  const startedAt = Date.now();
  const rows = (d = false) => [row(
    btn('join', 'انضمام', ButtonStyle.Success, d),
    btn('leave', 'انسحاب', ButtonStyle.Danger, d),
    btn('go', classic ? 'ابدأ (للمضيف)' : 'ابدأ اللعبة', classic ? ButtonStyle.Secondary : ButtonStyle.Primary, d))];
  const view = edit => {
    const file = classic
      ? playersImage(`${title}  (${players.size}/${max})`, [...players.values()], [], { glass: false })
      : lobbyImage(title, desc, [...players.values()], {
        min, max, seconds: Math.ceil(Math.max(0, time - (Date.now() - startedAt)) / 1000), hostId: msg.author.id,
      });
    const embed = new EmbedBuilder().setColor(classic ? 0x26b6a8 : 0x143c46)
      .setAuthor({ name: classic ? 'dev.splosh' : 'dev.splosh • GAME LOBBY' })
      .setTitle(`🎮 ${title}`).setDescription(`${desc}\n${classic ? `التسجيل ينتهي بعد ${time / 1000} ثانية` : 'اضغط «انضمام» للدخول إلى التحدي'}`)
      .setImage('attachment://' + file.name)
      .setFooter({ text: classic ? 'dev.splosh • التسجيل مفتوح' : 'dev.splosh • جهّز نفسك للتحدي' });
    const o = { embeds: [embed], files: [file] };
    if (edit) o.attachments = [];
    return o;
  };
  const m = await msg.channel.send({ ...view(false), components: rows() });
  await new Promise(res => {
    const c = state.track(m.createMessageComponentCollector({ time }));
    c.on('collect', async i => {
      if (i.customId === 'join') {
        if (players.size >= max) return eph(i, 'الغرفة ممتلئة');
        players.set(i.user.id, i.user);
      } else if (i.customId === 'leave') players.delete(i.user.id);
      else {
        if (i.user.id !== msg.author.id) return eph(i, 'بس اللي بدأ اللعبة يقدر يبدأها');
        if (players.size < min) return eph(i, `لازم ${min} لاعبين على الاقل`);
        await i.deferUpdate().catch(() => {});
        return c.stop('go');
      }
      await i.update(view(true)).catch(() => {});
    });
    c.on('end', res);
  });
  await m.edit({ components: rows(true) }).catch(() => {});
  if (state.stopped) return null;
  const arr = [...players.values()];
  if (arr.length < min) { await msg.channel.send(`❌ ما اكتمل العدد (${min} على الاقل)`); return null; }
  return arr;
}

async function finish(ch, game, w, { classic = false } = {}) {
  const pts = 5 * db.mult();
  db.addPoints(w.id, pts, game);
  const makeCard = classic ? classicCard : card;
  const file = makeCard(`🏆 ${game}`, `الفائز: ${w.displayName || w.username}\n+${pts} نقطة`, { size: 52 });
  await ch.send({ content: `🏆 ${w} فاز في **${game}**`, files: [file] });
}

/* ---------------- الالعاب ---------------- */

async function russian(msg, state, name) {
  let alive = await lobby(msg, state, name, { max: 8, desc: 'مسدس فيه طلقة وحدة من 6، كل واحد يسحب بدوره 🔫' });
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const bullet = rand(1, 6);
    let shot = 0, turn = 0, out = null;
    await ch.send('🔫 تعبئة مسدس بطلقة وحدة وتدوير الاسطوانة...');
    while (!out && !state.stopped) {
      const p = alive[turn % alive.length];
      const m = await ch.send({ content: `${p} دورك! اسحب الزناد (20 ثانية)`, components: [row(btn('t', '🔫 اسحب', ButtonStyle.Danger))] });
      const i = await waitClick(m, state, p.id, 20000);
      if (state.stopped) return;
      shot++;
      if (!i) { out = p; await m.edit({ content: `⏰ ${p} تأخر وانحسبت عليه!`, components: [] }); }
      else if (shot === bullet) { out = p; await i.update({ content: `💥 بوم! الطلقة طلعت على ${p}`, components: [] }); }
      else { await i.update({ content: `😮‍💨 ${p} نجا!`, components: [] }); turn++; await sleep(1000); }
    }
    if (out) { alive = alive.filter(u => u.id !== out.id); (state.dead ??= []).push(out); await ch.send({ files: [playersImage('الباقين: ' + alive.length, alive, state.dead)] }); }
    await sleep(1500);
  }
  if (!state.stopped) await finish(ch, name, alive[0]);
}

async function bomb(msg, state, name) {
  let alive = await lobby(msg, state, name, { desc: 'القنبلة تنتقل بين اللاعبين، منشن شخص عشان تمررها له! اللي تنفجر عنده يطلع 💣' });
  if (!alive) return;
  const ch = msg.channel;
  let holder = pick(alive);
  while (alive.length > 1 && !state.stopped) {
    const fuse = rand(15, 30) * 1000;
    await ch.send(`💣 القنبلة عند ${holder}! منشن شخص تمررها له بسرعة!`);
    const loser = await new Promise(res => {
      let cur = holder;
      const c = state.track(ch.createMessageCollector({ time: fuse }));
      c.on('collect', m => {
        if (m.author.id !== cur.id) return;
        const t = m.mentions.users.find(u => u.id !== cur.id && alive.some(a => a.id === u.id));
        if (t) { cur = alive.find(a => a.id === t.id); ch.send(`💣➡️ ${cur} القنبلة عندك!`); }
      });
      c.on('end', () => res(cur));
    });
    if (state.stopped) return;
    alive = alive.filter(u => u.id !== loser.id); (state.dead ??= []).push(loser); await ch.send({ files: [playersImage('الباقين: ' + alive.length, alive, state.dead)] });
    await ch.send(`💥 **بومب!** انفجرت عند ${loser}`);
    holder = pick(alive);
    await sleep(2000);
  }
  if (!state.stopped) await finish(ch, name, alive[0]);
}

async function boom(msg, state, name) {
  let alive = await lobby(msg, state, name, { desc: '5 اسلاك وواحد منهم مفخخ، كل واحد يقص سلك بدوره ✂️' });
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const bad = rand(0, 4), taken = new Set();
    let turn = 0, out = null;
    await ch.send('💣 زرعنا قنبلة بين 5 اسلاك، واحد منهم ينفجر!');
    while (!out && !state.stopped) {
      const p = alive[turn % alive.length];
      const rows = dis => [row(...[0, 1, 2, 3, 4].map(n =>
        btn('w' + n, `سلك ${n + 1}`, taken.has(n) ? ButtonStyle.Success : ButtonStyle.Secondary, dis || taken.has(n))))];
      const m = await ch.send({ content: `✂️ ${p} اختر سلك (20 ثانية)`, components: rows(false) });
      const i = await waitClick(m, state, p.id, 20000);
      if (state.stopped) return;
      if (!i) { out = p; await m.edit({ content: `⏰ ${p} تأخر وانفجرت القنبلة!`, components: [] }); break; }
      const n = +i.customId.slice(1);
      if (n === bad) { out = p; await i.update({ content: `💥 سلك ${n + 1} كان المفخخ! طلع ${p}`, components: [] }); }
      else { taken.add(n); await i.update({ content: `✅ ${p} قص سلك ${n + 1} ونجا`, components: rows(true) }); turn++; await sleep(1200); }
    }
    if (out) { alive = alive.filter(u => u.id !== out.id); (state.dead ??= []).push(out); await ch.send({ files: [playersImage('الباقين: ' + alive.length, alive, state.dead)] }); }
    await sleep(1500);
  }
  if (!state.stopped) await finish(ch, name, alive[0]);
}

async function chairs(msg, state, name) {
  let alive = await lobby(msg, state, name, { min: 3, desc: 'لما توقف الموسيقى اجلس على كرسي بسرعة، كل جولة ينقص كرسي 🪑' });
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const m = await ch.send(`🎵 الموسيقى شغالة... (${alive.length} لاعبين)`);
    await sleep(rand(4000, 9000));
    if (state.stopped) return;
    const n = alive.length - 1, seats = new Map();
    const rows = () => {
      const out = [];
      for (let r = 0; r < n; r += 5) out.push(row(...Array.from({ length: Math.min(5, n - r) }, (_, k) => {
        const idx = r + k, u = seats.get(idx);
        return btn('c' + idx, u ? u.username.slice(0, 20) : `🪑 ${idx + 1}`, u ? ButtonStyle.Success : ButtonStyle.Primary, !!u);
      })));
      return out;
    };
    await m.edit({ content: '🛑 توقفت الموسيقى! اجلسوا بسرعة!', components: rows() });
    await new Promise(res => {
      const c = state.track(m.createMessageComponentCollector({ time: 8000 }));
      c.on('collect', async i => {
        if (!alive.some(a => a.id === i.user.id)) return eph(i, 'انت مو بالجولة');
        if ([...seats.values()].some(u => u.id === i.user.id)) return eph(i, 'عندك كرسي!');
        const idx = +i.customId.slice(1);
        if (seats.has(idx)) return eph(i, 'الكرسي انحجز');
        seats.set(idx, i.user);
        await i.update({ components: rows() }).catch(() => {});
        if (seats.size === n) c.stop('full');
      });
      c.on('end', res);
    });
    if (state.stopped) return;
    const seated = new Set([...seats.values()].map(u => u.id));
    let out = alive.filter(a => !seated.has(a.id));
    if (out.length === alive.length) out = [pick(alive)];
    alive = alive.filter(a => !out.some(o => o.id === a.id)); (state.dead ??= []).push(...out); await ch.send({ files: [playersImage('الباقين: ' + alive.length, alive, state.dead)] });
    await m.edit({ content: `💺 طلعوا: ${out.join(' ')}`, components: [] }).catch(() => {});
    await sleep(2000);
  }
  if (!state.stopped && alive.length) await finish(ch, name, alive[0]);
}

async function rps(msg, state, name) {
  const ps = await lobby(msg, state, name, { min: 2, max: 2, desc: 'لاعبين اثنين فقط ✌️' });
  if (!ps) return;
  const ch = msg.channel;
  const E = { r: '🪨 حجر', p: '📄 ورقة', s: '✂️ مقص' };
  const beats = { r: 's', p: 'r', s: 'p' };
  for (let round = 1; round <= 5 && !state.stopped; round++) {
    const picks = new Map();
    const m = await ch.send({ content: `${ps[0]} 🆚 ${ps[1]}\nاختاروا (اختيارك سري)`,
      components: [row(btn('r', '🪨 حجر'), btn('p', '📄 ورقة'), btn('s', '✂️ مقص'))] });
    await new Promise(res => {
      const c = state.track(m.createMessageComponentCollector({ time: 20000 }));
      c.on('collect', async i => {
        if (!ps.some(p => p.id === i.user.id)) return eph(i, 'مو من اللاعبين');
        if (picks.has(i.user.id)) return eph(i, 'اخترت قبل');
        picks.set(i.user.id, i.customId);
        await eph(i, `اخترت ${E[i.customId]}`);
        if (picks.size === 2) c.stop('all');
      });
      c.on('end', res);
    });
    await m.edit({ components: [] }).catch(() => {});
    if (state.stopped) return;
    if (picks.size < 2) return ch.send('⏰ انتهى الوقت وما اختار الكل');
    const [a, b] = ps.map(p => picks.get(p.id));
    const L = { r: 'حجر', p: 'ورقة', s: 'مقص' };
    await ch.send({ content: `${ps[0]}: ${E[a]}\n${ps[1]}: ${E[b]}`, files: [card('حجرة ورقة مقص', `${ps[0].username}: ${L[a]}\n${ps[1].username}: ${L[b]}`, { size: 46 })] });
    if (a === b) { await ch.send('🤝 تعادل! نعيد'); await sleep(1500); continue; }
    return finish(ch, name, beats[a] === b ? ps[0] : ps[1]);
  }
}

const basic = { 'روسي': russian, 'بومب': bomb, 'انفجار': boom, 'كراسي': chairs, 'حجرة': rps };

module.exports = { basic, eph, list, btn, row, waitClick, lobby, finish };
