'use strict';

const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { gameBanner } = require('./community-games/src/img');

const MINI_GAME_CHOICES = [
  { name: 'النقر السريع', value: 'fast_click' },
  { name: 'فصل الكلمات', value: 'text_split' },
  { name: 'دمج الكلمات', value: 'text_merge' },
  { name: 'اعكس النص', value: 'text_reverse' },
  { name: 'اعثر على الحرف', value: 'find_letter' },
  { name: 'أكمل الحرف الناقص', value: 'correct_letter' },
  { name: 'رتب الأرقام', value: 'sort_numbers' },
  { name: 'خمن اللون', value: 'guess_colors' },
  { name: 'اعثر على الإيموجي المختلف', value: 'emoji' },
  { name: 'اكشف النص', value: 'text_reveal' },
];

const gamesByKey = new Map(MINI_GAME_CHOICES.map(({ value }) => [value, value]));
const sessionsByChannel = new Map();
const GAME_DURATION_MS = 60_000;
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
};
const WORD_BANK = [
  'مدرسة', 'حديقة', 'سيارة', 'مكتبة', 'طائرة', 'حاسوب', 'نافذة', 'زهرة',
  'مطرقة', 'برتقالة', 'مستشفى', 'مغامرة', 'سلحفاة', 'فراشة', 'منطاد',
  'قمر', 'نجمة', 'بحر', 'شجرة', 'مفتاح', 'صندوق', 'سفينة', 'مصباح',
  'هاتف', 'شارع', 'مدينة', 'قرية', 'مروحة', 'قلم', 'دفتر', 'مطبخ',
  'قطار', 'سحابة', 'عصفور', 'غزالة', 'أسد', 'نحلة', 'بستان', 'طبيب',
  'ممرضة', 'معلم', 'جامعة', 'كرة', 'ملعب', 'جسر', 'جزيرة', 'رمان',
  'تفاحة', 'موزة', 'ليمون', 'كتاب', 'ساعة', 'لوحة', 'نافورة', 'خيمة',
  'مظلة', 'وسادة', 'مرآة', 'مغناطيس', 'سجادة', 'مسبح', 'غيمة', 'شمس',
  'قصة', 'رسالة', 'رحلة', 'موسيقى', 'ابتسامة', 'صداقة', 'نجاح', 'شجاعة',
];
const LETTER_PHRASES = [
  'ذهب سامر إلى المدرسة صباحاً',
  'تطير الفراشة فوق أزهار الحديقة',
  'يقرأ الطفل قصة قبل النوم',
  'عاد المسافر إلى بيته فرحاً',
  'تشرق الشمس كل صباح من جديد',
  'يلعب الفريق في الملعب الكبير',
  'تسبح السمكة قرب الشعاب المرجانية',
  'زرعت أمي وردة حمراء في الحديقة',
  'يسافر القطار بين المدن بسرعة',
  'يحب الناس شرب الماء النظيف',
  'صنع النجار باباً جميلاً من الخشب',
  'وقف العصفور فوق غصن الشجرة',
  'يحمل الطالب كتبه إلى الصف',
  'تضيء النجوم سماء الليل الهادئة',
  'تسقط أوراق الشجر في فصل الخريف',
  'وصل الطبيب إلى المستشفى مبكراً',
  'ركب الطفل دراجته في الحديقة',
  'يكتب الكاتب رواية عن المغامرة',
];
const COLOR_OPTIONS = [
  { emoji: '🟥', answer: 'أحمر', alternatives: ['احمر', 'الاحمر'] },
  { emoji: '🟦', answer: 'أزرق', alternatives: ['ازرق', 'الازرق'] },
  { emoji: '🟩', answer: 'أخضر', alternatives: ['اخضر', 'الاخضر'] },
  { emoji: '🟨', answer: 'أصفر', alternatives: ['اصفر', 'الاصفر'] },
  { emoji: '🟪', answer: 'بنفسجي', alternatives: ['البنفسجي', 'موف'] },
  { emoji: '🟧', answer: 'برتقالي', alternatives: ['البرتقالي'] },
  { emoji: '⬛', answer: 'أسود', alternatives: ['اسود', 'الاسود'] },
  { emoji: '⬜', answer: 'أبيض', alternatives: ['ابيض', 'الابيض'] },
];
const REVEAL_WORDS = [
  ...WORD_BANK,
  'أمل', 'سماء', 'مطر', 'جبل', 'نهر', 'طريق', 'قلب', 'فكرة', 'كنز',
  'كتاب', 'شباك', 'تفكير', 'عائلة', 'مستقبل', 'حكاية', 'مطار', 'محيط',
];
const ODD_EMOJI_PAIRS = [
  ['🍋', '🍊'], ['🐱', '🐶'], ['🌙', '⭐'], ['🚗', '🚌'],
  ['🍎', '🍓'], ['🐟', '🐬'], ['⚽', '🏀'], ['🌹', '🌻'],
];

function isStaleDiscordError(error) {
  return ['10008', '10062', '40060'].includes(String(error?.code));
}

function logUnexpectedError(context, error) {
  if (isStaleDiscordError(error)) return;
  console.error(`[fizbo-mini-games] ${context}`, error);
}

function safeMentions() {
  return { parse: [] };
}

function makeEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'dev.splosh' })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'dev.splosh • أول إجابة صحيحة تفوز • لديك 60 ثانية' });
}

function normalizeAnswer(value) {
  return String(value)
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

function createTextChallenge(gameKey) {
  switch (gameKey) {
    case 'text_split': {
      const words = [];
      while (words.length < 3) {
        const word = pickRandom(WORD_BANK);
        if (!words.includes(word)) words.push(word);
      }
      return {
        title: 'فصل الكلمات',
        prompt: 'افصل الكلمات بوضع مسافة واحدة بينها:',
        display: `\`${words.join('')}\``,
        answer: words.join(' '),
      };
    }
    case 'text_merge': {
      const words = [];
      while (words.length < 3) {
        const word = pickRandom(WORD_BANK);
        if (!words.includes(word)) words.push(word);
      }
      return {
        title: 'دمج الكلمات',
        prompt: 'اكتب الكلمات متصلة من دون مسافات:',
        display: words.map((word) => `\`${word}\``).join(' + '),
        answer: words.join(''),
      };
    }
    case 'text_reverse': {
      const answer = pickRandom(WORD_BANK);
      return {
        title: 'اعكس النص',
        prompt: 'اكتب الكلمة الأصلية بعد عكس ترتيب حروفها:',
        display: `\`${Array.from(answer).reverse().join('')}\``,
        answer,
      };
    }
    case 'find_letter': {
      const phrase = pickRandom(LETTER_PHRASES);
      const letters = Array.from(phrase).filter((character) => /\p{L}/u.test(character));
      const letter = pickRandom(letters);
      const count = letters.filter((character) => character === letter).length;
      return {
        title: 'اعثر على الحرف',
        prompt: `كم مرة يظهر الحرف **${letter}**؟ اكتب العدد فقط:`,
        display: `\`${phrase}\``,
        answer: String(count),
      };
    }
    case 'correct_letter': {
      const answer = pickRandom(WORD_BANK.filter((word) => Array.from(word).length > 3));
      const letters = Array.from(answer);
      const missingIndex = 1 + Math.floor(Math.random() * (letters.length - 2));
      const display = [...letters.slice(0, missingIndex), '_', ...letters.slice(missingIndex + 1)].join('');
      return {
        title: 'أكمل الحرف الناقص',
        prompt: 'اكتب الكلمة كاملة بعد إكمال الحرف الناقص:',
        display: `\`${display}\``,
        answer,
      };
    }
    case 'sort_numbers': {
      const numbers = new Set();
      while (numbers.size < 5) numbers.add(1 + Math.floor(Math.random() * 99));
      const sorted = [...numbers].sort((left, right) => left - right);
      return {
        title: 'رتب الأرقام',
        prompt: 'اكتب الأرقام بترتيب تصاعدي، وافصل بينها بمسافات:',
        display: `\`${shuffle(sorted).join('، ')}\``,
        answer: sorted.join(' '),
        normalize: (value) => normalizeAnswer(value).replace(/[,،;؛]+/g, ' ').replace(/\s+/g, ' ').trim(),
      };
    }
    case 'guess_colors': {
      const color = pickRandom(COLOR_OPTIONS);
      const squares = Array.from({ length: 4 }, () => color.emoji);
      const targetIndex = Math.floor(Math.random() * squares.length);
      const differentColor = pickRandom(COLOR_OPTIONS.filter((option) => option !== color));
      squares[targetIndex] = differentColor.emoji;
      return {
        title: 'خمن اللون',
        prompt: 'ما لون المربع المختلف؟ اكتب اسم اللون:',
        display: squares.join(' '),
        answer: differentColor.answer,
        alternatives: differentColor.alternatives,
      };
    }
    case 'text_reveal': {
      const answer = pickRandom(REVEAL_WORDS);
      return {
        title: 'اكشف النص',
        prompt: 'خمن الكلمة المخفية. ستظهر حروف إضافية كل بضع ثوانٍ:',
        display: `${'□ '.repeat(Array.from(answer).length).trim()}`,
        answer,
        reveal: answer,
      };
    }
    default:
      return null;
  }
}

function makeSession(channelId, gameKey) {
  return {
    channelId,
    gameKey,
    token: randomUUID().replace(/-/g, '').slice(0, 16),
    phase: 'starting',
    message: null,
    timer: null,
    readyTimer: null,
    revealTimer: null,
    challenge: null,
  };
}

function clearSessionTimers(session) {
  clearTimeout(session.timer);
  clearTimeout(session.readyTimer);
  clearInterval(session.revealTimer);
  session.timer = null;
  session.readyTimer = null;
  session.revealTimer = null;
}

function removeSession(session) {
  clearSessionTimers(session);
  if (sessionsByChannel.get(session.channelId) === session) {
    sessionsByChannel.delete(session.channelId);
  }
  session.phase = 'finished';
}

function claimSession(session) {
  if (session.phase === 'finished' || session.phase === 'finishing'
      || sessionsByChannel.get(session.channelId) !== session) return false;
  session.phase = 'finishing';
  clearSessionTimers(session);
  sessionsByChannel.delete(session.channelId);
  return true;
}

function playerName(user, member) {
  return member?.displayName || user.globalName || user.username || 'لاعب';
}

function resultEmbed(session, description, color) {
  const title = session.challenge?.title || (session.gameKey === 'fast_click'
    ? 'النقر السريع'
    : 'اعثر على الإيموجي المختلف');
  const embed = makeEmbed(title, description, color).setFooter({ text: 'dev.splosh • انتهت الجولة' });
  if (session.banner) embed.setImage(`attachment://${session.banner.name}`);
  return embed;
}

function withSessionArtwork(session, payload) {
  if (!session.banner) return payload;
  for (const embed of payload.embeds || []) embed.setImage(`attachment://${session.banner.name}`);
  if (session.bannerAttachmentId) payload.attachments = [{ id: session.bannerAttachmentId }];
  else if (!session.message) payload.files = [session.banner];
  return payload;
}

async function finishTextSession(session, description, color) {
  if (!claimSession(session)) return;
  const message = session.message;
  if (message) {
    try {
      await message.edit({
        embeds: [resultEmbed(session, description, color)],
        components: [],
        allowedMentions: safeMentions(),
        ...(session.bannerAttachmentId ? { attachments: [{ id: session.bannerAttachmentId }] } : {}),
      });
    } catch (error) {
      logUnexpectedError('Could not edit the completed game message.', error);
    }
  }
  session.phase = 'finished';
}

function answerMatches(session, content) {
  const challenge = session.challenge;
  const normalize = challenge.normalize || normalizeAnswer;
  const submitted = normalize(content);
  return [challenge.answer, ...(challenge.alternatives || [])]
    .some((answer) => submitted === normalize(answer));
}

function buildTextMessage(challenge, session) {
  return withSessionArtwork(session, {
    embeds: [makeEmbed(challenge.title, `${challenge.prompt}\n\n${challenge.display}`)],
    allowedMentions: safeMentions(),
  });
}

function buildFastClickMessage(session, ready = false) {
  const button = new ButtonBuilder()
    .setCustomId(`fizmini:${session.channelId}:${session.token}:click`)
    .setLabel(ready ? 'اضغط الآن!' : 'استعد...')
    .setStyle(ready ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(!ready);
  return withSessionArtwork(session, {
    embeds: [makeEmbed(
      'النقر السريع',
      ready
        ? 'اضغط الزر بأسرع ما يمكن! أول لاعب يضغط يفوز.'
        : 'استعد... سيصبح الزر مفعّلاً بعد لحظة. لا تضغط مبكراً!',
    )],
    components: [new ActionRowBuilder().addComponents(button)],
    allowedMentions: safeMentions(),
  });
}

function buildEmojiMessage(session) {
  const [commonEmoji, differentEmoji] = pickRandom(ODD_EMOJI_PAIRS);
  const options = shuffle([commonEmoji, commonEmoji, commonEmoji, differentEmoji]);
  const targetIndex = options.indexOf(differentEmoji);
  session.challenge = {
    title: 'اعثر على الإيموجي المختلف',
    targetIndex,
  };
  const row = new ActionRowBuilder().addComponents(options.map((emoji, index) =>
    new ButtonBuilder()
      .setCustomId(`fizmini:${session.channelId}:${session.token}:${index}`)
      .setLabel(String(index + 1))
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Secondary),
  ));
  return withSessionArtwork(session, {
    embeds: [makeEmbed('اعثر على الإيموجي المختلف', 'اضغط الزر الذي يحمل الإيموجي المختلف.')],
    components: [row],
    allowedMentions: safeMentions(),
  });
}

async function handleMiniGameStart(interaction, gameKey) {
  if (!interaction?.guildId || !interaction.channelId || !interaction.channel) {
    if (interaction?.reply) {
      await interaction.reply({
        content: 'هذه الألعاب متاحة داخل قنوات الخادم فقط.',
        ephemeral: true,
        allowedMentions: safeMentions(),
      });
    }
    return true;
  }

  if (!gamesByKey.has(gameKey)) {
    if (interaction.reply) {
      await interaction.reply({
        content: 'نوع اللعبة غير معروف.',
        ephemeral: true,
        allowedMentions: safeMentions(),
      });
    }
    return true;
  }

  const existing = sessionsByChannel.get(interaction.channelId);
  if (existing && existing.phase !== 'finished') {
    await interaction.reply({
      content: `هناك لعبة مصغّرة جارية بالفعل في هذه القناة (${existing.challenge?.title || 'النقر السريع أو الإيموجي المختلف'}). انتظر حتى تنتهي قبل بدء لعبة أخرى.`,
      allowedMentions: safeMentions(),
    });
    return true;
  }

  const session = makeSession(interaction.channelId, gameKey);
  sessionsByChannel.set(session.channelId, session);

  session.challenge = gameKey === 'fast_click'
    ? { title: 'النقر السريع' }
    : gameKey === 'emoji'
      ? { title: 'اعثر على الإيموجي المختلف' }
      : createTextChallenge(gameKey);
  session.banner = gameBanner(
    session.challenge.title,
    session.challenge.prompt || 'اختبر سرعتك وتركيزك في تحدٍ قصير.',
  );

  let payload;
  if (gameKey === 'fast_click') {
    payload = buildFastClickMessage(session);
  } else if (gameKey === 'emoji') {
    payload = buildEmojiMessage(session);
  } else {
    payload = buildTextMessage(session.challenge, session);
  }

  try {
    await interaction.reply({ ...payload, fetchReply: true });
    session.message = await interaction.fetchReply();
    session.bannerAttachmentId = session.message.attachments.find(
      (attachment) => attachment.name === session.banner.name,
    )?.id;
    if (sessionsByChannel.get(session.channelId) !== session) {
      await session.message.edit({
        embeds: [resultEmbed(session, 'تم إيقاف الجولة بواسطة مشرف.', 0xed4245)],
        components: [],
        allowedMentions: safeMentions(),
        ...(session.bannerAttachmentId ? { attachments: [{ id: session.bannerAttachmentId }] } : {}),
      });
      return true;
    }
    session.phase = gameKey === 'fast_click' ? 'waiting' : 'active';
    session.timer = setTimeout(() => {
      const answer = session.challenge?.answer;
      const ending = answer
        ? `انتهى الوقت! الإجابة كانت: **${answer}**`
        : 'انتهى الوقت قبل أن يفوز أحد.';
      void finishTextSession(session, ending, 0x747f8d);
    }, GAME_DURATION_MS);

    if (gameKey === 'fast_click') {
      session.readyTimer = setTimeout(async () => {
        if (session.phase !== 'waiting' || sessionsByChannel.get(session.channelId) !== session) return;
        session.phase = 'ready';
        try {
          await session.message.edit(buildFastClickMessage(session, true));
        } catch (error) {
          logUnexpectedError('Could not enable the fast-click button.', error);
          removeSession(session);
        }
      }, 1_000 + Math.floor(Math.random() * 2_000));
    } else if (gameKey === 'text_reveal') {
      let shown = 0;
      session.revealTimer = setInterval(async () => {
        if (session.phase !== 'active' || sessionsByChannel.get(session.channelId) !== session) return;
        shown = Math.min(shown + 1, session.challenge.reveal.length);
        const masked = `${session.challenge.reveal.slice(0, shown)}${'□'.repeat(session.challenge.reveal.length - shown)}`;
        try {
          await session.message.edit(buildTextMessage({
            ...session.challenge,
            display: `\`${Array.from(masked).join(' ')}\``,
          }, session));
        } catch (error) {
          logUnexpectedError('Could not update the text-reveal clue.', error);
          removeSession(session);
          return;
        }
        if (shown >= session.challenge.reveal.length) {
          clearInterval(session.revealTimer);
          session.revealTimer = null;
        }
      }, 3_000);
    }
  } catch (error) {
    logUnexpectedError('Could not start the mini-game.', error);
    removeSession(session);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'تعذّر بدء اللعبة في هذه القناة. تحقق من صلاحية إرسال الرسائل.',
        ephemeral: true,
        allowedMentions: safeMentions(),
      }).catch((replyError) => {
        logUnexpectedError('Could not report the mini-game start failure.', replyError);
      });
    }
  }
  return true;
}

async function respondEphemeral(interaction, content) {
  const payload = { content, ephemeral: true, allowedMentions: safeMentions() };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch((error) => {
      logUnexpectedError('Could not send ephemeral game feedback.', error);
    });
  } else {
    await interaction.reply(payload).catch((error) => {
      logUnexpectedError('Could not send ephemeral game feedback.', error);
    });
  }
}

async function handleMiniGameComponent(interaction) {
  const customId = interaction?.customId;
  if (typeof customId !== 'string' || !customId.startsWith('fizmini:')) return false;

  const [, channelId, token, selection] = customId.split(':');
  const session = sessionsByChannel.get(channelId);
  if (!session || session.token !== token || session.phase === 'finished'
      || !session.message || interaction.message?.id !== session.message.id) {
    await respondEphemeral(interaction, 'انتهت هذه الجولة أو لم تعد نشطة.');
    return true;
  }

  if (session.gameKey === 'fast_click') {
    if (selection !== 'click') {
      await respondEphemeral(interaction, 'هذا الزر لا يخص هذه الجولة.');
      return true;
    }
    if (session.phase !== 'ready') {
      await respondEphemeral(interaction, 'انتظر حتى يتفعّل الزر قبل الضغط!');
      return true;
    }
    const winner = playerName(interaction.user, interaction.member);
    if (!claimSession(session)) {
      await respondEphemeral(interaction, 'انتهت هذه الجولة أو لم تعد نشطة.');
      return true;
    }
    try {
      await interaction.update({
        embeds: [resultEmbed(session, `🏆 فاز **${winner}**! كان الأسرع في الضغط.`, 0x57f287)],
        components: [],
        allowedMentions: safeMentions(),
      });
    } catch (error) {
      logUnexpectedError('Could not update the fast-click winner message.', error);
    } finally {
      session.phase = 'finished';
    }
    return true;
  }

  if (session.gameKey === 'emoji') {
    const index = Number(selection);
    if (!Number.isInteger(index) || index < 0 || index > 3) {
      await respondEphemeral(interaction, 'اختيار الزر غير صالح.');
      return true;
    }
    if (index !== session.challenge.targetIndex) {
      await respondEphemeral(interaction, 'ليس هذا الإيموجي المختلف — حاول مجدداً!');
      return true;
    }
    const winner = playerName(interaction.user, interaction.member);
    if (!claimSession(session)) {
      await respondEphemeral(interaction, 'انتهت هذه الجولة أو لم تعد نشطة.');
      return true;
    }
    try {
      await interaction.update({
        embeds: [resultEmbed(session, `🏆 أحسنت يا **${winner}**! وجدت الإيموجي المختلف أولاً.`, 0x57f287)],
        components: [],
        allowedMentions: safeMentions(),
      });
    } catch (error) {
      logUnexpectedError('Could not update the emoji-game winner message.', error);
    } finally {
      session.phase = 'finished';
    }
    return true;
  }

  await respondEphemeral(interaction, 'هذا الزر لا يخص لعبة أزرار نشطة.');
  return true;
}

async function handleMiniGameMessage(message) {
  if (!message?.channelId || message.author?.bot) return false;
  const session = sessionsByChannel.get(message.channelId);
  if (!session || session.phase !== 'active' || !session.challenge?.answer) return false;

  if (!answerMatches(session, message.content || '')) {
    await message.react('❌').catch((error) => {
      logUnexpectedError('Could not react to an incorrect answer.', error);
    });
    return true;
  }

  if (!claimSession(session)) return true;
  const winner = playerName(message.author, message.member);
  const answer = session.challenge.answer;
  const result = `🏆 أحسنت يا **${winner}**! إجابتك صحيحة: **${answer}**.`;
  const gameMessage = session.message;
  if (gameMessage) {
    try {
      await gameMessage.edit({
        embeds: [resultEmbed(session, result, 0x57f287)],
        components: [],
        allowedMentions: safeMentions(),
      });
    } catch (error) {
      logUnexpectedError('Could not update the text-game winner message.', error);
    }
  }
  session.phase = 'finished';
  return true;
}

function hasMiniGameInChannel(channelId) {
  return sessionsByChannel.has(channelId);
}

async function stopMiniGame(channelId) {
  const session = sessionsByChannel.get(channelId);
  if (!session) return false;
  await finishTextSession(session, 'تم إيقاف الجولة بواسطة مشرف.', 0xed4245);
  return true;
}

module.exports = {
  MINI_GAME_CHOICES,
  hasMiniGameInChannel,
  stopMiniGame,
  handleMiniGameStart,
  handleMiniGameComponent,
  handleMiniGameMessage,
};
