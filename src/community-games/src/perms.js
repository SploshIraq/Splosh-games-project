const { PermissionFlagsBits } = require('discord.js');

const OWNERS = (process.env.OWNERS || '').split(',').map(s => s.trim()).filter(Boolean);
const isAdmin = msg => !!msg.member?.permissions.has(PermissionFlagsBits.Administrator) || OWNERS.includes(msg.author.id);

module.exports = { OWNERS, isAdmin };
