const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('mafia')
    .setDescription('لعبة المافيا الجماعية')
    .addSubcommand((subcommand) =>
      subcommand.setName('start').setDescription('ابدأ اللعبة بعد انضمام 4 لاعبين على الأقل'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('اعرض حالة غرفة المافيا'),
    ),
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('اعرض نقاطك أو نقاط لاعب')
    .addUserOption((option) =>
      option.setName('player').setDescription('اللاعب (اختياري)').setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('اعرض أعلى اللاعبين بالنقاط'),
].map((command) => command.toJSON());

module.exports = commands;
