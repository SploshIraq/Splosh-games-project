const { ButtonStyle } = require('discord.js');
const db = require('../db');
const { eph, btn, row, waitClick, lobby, finish } = require('../core');
const { wheelImage, wheelSpinGif, playersImage, columnsImage, classicCard } = require('../img');
const { pick, rand, sleep, norm } = require('../util');

const nm = u => u.displayName || u.username;

// اللي بالروم الصوتي. نجلبهم بالـ ID لان discord.js ما يعرض الا اللي بالكاش (وبدون GuildMembers intent ممكن ينقصون)
async function voiceMembers(msg) {
  const vc = msg.member.voice.channel;
  if (!vc) return null;
  const ids = msg.guild.voiceStates.cache.filter(v => v.channelId === vc.id).map(v => v.id);
  const list = await Promise.all(ids.map(id => msg.guild.members.fetch(id).catch(() => null)));
  return list.filter(m => m && !m.user.bot);
}

// يدور العجلة (GIF يتحرك) ويرجع اللاعب المختار
async function spin(ch, players, title) {
  const names = players.map(nm), idx = rand(0, players.length - 1);
  let m, wait = 2500;
  try {
    const { file, ms } = await wheelSpinGif(names, idx);
    m = await ch.send({ content: `🎡 ${title}`, files: [file] });
    wait = ms + 800; // مدة الحركة + وقت يوصل ويشتغل عند الناس
  } catch (e) { // لو صار خطأ بالـ GIF نرجع للصورة الثابتة عشان اللعبة ما توقف
    console.error('GIF العجلة فشل:', e);
    m = await ch.send({ content: `🎡 ${title}`, files: [wheelImage(names)] });
  }
  await sleep(wait);
  await m.edit({ content: `🎯 طلع: ${players[idx]}`, files: [wheelImage(names, idx)], attachments: [] }).catch(() => {});
  await sleep(1200);
  return players[idx];
}

async function chooseTarget(ch, state, chooser, cands, verb) {
  const rows = [];
  for (let i = 0; i < cands.length; i += 5)
    rows.push(row(...cands.slice(i, i + 5).map((u, k) => btn('t' + (i + k), nm(u).slice(0, 20), ButtonStyle.Danger))));
  const m = await ch.send({ content: `${chooser} اختر من تبي ${verb} (20 ثانية)`, components: rows });
  const i = await waitClick(m, state, chooser.id, 20000);
  if (!i) { await m.edit({ components: [] }).catch(() => {}); return { t: pick(cands), auto: true }; }
  await i.update({ components: [] }).catch(() => {});
  return { t: cands[+i.customId.slice(1)], auto: false };
}

const kicked = async (ch, state, alive, out, text) => {
  (state.dead ??= []).push(out);
  await ch.send({ content: text, files: [playersImage(`الباقين: ${alive.length}`, alive, state.dead, { glass: false })] });
};

// ---- روليت: العجلة تختار لاعب، وهو يطرد واحد. لما يبقون اثنين العجلة تختار الفائز
async function roulette(msg, state, name) {
  let alive = await lobby(msg, state, name, { min: 3, desc: 'العجلة تختار لاعب وهو يطرد واحد، لما يبقى اثنين العجلة تختار الفائز 🏆', classic: true });
  if (!alive) return;
  const ch = msg.channel;
  while (alive.length > 2 && !state.stopped) {
    const chosen = await spin(ch, alive, 'العجلة تدور...');
    const { t, auto } = await chooseTarget(ch, state, chosen, alive.filter(u => u.id !== chosen.id), 'تطرده');
    if (state.stopped) return;
    alive = alive.filter(u => u.id !== t.id);
    await kicked(ch, state, alive, t, `${auto ? '⏰ تأخر، اخترنا عشوائي — ' : ''}💥 ${chosen} طرد ${t}`);
    await sleep(1000);
  }
  if (state.stopped) return;
  await finish(ch, name, await spin(ch, alive, 'الجولة الاخيرة، العجلة تختار الفائز!'), { classic: true });
}

// ---- روليت فويس: العجلة تطرد من الروم الصوتي
async function rouletteVoice(msg, state, name) {
  let alive = await voiceMembers(msg);
  if (!alive) return msg.reply('🔊 ادخل روم صوتي اول');
  if (alive.length < 3) return msg.reply('لازم 3 اشخاص على الاقل بالروم الصوتي');
  const ch = msg.channel;
  while (alive.length > 1 && !state.stopped) {
    const out = await spin(ch, alive, 'روليت فويس يدور...');
    alive = alive.filter(u => u.id !== out.id);
    await out.voice.disconnect('روليت فويس').catch(() => {});
    await kicked(ch, state, alive, out, `🚪 انطرد من الروم: ${out}`);
    await sleep(1000);
  }
  if (!state.stopped) await finish(ch, name, alive[0], { classic: true });
}

// ---- روليت تيم: فريقين، العجلة تطرد لاعب كل جولة، اخر فريق ببقى يفوز
async function rouletteTeam(msg, state, name) {
  const players = await lobby(msg, state, name, { min: 4, desc: 'نقسمكم فريقين، العجلة تطرد لاعب كل جولة، والفريق اللي يبقى منه احد يفوز 👥', classic: true });
  if (!players) return;
  const ch = msg.channel;
  const sh = [...players].sort(() => Math.random() - 0.5), half = Math.ceil(sh.length / 2);
  const teams = [{ title: '🔴 الاحمر', color: '#c0392b', m: sh.slice(0, half) }, { title: '🔵 الازرق', color: '#2980b9', m: sh.slice(half) }];
  await ch.send({ content: '👥 الفرق:', files: [columnsImage('الفرق', teams.map(t => ({ title: t.title, color: t.color, items: t.m })))] });
  await sleep(2500);
  const dead = [];
  while (teams[0].m.length && teams[1].m.length && !state.stopped) {
    const all = [...teams[0].m, ...teams[1].m];
    const out = await spin(ch, all, 'العجلة تدور...');
    teams.forEach(t => (t.m = t.m.filter(u => u.id !== out.id)));
    dead.push(out);
    await ch.send({ content: `💥 طلع ${out}`, files: [columnsImage('الباقين', teams.map(t => ({ title: `${t.title} (${t.m.length})`, color: t.color, items: t.m })))] });
    await sleep(1000);
  }
  if (state.stopped) return;
  const win = teams[0].m.length ? teams[0] : teams[1];
  const pts = 5 * db.mult();
  win.m.forEach(u => db.addPoints(u.id, pts, name));
  await ch.send({ content: `🏆 فاز الفريق ${win.title}: ${win.m.join(' ')}\n+${pts} نقطة لكل واحد`, files: [classicCard('🏆 الفريق الفائز', win.title, { size: 60 })] });
}

// ---- روليت عكس: العجلة تنجّي لاعب كل جولة، واخر واحد يبقى هو الخاسر
async function rouletteReverse(msg, state, name, voice = false) {
  let pool;
  if (voice) {
    pool = await voiceMembers(msg);
    if (!pool) return msg.reply('🔊 ادخل روم صوتي اول');
    if (pool.length < 3) return msg.reply('لازم 3 اشخاص على الاقل بالروم الصوتي');
  } else {
    pool = await lobby(msg, state, name, { min: 3, desc: 'العجلة تنجّي لاعب كل جولة، واخر واحد يبقى هو الخاسر 😈', classic: true });
    if (!pool) return;
  }
  const ch = msg.channel, safe = [];
  while (pool.length > 1 && !state.stopped) {
    const s = await spin(ch, pool, 'مين ينجو؟');
    pool = pool.filter(u => u.id !== s.id); safe.push(s);
    await ch.send({ content: `✅ نجا ${s}`, files: [playersImage(`المتبقين: ${pool.length}`, pool, [], { glass: false })] });
    await sleep(800);
  }
  if (state.stopped) return;
  const loser = pool[0];
  if (voice) await loser.voice.disconnect('روليت عكس فويس').catch(() => {});
  await ch.send({ content: `💀 الخاسر: ${loser}${voice ? ' (انطرد من الروم)' : ''}`, files: [classicCard('💀 الخاسر', nm(loser), { size: 60 })] });
  await finish(ch, name, safe[0], { classic: true }); // اول واحد نجا ياخذ النقاط
}

// ---- روليت سلسلة: العجلة تختار لاعب، يكتب كلمة تبدأ بآخر حرف من الكلمة السابقة
const START = [...'ابتجحدرسشعفقكلمنهوي'];
async function rouletteChain(msg, state, name) {
  let alive = await lobby(msg, state, name, { min: 2, desc: 'العجلة تختار لاعب ويكتب كلمة تبدأ بآخر حرف من الكلمة السابقة خلال 12 ثانية، غلطان يطلع 🔗', classic: true });
  if (!alive) return;
  const ch = msg.channel, used = new Set();
  let letter = pick(START), last = '—';
  while (alive.length > 1 && !state.stopped) {
    const p = await spin(ch, alive, 'العجلة تدور...');
    await ch.send({ content: `${p} اكتب كلمة تبدأ بحرف **${letter}** (12 ثانية)`, files: [classicCard('🔗 السلسلة', `الحرف: ${letter}\nالكلمة السابقة: ${last}`, { size: 64 })] });
    const ok = await new Promise(res => {
      const c = state.track(ch.createMessageCollector({
        time: 12000, max: 1,
        filter: m => m.author.id === p.id && norm(m.content).length >= 3 && norm(m.content)[0] === norm(letter)[0] && !used.has(norm(m.content)),
      }));
      c.on('end', col => res(col.first() ?? null));
    });
    if (state.stopped) return;
    if (ok) {
      const w = norm(ok.content); used.add(w); last = ok.content.trim();
      let k = w.length - 1; while (k > 0 && 'ءىئؤ'.includes(w[k])) k--;
      letter = w[k]; await ok.react('✅').catch(() => {});
    } else {
      alive = alive.filter(u => u.id !== p.id);
      await kicked(ch, state, alive, p, `💥 ${p} غلط او تأخر وطلع!`);
    }
  }
  if (!state.stopped) await finish(ch, name, alive[0], { classic: true });
}

module.exports = {
  'روليت': roulette, 'روليت فويس': rouletteVoice, 'روليت تيم': rouletteTeam,
  'روليت عكس': (m, s, n) => rouletteReverse(m, s, n, false),
  'روليت عكس فويس': (m, s, n) => rouletteReverse(m, s, n, true),
  'روليت سلسلة': rouletteChain,
};
