const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const bg = require('./bg');
const quiz = require('./quiz');
const group = require('./group');
const { active } = require('./state');
const { profileCard, serverCard, winRank } = require('./util');
const { gameBanner } = require('./img');
const { isAdmin } = require('./perms');

const reg = new Map();
const add = (names, run, game = false) => [].concat(names).forEach(n => reg.set(n, { run, game }));
// كل كلمة تنكتب بـ ة او ه (رتبة/رتبه) فنسجل كل التركيبات
const names = (...list) => [...new Set(list.flatMap(n => n.split(' ').reduce(
  (acc, w) => acc.flatMap(a => [...new Set([w, w.replace(/ة/g, 'ه')])].map(v => (a ? a + ' ' + v : v))), [''])))];
const roundsOf = args => { const n = parseInt(args.find(a => /^\d{1,2}$/.test(a))); return n >= 1 ? Math.min(n, 10) : 1; };
const num = args => { const a = args.find(x => /^-?\d{1,12}$/.test(x)); return a === undefined ? NaN : parseInt(a); };
async function target(msg, args) {
  const m = msg.mentions.users.first();
  if (m) return m;
  const id = args.find(a => /^\d{17,20}$/.test(a));
  return id ? msg.client.users.fetch(id).catch(() => null) : null;
}

/* الألعاب */
// الفردية: سؤال واحد، واذا كتبت رقم بعد الاسم (مثل: عواصم 5) تصير جولات
for (const [n, def] of Object.entries(quiz.games)) {
  add(n, (msg, args) => quiz.run(msg, n, def, n, roundsOf(args)), true);
}
add('كت', quiz.kat); // يستبدل كت اللي فوق: `كت` عشوائي او `كت سؤالك`
for (const [n, fn] of Object.entries(group.games)) {
  if (n === 'مافيا' || n.startsWith('روليت')) continue;
  add(n, msg => group.play(msg, n, fn), true);
}

/* قائمة الالعاب */
add(['العاب', 'اوامر'], msg => {
  const g = Object.keys(group.games), q = Object.keys(quiz.games);
  return msg.reply({ embeds: [new EmbedBuilder().setColor(0x26b6a8).setAuthor({ name: 'dev.splosh' })
    .setTitle('🎮 اوامر الالعاب').setFooter({ text: 'dev.splosh • ألعاب وتحديات' })
    .addFields(
      { name: 'الالعاب الجماعية', value: g.join(' , ') },
      { name: 'الالعاب الفردية', value: q.join(' , ') },
      { name: 'اوامر البوت', value: 'بروفايل , نقاط , تحويل , توب [اسم اللعبة] , ايفينت , كت [سؤالك]' },
      { name: 'ايقاف اللعبة', value: 'ايقاف (للادارة وأصحاب رتبة الالعاب الجماعية فقط)' },
      { name: 'اوامر الادارة', value: 'reset , set , give , restart , رتبة الجماعية , صورة الالعاب' })] });
});

/* اوامر البوت */
/* هوية البوت */
add(['حقوق', 'حقوق البوت'], msg => msg.reply({
  embeds: [new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('dev.splosh')
    .setDescription('ألعاب وبطاقات dev.splosh.')
    .setFooter({ text: 'dev.splosh • Game System' })]
}));

add('بروفايل', async (msg, args) => {
  const user = (await target(msg, args)) || msg.author;
  const u = db.user(user.id);
  const rank = winRank(db.all(), user.id);
  const file = await profileCard(user, u, rank);
  return msg.reply({ files: [file] });
});

add(['سيرفر', 'معلومات السيرفر'], async msg => {
  // الجماعية + الفردية + خمن العلم
  const file = await serverCard(msg.guild, Object.keys(group.games).length + Object.keys(quiz.games).length + 1);
  return msg.reply({ files: [file] });
});

add('نقاط', async (msg, args) => {
  const user = (await target(msg, args)) || msg.author;
  const label = user.id === msg.author.id ? 'رصيدك' : `رصيد ${user.username}`;
  return msg.reply(`💰 ${label}: **${db.user(user.id).points}** نقطة`);
});

add('تحويل', async (msg, args) => {
  const to = await target(msg, args), n = num(args);
  if (!to || to.bot || to.id === msg.author.id) return msg.reply('الاستخدام: `تحويل @شخص 100`');
  if (!(n > 0)) return msg.reply('اكتب مبلغ صحيح');
  if (db.user(msg.author.id).points < n) return msg.reply('❌ رصيدك ما يكفي');
  db.addPoints(msg.author.id, -n); db.addPoints(to.id, n);
  return msg.reply(`✅ حولت **${n}** نقطة الى ${to}`);
});

add('ايقاف', msg => {
  const s = active.get(msg.channel.id);
  if (!s) return msg.reply('ما فيه لعبة شغالة');
  if (!group.canStop(msg)) {
    const roles = group.allowedRoles(msg.guild);
    return msg.reply({
      content: roles.length
        ? `❌ ايقاف اللعبة للادارة او لأصحاب رتبة: ${roles.map(id => `<@&${id}>`).join(' ')}`
        : '❌ ايقاف اللعبة للادارة فقط',
      allowedMentions: { parse: [], repliedUser: false },
    });
  }
  s.stop();
  return msg.channel.send('🛑 تم ايقاف اللعبة');
});

add('توب', (msg, args) => {
  const game = args.join(' ');
  const byGame = game && reg.get(game)?.game;
  const rows = Object.entries(db.all())
    .map(([id, u]) => [id, byGame ? u.wins[game] || 0 : u.points])
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!rows.length) return msg.reply('ما فيه بيانات بعد');
  const medals = ['🥇', '🥈', '🥉'];
  return msg.reply({ embeds: [new EmbedBuilder().setColor(0x26b6a8).setAuthor({ name: 'dev.splosh' })
    .setTitle(byGame ? `🏆 توب ${game}` : '🏆 توب النقاط').setFooter({ text: 'dev.splosh • لوحة المتصدرين' })
    .setDescription(rows.map(([id, v], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> — ${v}`).join('\n'))] });
});

add('ايفينت', (msg, args) => {
  const a = args[0];
  if (a === 'on' || a === 'off') {
    if (!isAdmin(msg)) return msg.reply('للادارة فقط');
    db.setEvent(a === 'on');
  }
  return msg.reply(db.eventOn() ? '🔥 **ايفينت النقاط المضاعفة شغال!** كل النقاط ×2' : '💤 ما فيه ايفينت حاليا');
});

/* اوامر الادارة */
const adminOnly = fn => (msg, args) => isAdmin(msg) ? fn(msg, args) : msg.reply('❌ هذا الامر للادارة فقط');

add('reset', adminOnly(async (msg, args) => {
  if (args[0] === 'all') { db.reset(); return msg.reply('🗑️ تم تصفير كل النقاط'); }
  const u = await target(msg, args);
  if (!u) return msg.reply('الاستخدام: `reset @شخص` او `reset all`');
  db.resetUser(u.id); return msg.reply(`🗑️ تم تصفير ${u}`);
}));
add('set', adminOnly(async (msg, args) => {
  const u = await target(msg, args), n = num(args);
  if (!u || isNaN(n)) return msg.reply('الاستخدام: `set @شخص 500`');
  db.setPoints(u.id, n); return msg.reply(`✅ نقاط ${u} الان **${n}**`);
}));
add('give', adminOnly(async (msg, args) => {
  const u = await target(msg, args), n = num(args);
  if (!u || isNaN(n)) return msg.reply('الاستخدام: `give @شخص 100`');
  db.addPoints(u.id, n); return msg.reply(`✅ تمت اضافة **${n}** نقطة الى ${u}`);
}));
add('restart', adminOnly(async msg => {
  for (const s of active.values()) s.stop();
  await msg.reply('🔄 جاري اعادة التشغيل...');
  setTimeout(() => process.exit(0), 800); // شغله عبر pm2 او nodemon عشان يرجع تلقائي
}));

/* رتبة الالعاب الجماعية: اذا انحطت رتبة، بس اصحابها (والادارة) يقدرون يشغلون الالعاب الجماعية */
function findRole(msg, args) {
  const m = msg.mentions.roles.first();
  if (m) return m;
  const id = args.find(a => /^\d{17,20}$/.test(a));
  if (id) return msg.guild.roles.cache.get(id) ?? null;
  const name = args.join(' ').trim().toLowerCase();
  return name ? msg.guild.roles.cache.find(r => r.name.toLowerCase() === name) ?? null : null;
}
add(names('رتبة الجماعية', 'رتبة الالعاب الجماعية', 'رتبة الالعاب', 'رتبة جماعية'), async (msg, args) => {
  const quiet = { allowedMentions: { parse: [], repliedUser: false } };
  const gid = msg.guild.id, roles = group.allowedRoles(msg.guild);
  if (!args.length) {
    return msg.reply({ content: roles.length
      ? `🎖️ رتب الالعاب الجماعية: ${roles.map(id => `<@&${id}>`).join(' ')}\nالباقي ما يقدرون يشغلون العاب جماعية.`
      : 'ما فيه رتبة محددة، الكل يقدر يشغل الالعاب الجماعية.\nلتحديد رتبة: `رتبة الجماعية @الرتبة`', ...quiet });
  }
  if (!isAdmin(msg)) return msg.reply('❌ هذا الامر للادارة فقط');
  const sub = args[0];
  if (['الغاء', 'تعطيل', 'الكل', 'off'].includes(sub)) {
    db.clearGroupRoles(gid);
    return msg.reply('✅ تم الغاء الرتبة، الكل يقدر يشغل الالعاب الجماعية');
  }
  const remove = ['حذف', 'ازالة', 'مسح', 'remove'].includes(sub);
  const role = findRole(msg, ['اضافة', 'اضف', 'add'].includes(sub) || remove ? args.slice(1) : args);
  if (!role || role.id === gid) return msg.reply('اكتب منشن الرتبة او اسمها او ايديها. مثال: `رتبة الجماعية @المضيفين`');
  if (remove) {
    db.removeGroupRole(gid, role.id);
    return msg.reply({ content: `✅ انحذفت ${role} من رتب الالعاب الجماعية`, ...quiet });
  }
  db.addGroupRole(gid, role.id);
  return msg.reply({ content: `✅ صارت ${role} هي رتبة الالعاب الجماعية، بس اصحابها والادارة يشغلونها`, ...quiet });
});

/* الصورة الافتراضية لكل الالعاب */
add(names('صورة الالعاب', 'خلفية الالعاب', 'صورة افتراضية'), adminOnly(async (msg, args) => {
  if (['حذف', 'مسح', 'افتراضي', 'reset'].includes(args[0])) {
    bg.clear();
    return msg.reply('🗑️ رجعنا للتصميم الافتراضي (بدون صورة مخصصة)');
  }
  // الصورة: مرفق بنفس الرسالة، او مرفق برسالة ترد عليها، او رابط
  let url = msg.attachments.find(a => a.contentType?.startsWith('image/'))?.url;
  if (!url && msg.reference?.messageId) {
    const ref = await msg.fetchReference().catch(() => null);
    url = ref?.attachments.find(a => a.contentType?.startsWith('image/'))?.url;
  }
  url ||= args.find(a => /^https?:\/\//i.test(a));
  if (!url) {
    return msg.reply(bg.has()
      ? { content: 'هذي الصورة الحالية. لتغييرها ارفق صورة مع الامر `صورة الالعاب`، ولحذفها `صورة الالعاب حذف`', files: [bg.FILE] }
      : 'ما فيه صورة مخصصة حالياً. ارفق صورة مع الامر `صورة الالعاب` (او رد على رسالة فيها صورة، او حط رابط)');
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return msg.reply('❌ الصورة كبيرة، خلها اقل من 15MB');
    await bg.set(buf);
  } catch (e) {
    console.warn('تغيير الصورة الافتراضية فشل:', e.message);
    return msg.reply('❌ ما قدرت اقرا الصورة، تأكد انها png او jpg او webp');
  }
  return msg.reply({ content: '✅ تم تغيير الصورة الافتراضية لكل الالعاب', files: [gameBanner('معاينة', 'هذي الصورة الافتراضية للالعاب')] });
}));

module.exports = { reg };
