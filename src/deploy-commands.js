require('dotenv').config();

const { REST, Routes } = require('discord.js');
const commands = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  throw new Error('يرجى ضبط DISCORD_TOKEN و CLIENT_ID في ملف .env قبل تسجيل الأوامر.');
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

rest
  .put(route, { body: commands })
  .then(() => {
    console.log(`تم تسجيل ${commands.length} أمراً بنجاح.`);
  })
  .catch((error) => {
    console.error('تعذّر تسجيل أوامر البوت:', error);
    process.exitCode = 1;
  });
