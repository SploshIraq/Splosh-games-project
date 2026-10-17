const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../data.json'); // نفس مجلد المشروع مهما كان مكان التشغيل
let data = { users: {}, event: { double: false } };
try { data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
if (!data.users || typeof data.users !== 'object' || Array.isArray(data.users)) data.users = {};
if (!data.event || typeof data.event !== 'object') data.event = { double: false };
data.event.double = data.event.double === true;
// رتب الالعاب الجماعية لكل سيرفر: { guildId: [roleId, ...] }
if (!data.groupRoles || typeof data.groupRoles !== 'object' || Array.isArray(data.groupRoles)) data.groupRoles = {};

let t, dirty = false;
const flush = () => {
  if (!dirty) return;
  dirty = false;
  try {
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (e) { dirty = true; console.error('ما قدرت احفظ data.json:', e.message); }
};
const save = () => { dirty = true; clearTimeout(t); t = setTimeout(flush, 500); };
// نحفظ اخر تغييرات قبل ما البوت يطفي (Ctrl+C او pm2 stop او restart)
process.on('exit', flush);
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => process.exit(0)));
const user = id => {
  if (!data.users[id] || typeof data.users[id] !== 'object') data.users[id] = { points: 0, wins: {} };
  data.users[id].points = Number.isFinite(Number(data.users[id].points)) ? Math.max(0, Math.floor(Number(data.users[id].points))) : 0;
  if (!data.users[id].wins || typeof data.users[id].wins !== 'object') data.users[id].wins = {};
  return data.users[id];
};

module.exports = {
  user,
  all: () => data.users,
  mult: () => (data.event.double ? 2 : 1),
  eventOn: () => data.event.double,
  setEvent(v) { data.event.double = v; save(); },
  addPoints(id, n, game) {
    const amount = Number(n);
    if (!Number.isFinite(amount)) return;
    const u = user(id); u.points = Math.max(0, Math.floor(u.points + amount));
    if (game) u.wins[game] = (u.wins[game] || 0) + 1;
    save();
  },
  setPoints(id, n) { user(id).points = Math.max(0, n); save(); },
  resetUser(id) { delete data.users[id]; save(); },
  groupRoles: gid => (Array.isArray(data.groupRoles[gid]) ? [...data.groupRoles[gid]] : []),
  addGroupRole(gid, rid) {
    const l = Array.isArray(data.groupRoles[gid]) ? data.groupRoles[gid] : [];
    if (!l.includes(rid)) l.push(rid);
    data.groupRoles[gid] = l; save();
  },
  removeGroupRole(gid, rid) {
    const l = (data.groupRoles[gid] || []).filter(r => r !== rid);
    if (l.length) data.groupRoles[gid] = l; else delete data.groupRoles[gid];
    save();
  },
  clearGroupRoles(gid) { delete data.groupRoles[gid]; save(); },
  reset() { data.users = {}; save(); },
};
