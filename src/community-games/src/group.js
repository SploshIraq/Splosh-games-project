const { start, end } = require('./state');
const { basic } = require('./core');
const { gameBanner } = require('./img');
const { isAdmin } = require('./perms');
const db = require('./db');

const games = {
  ...basic,
  ...require('./games/roulette'),
  ...require('./games/arcade'),
  ...require('./games/boards'),
  ...require('./games/social'),
};

// الرتب المسموح لها تشغل الالعاب الجماعية (اذا ما فيه رتب محفوظة او انحذفت من السيرفر = الكل يقدر)
const allowedRoles = guild => db.groupRoles(guild.id).filter(id => guild.roles.cache.has(id));
const hasRole = (msg, roles) => roles.some(id => msg.member?.roles.cache.has(id));
const canStart = msg => {
  const roles = allowedRoles(msg.guild);
  return !roles.length || isAdmin(msg) || hasRole(msg, roles);
};
// ايقاف اللعبة: الادارة او اصحاب رتبة الالعاب الجماعية فقط (اذا ما فيه رتبة محددة = الادارة بس)
const canStop = msg => isAdmin(msg) || hasRole(msg, allowedRoles(msg.guild));

async function play(msg, name, fn) {
  if (!canStart(msg)) {
    const list = allowedRoles(msg.guild).map(id => `<@&${id}>`).join(' ');
    return msg.reply({ content: `❌ تشغيل الالعاب الجماعية لأصحاب رتبة: ${list}`, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
  }
  const state = start(msg.channel, msg.author.id);
  try {
    await msg.channel.send({ content: `🎮 **${name}** — بدأت اللعبة`, files: [gameBanner(name, 'لعبة جديدة • حظاً موفقاً للجميع')] });
    await fn(msg, state, name);
  }
  catch (e) { console.error(e); msg.channel.send('⚠️ صار خطأ بالعبة').catch(() => {}); }
  finally { end(msg.channel, state); }
}

module.exports = { games, play, allowedRoles, canStop };
