// تلميحات العاب التخمين (دوال بسيطة بدون اعتماد على discord عشان نقدر نجربها لحالها)
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const letters = s => [...String(s).replace(/\s+/g, '')];
const words = s => String(s).trim().split(/\s+/).filter(Boolean);

// 3 حروف، حرفين، 11 حرف ... بالعربي الصح
const ar = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);

// تلميح العدد: "من 5 حروف" و "كلمتين" اذا كانت اكثر من كلمة
function countHint(answer) {
  const n = letters(answer).length, w = words(answer).length;
  let t = ar(n, 'حرف واحد', 'حرفين', 'حروف', 'حرف');
  if (w > 1) t += ` • ${ar(w, '', 'كلمتين', 'كلمات', 'كلمة')}`;
  return `الجواب من ${t}`;
}

// قناع الكلمة: level 1 = اول حرف من كل كلمة، level 2 = اول وآخر حرف (اذا الكلمة 4 حروف او اكثر)
function mask(answer, level = 1) {
  return words(answer).map(w => {
    const l = [...w];
    return l.map((ch, i) => (i === 0 || (level >= 2 && l.length >= 4 && i === l.length - 1) ? ch : '_')).join(' ');
  }).join('   ');
}

// تلميحات الاجوبة النصية (اعلام، شعارات...). at = نسبة من وقت السؤال
// الاجوبة الارقام فقط ما ينعطى لها تلميح (ما له معنى)
function textHints(answer) {
  if (!answer || /^[\d\s]+$/.test(answer) || letters(answer).length < 3) return [];
  const hints = [
    { at: 0.35, text: `💡 **تلميح 1:** ${countHint(answer)}` },
    { at: 0.6, text: `💡 **تلميح 2:** \`${mask(answer, 1)}\`` },
  ];
  if (letters(answer).length >= 4) hints.push({ at: 0.8, text: `💡 **تلميح 3:** \`${mask(answer, 2)}\`` });
  return hints;
}

// مدى ضيق يحتوي الرقم السري (بداية عشوائية، ويبقى داخل lo..hi)
function span(secret, width, lo, hi) {
  const w = Math.min(width, hi - lo + 1);
  const a = Math.max(lo, Math.min(secret - rand(0, w - 1), hi - w + 1));
  return [a, a + w - 1];
}

// تلميحات تخمين الرقم: زوجي/فردي ثم مدى اضيق فاضيق
// widths = عرض كل مدى، times = وقت كل تلميح (اول واحد للزوجي/فردي)
function numberHints(secret, lo, hi, widths, times) {
  const out = [{ at: times[0], text: `💡 **تلميح 1:** الرقم ${secret % 2 === 0 ? 'زوجي' : 'فردي'}` }];
  widths.forEach((w, k) => {
    const [a, b] = span(secret, w, lo, hi);
    out.push({ at: times[k + 1], text: `💡 **تلميح ${k + 2}:** الرقم بين **${a}** و **${b}**` });
  });
  return out;
}

function numberGuessFeedback(guess, secret) {
  return Number(guess) < Number(secret)
    ? 'الرقم أكبر من تخمينك.'
    : 'الرقم أصغر من تخمينك.';
}

// يرسل التلميحات مع الوقت. يرجع دالة تلغي كل المؤقتات (نستدعيها لما ينتهي السؤال)
// isOver() ترجع true اذا السؤال انتهى (عشان ما نرسل تلميح بعد الفوز)
function schedule(send, hints, time, isOver) {
  const timers = (hints || []).map(h => setTimeout(() => { if (!isOver()) send(h.text); }, Math.round(time * h.at)));
  return () => timers.forEach(clearTimeout);
}

module.exports = { countHint, mask, textHints, span, numberHints, numberGuessFeedback, schedule };
