const { ButtonStyle } = require('discord.js');
const db = require('../db');
const { eph, btn, row, waitClick, lobby, finish } = require('../core');
const { card, xoImage, c4Image, gridImage, houseImage, playersImage } = require('../img');
const { pick, rand, sleep, norm } = require('../util');
const H = require('../hints');

const nm = u => u.displayName || u.username;
const shuffle = a => [...a].sort(() => Math.random() - 0.5);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---- اكس (XO)
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
async function xo(msg, state, name) {
  const found = await lobby(msg, state, name, { min: 2, max: 2, desc: 'لاعبين اثنين ❌⭕' });
  if (!found) return;
  const ps = shuffle(found), ch = msg.channel, marks = ['X', 'O'], b = Array(9).fill(null);
  let turn = 0;
  const rows = dis => chunk(b.map((v, k) => btn('x' + k, v === 'X' ? '❌' : v === 'O' ? '⭕' : '⬜',
    v === 'X' ? ButtonStyle.Danger : v === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary, dis || !!v)), 3).map(r => row(...r));
  const m = await ch.send({ content: `${ps[0]} ❌ 🆚 ⭕ ${ps[1]}\n${ps[turn]} دورك!`, files: [xoImage(b)], components: rows(false) });
  while (!state.stopped) {
    const i = await waitClick(m, state, ps[turn].id, 60000);
    if (state.stopped) return;
    if (!i) { await m.edit({ content: `⏰ ${ps[turn]} تأخر! الفوز لـ ${ps[1 - turn]}`, components: [] }).catch(() => {}); return finish(ch, name, ps[1 - turn]); }
    b[+i.customId.slice(1)] = marks[turn];
    const line = LINES.find(l => l.every(k => b[k] === marks[turn]));
    if (line || b.every(Boolean)) {
      await i.update({ content: line ? `🏆 ${ps[turn]} فاز!` : '🤝 تعادل!', files: [xoImage(b, line)], attachments: [], components: rows(true) }).catch(() => {});
      return line ? finish(ch, name, ps[turn]) : undefined;
    }
    turn = 1 - turn;
    await i.update({ content: `${ps[0]} ❌ 🆚 ⭕ ${ps[1]}\n${ps[turn]} دورك!`, files: [xoImage(b)], attachments: [], components: rows(false) }).catch(() => {});
  }
}

// ---- وصل (Connect 4)
function c4Win(b, p) {
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let k = 0; while (k < 4 && b[r + dr * k]?.[c + dc * k] === p) k++;
      if (k === 4) return true;
    }
  return false;
}
async function connect4(msg, state, name) {
  const found = await lobby(msg, state, name, { min: 2, max: 2, desc: 'وصّل 4 قطع بنفس اللون 🔴🟡' });
  if (!found) return;
  const ps = shuffle(found), ch = msg.channel, b = Array.from({ length: 6 }, () => Array(7).fill(0));
  let turn = 0;
  const rows = dis => chunk(Array.from({ length: 7 }, (_, c) => btn('c' + c, String(c + 1), ButtonStyle.Primary, dis || b[0][c] !== 0)), 4).map(r => row(...r));
  const head = () => `${ps[0]} 🔴 🆚 🟡 ${ps[1]}\n${ps[turn]} دورك!`;
  const m = await ch.send({ content: head(), files: [c4Image(b)], components: rows(false) });
  while (!state.stopped) {
    const i = await waitClick(m, state, ps[turn].id, 60000);
    if (state.stopped) return;
    if (!i) { await m.edit({ content: `⏰ ${ps[turn]} تأخر! الفوز لـ ${ps[1 - turn]}`, components: [] }).catch(() => {}); return finish(ch, name, ps[1 - turn]); }
    const col = +i.customId.slice(1);
    let r = 5; while (b[r][col] !== 0) r--;
    b[r][col] = turn + 1;
    if (c4Win(b, turn + 1)) {
      await i.update({ content: `🏆 ${ps[turn]} فاز!`, files: [c4Image(b)], attachments: [], components: rows(true) }).catch(() => {});
      return finish(ch, name, ps[turn]);
    }
    if (b[0].every(v => v)) { await i.update({ content: '🤝 تعادل!', files: [c4Image(b)], attachments: [], components: rows(true) }).catch(() => {}); return; }
    turn = 1 - turn;
    await i.update({ content: head(), files: [c4Image(b)], attachments: [], components: rows(false) }).catch(() => {});
  }
}

// ---- لغم: كل واحد يفتح مربع بدوره، اللغم يطلعك
async function mines(msg, state, name) {
  let alive = await lobby(msg, state, name, { desc: 'كل واحد يفتح مربع بدوره، فيه 5 الغام 💣. اللي يفتح لغم يطلع، واخر واحد يبقى يفوز' });
  if (!alive) return;
  const ch = msg.channel, N = 20, bombs = new Set(shuffle([...Array(N).keys()]).slice(0, 5)), open = new Set();
  const safeCount = new Map(), dead = [];
  const cells = reveal => Array.from({ length: N }, (_, k) => (bombs.has(k) && (open.has(k) || reveal)) ? 'bomb' : open.has(k) ? 'safe' : 'hidden');
  const rows = dis => chunk(Array.from({ length: N }, (_, k) =>
    btn('m' + k, open.has(k) ? (bombs.has(k) ? '💣' : '✅') : String(k + 1), open.has(k) ? (bombs.has(k) ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary, dis || open.has(k))), 5).map(r => row(...r));
  const m = await ch.send({ content: 'ابتدت اللعبة 💣', files: [gridImage(4, 5, cells(false), 'لغم')], components: rows(false) });
  let turn = 0;
  while (alive.length > 1 && open.size < N - bombs.size + [...open].filter(k => bombs.has(k)).length && !state.stopped) {
    const p = alive[turn]; // turn = رقم اللاعب داخل alive (دايما صحيح)
    await m.edit({ content: `💣 ${p} دورك! افتح مربع (30 ثانية)` }).catch(() => {});
    const i = await waitClick(m, state, p.id, 30000);
    if (state.stopped) return;
    if (!i) {
      alive = alive.filter(u => u.id !== p.id); dead.push(p); turn %= alive.length; // نفس الرقم صار للي بعده
      await ch.send(`⏰ ${p} تأخر وطلع!`); continue;
    }
    const k = +i.customId.slice(1); open.add(k);
    if (bombs.has(k)) {
      alive = alive.filter(u => u.id !== p.id); dead.push(p); turn %= alive.length;
      await i.update({ content: `💥 ${p} فتح لغم وطلع!`, files: [gridImage(4, 5, cells(false), 'لغم')], attachments: [], components: rows(false) }).catch(() => {});
      await ch.send({ files: [playersImage(`الباقين: ${alive.length}`, alive, dead)] });
    } else {
      safeCount.set(p.id, (safeCount.get(p.id) || 0) + 1); turn = (turn + 1) % alive.length;
      await i.update({ content: `✅ ${p} نجا`, files: [gridImage(4, 5, cells(false), 'لغم')], attachments: [], components: rows(false) }).catch(() => {});
    }
    await sleep(600);
  }
  if (state.stopped) return;
  await m.edit({ content: 'انتهت اللعبة', files: [gridImage(4, 5, cells(true), 'الالغام')], attachments: [], components: [] }).catch(() => {});
  if (alive.length === 1) return finish(ch, name, alive[0]);
  const best = alive.slice().sort((a, b) => (safeCount.get(b.id) || 0) - (safeCount.get(a.id) || 0))[0];
  if (best) await finish(ch, name, best);
}

// ---- كنز: اول واحد يلقى الكنز. الفخاخ تجمدك. التلميحات: 🔥 قريب جدا، 🌡️ قريب، ❄️ بعيد
async function treasure(msg, state, name) {
  const players = await lobby(msg, state, name, {
    min: 2,
    max: 6,
    desc: 'ينضم اللاعبون بزر «انضمام»، ثم يفتح كل لاعب مربعاً بدوره حسب ترتيب الانضمام. ابحثوا عن الكنز وتجنبوا الفخاخ!',
  });
  if (!players) return;
  const ch = msg.channel, R = 4, C = 5, N = R * C;
  const ks = shuffle([...Array(N).keys()]), tre = ks[0], traps = new Set(ks.slice(1, 4)), opened = new Map(), frozen = new Map();
  const dist = k => Math.max(Math.abs((k % C) - (tre % C)), Math.abs(Math.floor(k / C) - Math.floor(tre / C)));
  const hint = k => (dist(k) <= 1 ? '🔥' : dist(k) === 2 ? '🌡️' : '❄️');
  const cells = reveal => Array.from({ length: N }, (_, k) => k === tre && (opened.has(k) || reveal) ? 'treasure' : traps.has(k) && (opened.has(k) || reveal) ? 'bomb' : opened.has(k) ? 'empty' : 'hidden');
  const rows = dis => chunk(Array.from({ length: N }, (_, k) =>
    btn('k' + k, opened.has(k) ? (opened.get(k)) : String(k + 1), opened.has(k) ? ButtonStyle.Success : ButtonStyle.Secondary, dis || opened.has(k))), 5).map(r => row(...r));
  const m = await ch.send({ content: '🪙 **كنز** — ابحثوا بالتناوب حسب ترتيب الانضمام؛ لكل لاعب 15 ثانية في دوره. 🔥 قريب جداً • 🌡️ قريب • ❄️ بعيد • فيه 3 فخاخ تجمدك 8 ثوانٍ (90 ثانية)',
    files: [gridImage(R, C, cells(false), 'ابحثوا عن الكنز')], components: rows(false) });
  const gameDeadline = Date.now() + 90000;
  let winner = null, turn = 0;
  while (!winner && Date.now() < gameDeadline && !state.stopped) {
    const player = players[turn % players.length];
    const turnDeadline = Math.min(Date.now() + 15000, gameDeadline);
    const frozenUntil = frozen.get(player.id) || 0;
    if (frozenUntil > Date.now()) {
      await m.edit({ content: `🥶 ${player} مجمّد من الفخ؛ ينتظر انتهاء التجميد، وبعدها يبدأ دوره.`, components: rows(false) }).catch(() => {});
      await sleep(Math.min(frozenUntil - Date.now(), Math.max(0, turnDeadline - Date.now())));
    }
    let clicked = false;
    while (!clicked && !winner && Date.now() < turnDeadline && !state.stopped) {
      const remaining = Math.min(turnDeadline, gameDeadline) - Date.now();
      if (remaining <= 0) break;
      await m.edit({
        content: `🪙 ${player} دورك! افتح مربعاً خلال ${Math.ceil(remaining / 1000)} ثانية. اللاعبون يتناوبون حسب ترتيب الانضمام.`,
        components: rows(false),
      }).catch(() => {});
      const i = await waitClick(m, state, player.id, remaining);
      if (state.stopped) return;
      if (!i) break;
      const k = Number(i.customId.slice(1));
      if (!Number.isInteger(k) || k < 0 || k >= N) {
        await eph(i, 'هذا المربع غير صالح.');
        continue;
      }
      if (opened.has(k)) {
        await eph(i, 'انفتح هذا المربع قبل؛ اختار مربعاً آخر في دورك.');
        continue;
      }
      clicked = true;
      if (k === tre) {
        opened.set(k, '⭐');
        winner = i.user;
        await i.update({ content: `⭐ ${i.user} لقى الكنز!`, files: [gridImage(R, C, cells(false), 'الكنز!')], attachments: [], components: rows(true) }).catch(() => {});
        break;
      }
      if (traps.has(k)) {
        opened.set(k, '💣');
        frozen.set(i.user.id, Date.now() + 8000);
        await i.update({ content: `💣 ${i.user} طاح بفخ وتجمد 8 ثوانٍ!`, files: [gridImage(R, C, cells(false), 'ابحثوا عن الكنز')], attachments: [], components: rows(false) }).catch(() => {});
      } else {
        opened.set(k, hint(k));
        await i.update({ content: `${hint(k)} ${i.user} فتح مربع ${k + 1}`, files: [gridImage(R, C, cells(false), 'ابحثوا عن الكنز')], attachments: [], components: rows(false) }).catch(() => {});
      }
    }
    if (!winner) {
      if (!clicked && !state.stopped) {
        await m.edit({ content: `⏰ انتهى دور ${player} من دون اختيار؛ ينتقل الدور للاعب التالي.`, components: rows(false) }).catch(() => {});
      }
      turn = (turn + 1) % players.length;
    }
  }
  if (state.stopped) return;
  if (winner) return finish(ch, name, winner);
  await m.edit({ content: `⏰ انتهى الوقت! الكنز كان بالمربع ${tre + 1}`, files: [gridImage(R, C, cells(true), 'ما انلقى الكنز')], attachments: [], components: [] }).catch(() => {});
}

// ---- خمن: خمنوا رقم من 1 الى 100
// كل تخمين غلط ياخذ ⬆️ (الرقم اكبر) او ⬇️ (اصغر)، ومع الوقت ينزل تلميح: زوجي/فردي ثم مدى 30 ثم 10
async function guess(msg, state, name) {
  const ch = msg.channel, secret = rand(1, 100), TIME = 60000;
  await ch.send({ content: '🤔 **خمن** — خمنت رقم من 1 الى 100، اكتبوا تخميناتكم! (60 ثانية)\n⬆️ = اكبر • ⬇️ = اصغر • وتلميحات تنزل مع الوقت 💡', files: [card('خمن الرقم', 'من 1 الى 100', { size: 70 })] });
  let cancel = () => {};
  const win = await new Promise(res => {
    const c = state.track(ch.createMessageCollector({ time: TIME, filter: m => !m.author.bot && /^\d{1,3}$/.test(norm(m.content)) }));
    cancel = H.schedule(t => ch.send(t).catch(() => {}), H.numberHints(secret, 1, 100, [30, 10], [0.3, 0.5, 0.75]), TIME, () => c.ended || state.stopped);
    c.on('collect', m => {
      const n = +norm(m.content);
      if (n === secret) { res(m); c.stop('win'); }
      else m.react(n < secret ? '⬆️' : '⬇️').catch(() => {});
    });
    c.on('end', () => res(null));
  });
  cancel();
  if (state.stopped) return;
  if (win) { await win.react('🎯').catch(() => {}); return finish(ch, name, win.author); }
  await ch.send({ content: `⏰ انتهى الوقت! الرقم كان **${secret}**`, files: [card('الرقم كان', String(secret), { size: 90 })] });
}

// ---- هايد: غميضة. واحد يدور والباقي يختبون
const ROOMS = ['المطبخ', 'غرفة النوم', 'الحمام', 'الصالة', 'المخزن', 'السطح', 'الحديقة', 'المرآب'];
async function hide(msg, state, name) {
  const players = await lobby(msg, state, name, { min: 3, max: 12, desc: 'واحد يدور والباقي يختبون بغرف البيت 🙈. الباحث عنده محاولات محدودة' });
  if (!players) return;
  const ch = msg.channel, seeker = pick(players), hiders = players.filter(p => p.id !== seeker.id);
  const spots = new Map(); // userId -> room index
  const roomBtns = (dis, extra = {}) => chunk(ROOMS.map((r, i) => btn('r' + i, r, extra[i] ?? ButtonStyle.Primary, dis || extra.dis?.has(i))), 4).map(r => row(...r));

  const m1 = await ch.send({ content: `🙈 الباحث: ${seeker}\nالمختبئين: اختاروا مكان اختباءكم (30 ثانية) — الاختيار سري`,
    files: [houseImage(ROOMS.map(n => ({ name: n, state: 'none' })))], components: roomBtns(false) });
  await new Promise(res => {
    const c = state.track(m1.createMessageComponentCollector({ time: 30000 }));
    c.on('collect', async i => {
      if (i.user.id === seeker.id) return eph(i, 'انت الباحث! 🔍');
      if (!hiders.some(h => h.id === i.user.id)) return eph(i, 'مو من اللاعبين');
      spots.set(i.user.id, +i.customId.slice(1));
      await eph(i, `اختبأت في **${ROOMS[+i.customId.slice(1)]}** (تقدر تغيره)`);
      if (spots.size === hiders.length) c.stop('all');
    });
    c.on('end', res);
  });
  if (state.stopped) return;
  await m1.edit({ components: [] }).catch(() => {});
  hiders.forEach(h => { if (!spots.has(h.id)) spots.set(h.id, rand(0, ROOMS.length - 1)); });

  const tries = hiders.length >= 6 ? 4 : 3, searched = new Set(), found = [];
  const info = () => ROOMS.map((n, i) => {
    const here = hiders.filter(h => spots.get(h.id) === i && found.some(f => f.id === h.id));
    return { name: n, state: !searched.has(i) ? 'none' : here.length ? 'found' : 'searched', note: searched.has(i) ? (here.length ? here.map(nm).join('،').slice(0, 20) : 'فاضي') : '' };
  });
  for (let t = 1; t <= tries && found.length < hiders.length && !state.stopped; t++) {
    const m = await ch.send({ content: `🔍 ${seeker} محاولة ${t}/${tries} — وين تدور؟ (30 ثانية)`, files: [houseImage(info())],
      components: chunk(ROOMS.map((r, i) => btn('r' + i, r, ButtonStyle.Success, searched.has(i))), 4).map(r => row(...r)) });
    const i = await waitClick(m, state, seeker.id, 30000);
    if (state.stopped) return;
    if (!i) { await m.edit({ content: '⏰ الباحث تأخر', components: [] }).catch(() => {}); break; }
    const k = +i.customId.slice(1); searched.add(k);
    const here = hiders.filter(h => spots.get(h.id) === k);
    found.push(...here);
    await i.update({ content: here.length ? `🎯 لقى ${here.join(' ')} في ${ROOMS[k]}!` : `😅 ${ROOMS[k]} فاضية`, files: [houseImage(info())], attachments: [], components: [] }).catch(() => {});
    await sleep(1200);
  }
  if (state.stopped) return;
  const safe = hiders.filter(h => !found.some(f => f.id === h.id));
  if (!safe.length) { await ch.send(`🏆 الباحث لقى الكل!`); return finish(ch, name, seeker); }
  const pts = 5 * db.mult();
  safe.forEach(h => db.addPoints(h.id, pts, name));
  await ch.send({ content: `🙈 المختبئين اللي نجوا: ${safe.join(' ')}\n+${pts} نقطة لكل واحد`, files: [card('🙈 نجوا من الباحث', safe.map(nm).join('\n'), { size: 40 })] });
}

module.exports = { 'اكس': xo, 'وصل': connect4, 'لغم': mines, 'كنز': treasure, 'خمن': guess, 'هايد': hide };
