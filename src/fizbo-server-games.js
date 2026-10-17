'use strict';

const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { gameBanner } = require('./community-games/src/img');
const { flags: countryFlags } = require('./community-games/src/data');
const sharp = require('sharp');

const games = new Map();
const PREFIX = 'fizserver:';
const LOBBY_MS = 45_000;
const GUESS_MS = 60_000;
const IDLE_MS = 120_000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PLACE_NAMES = ['المكتبة', 'الحديقة', 'المتحف', 'السوق', 'القلعة'];
const MARKS = ['❌', '⭕'];
const GAME_BANNER_THEMES = {
  deathwheel: 'كنز',
  hotxo: 'اكس',
  guessthecountry: 'خمن الدولة',
  guessthedraw: 'خمن الرسمة',
  guesstheword: 'خمن الكلمة',
};

const GAME_CATALOG = [
  ['deathwheel', 'عجلة الموت — اختر صندوقك'],
  ['hotxo', 'إكس أو الساخنة — الخانة الأقدم تختفي'],
  ['guessthecountry', 'خمن الدولة — أماكن ومعالم'],
  ['guessthedraw', 'خمن الرسمة — تكشف تدريجياً'],
  ['guesstheword', 'خمن الكلمة — قرب المعنى'],
];

const COUNTRY_QUESTIONS = [
  {
    place: 'شوارع كيوتو التقليدية', country: 'اليابان', code: 'jp', aliases: ['Japan'], region: 'آسيا', neighbors: ['كوريا الجنوبية', 'الصين'],
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    hints: ['تشتهر هذه المنطقة بمعابدها الخشبية وأزقتها القديمة.', 'تقع في شرق آسيا وتتكوّن من آلاف الجزر.', 'من أشهر مدنها طوكيو وأوساكا.'],
  },
  {
    place: 'برج إيفل في باريس', country: 'فرنسا', code: 'fr', aliases: ['France'], region: 'أوروبا', neighbors: ['إيطاليا', 'إسبانيا', 'بلجيكا', 'ألمانيا', 'سويسرا', 'لوكسمبورغ', 'أندورا', 'موناكو'],
    image: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=1200&q=80',
    hints: ['يُعد هذا المعلم من أشهر الأبراج الحديدية في العالم.', 'يقع في عاصمة أوروبية على نهر السين.', 'المدينة معروفة أيضاً بمتحف اللوفر.'],
  },
  {
    place: 'أهرامات الجيزة', country: 'مصر', code: 'eg', aliases: ['Egypt'], region: 'أفريقيا', neighbors: ['السودان', 'ليبيا', 'إسرائيل', 'فلسطين'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/All_Gizah_Pyramids.jpg/960px-All_Gizah_Pyramids.jpg',
    imageCredit: '[Ricardo Liberato — CC BY-SA 2.0](https://commons.wikimedia.org/wiki/File:All_Gizah_Pyramids.jpg)',
    hints: ['يقع هذا الموقع الأثري قرب نهر النيل.', 'تضم المنطقة أهرامات وأبو الهول.', 'تقع في شمال شرق أفريقيا.'],
  },
  {
    place: 'تاج محل في أغرا', country: 'الهند', code: 'in', aliases: ['India'], region: 'آسيا', neighbors: ['باكستان', 'نيبال', 'بنغلاديش', 'الصين', 'بوتان', 'ميانمار'],
    image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    hints: ['هذا الصرح من أشهر مباني الرخام الأبيض في العالم.', 'يقع في مدينة أغرا قرب نهر يامونا.', 'تقع المدينة في جنوب آسيا.'],
  },
  {
    place: 'الكولوسيوم في روما', country: 'إيطاليا', code: 'it', aliases: ['ايطاليا', 'Italy'], region: 'أوروبا', neighbors: ['فرنسا', 'سويسرا', 'النمسا', 'سلوفينيا', 'سان مارينو'],
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    hints: ['هذا المدرج الأثري يعود إلى العصر الروماني.', 'يقع في مدينة أوروبية تُعرف بالمدينة الخالدة.', 'المدينة هي عاصمة دولة تشبه شبه جزيرة طويلة.'],
  },
  {
    place: 'آيا صوفيا في إسطنبول', country: 'تركيا', code: 'tr', aliases: ['Turkey', 'Türkiye'], region: 'آسيا وأوروبا', neighbors: ['اليونان', 'العراق', 'سوريا', 'جورجيا', 'أرمينيا', 'إيران', 'بلغاريا'],
    image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80',
    hints: ['يقع هذا المعلم التاريخي في مدينة يعبرها مضيق البوسفور.', 'المدينة تمتد بين قارتي آسيا وأوروبا.', 'عاصمة الدولة هي أنقرة.'],
  },
  {
    place: 'المدينة الزرقاء شفشاون', country: 'المغرب', code: 'ma', aliases: ['Morocco'], region: 'أفريقيا', neighbors: ['الجزائر'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Chefchaouen_-_blue_city_in_Morocco.jpg/960px-Chefchaouen_-_blue_city_in_Morocco.jpg',
    imageCredit: '[Ekaterina Kvelidze — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Chefchaouen_-_blue_city_in_Morocco.jpg)',
    hints: ['تشتهر هذه المدينة القديمة بأزقتها وواجهاتها الزرقاء.', 'تقع في جبال الريف شمال غرب أفريقيا.', 'عاصمة الدولة هي الرباط.'],
  },
  {
    place: 'مدينة البتراء الوردية', country: 'الأردن', code: 'jo', aliases: ['الاردن', 'Jordan'], region: 'آسيا', neighbors: ['السعودية', 'العراق', 'سوريا', 'إسرائيل', 'فلسطين'],
    image: 'https://images.unsplash.com/photo-1579606032821-4e6161c81bd3?auto=format&fit=crop&w=1200&q=80',
    hints: ['مدينة أثرية منحوتة في الصخور الوردية.', 'تشتهر بممر ضيق يسمى السيق.', 'تقع في بلاد الشام.'],
  },
  {
    place: 'أبراج دبي ووسط المدينة', country: 'الإمارات', code: 'ae', aliases: ['الامارات', 'الإمارات العربية المتحدة', 'UAE'], region: 'آسيا', neighbors: ['السعودية', 'عمان'],
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    hints: ['تظهر في الصورة أبراج شاهقة على ساحل الخليج.', 'تضم المدينة أطول برج في العالم.', 'تقع في دولة اتحادية من سبع إمارات.'],
  },
  {
    place: 'برج الساعة بيغ بن في لندن', country: 'المملكة المتحدة', code: 'gb', aliases: ['بريطانيا', 'انجلترا', 'إنجلترا', 'United Kingdom', 'UK'], region: 'أوروبا', neighbors: ['إيرلندا'],
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
    hints: ['يقع هذا البرج قرب مبنى البرلمان ونهر التايمز.', 'تشتهر المدينة بحافلاتها الحمراء ذات الطابقين.', 'الدولة جزيرة في شمال غرب أوروبا.'],
  },
  {
    place: 'جسر البوابة الذهبية', country: 'الولايات المتحدة', code: 'us', aliases: ['امريكا', 'أمريكا', 'الولايات المتحدة الامريكية', 'United States', 'USA'], region: 'أمريكا الشمالية', neighbors: ['كندا', 'المكسيك'],
    image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=80',
    hints: ['جسر معلّق أحمر اللون يعبر مدخلاً بحرياً.', 'يقع في مدينة سان فرانسيسكو.', 'هذه الدولة تضم خمسين ولاية.'],
  },
  {
    place: 'بحيرة مورين في جبال روكي', country: 'كندا', code: 'ca', aliases: ['Canada'], region: 'أمريكا الشمالية', neighbors: ['الولايات المتحدة'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/1_moraine_lake_pano_2019.jpg/960px-1_moraine_lake_pano_2019.jpg',
    imageCredit: '[Chensiyuan — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:1_moraine_lake_pano_2019.jpg)',
    hints: ['بحيرة جليدية بلون فيروزي تحيط بها قمم شاهقة.', 'تقع في متنزه بانف الوطني.', 'تجاور هذه الدولة الولايات المتحدة من الشمال.'],
  },
  {
    place: 'تمثال المسيح الفادي في ريو', country: 'البرازيل', code: 'br', aliases: ['Brazil'], region: 'أمريكا الجنوبية', neighbors: ['الأرجنتين', 'بوليفيا', 'كولومبيا', 'غيانا', 'غيانا الفرنسية', 'باراغواي', 'بيرو', 'سورينام', 'أوروغواي', 'فنزويلا'],
    image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1200&q=80',
    hints: ['تمثال ضخم يقف فوق جبل ويطل على خليج واسع.', 'يقع في مدينة ريو دي جانيرو.', 'أكبر دول هذه القارة مساحةً.'],
  },
  {
    place: 'مدينة ماتشو بيتشو الجبلية', country: 'بيرو', code: 'pe', aliases: ['Peru'], region: 'أمريكا الجنوبية', neighbors: ['الإكوادور', 'كولومبيا', 'البرازيل', 'بوليفيا', 'تشيلي'],
    image: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80',
    hints: ['مدينة حجرية قديمة فوق قمم جبال الأنديز.', 'بناها شعب الإنكا قبل قرون.', 'تقع على ساحل المحيط الهادئ في أمريكا الجنوبية.'],
  },
  {
    place: 'سور الصين العظيم', country: 'الصين', code: 'cn', aliases: ['China'], region: 'آسيا', neighbors: ['منغوليا', 'روسيا', 'الهند', 'نيبال', 'باكستان', 'فيتنام', 'لاوس', 'ميانمار', 'كوريا الشمالية', 'أفغانستان', 'بوتان', 'كازاخستان', 'قيرغيزستان', 'طاجيكستان'],
    image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1200&q=80',
    hints: ['يمتد هذا البناء الدفاعي آلاف الكيلومترات عبر الجبال.', 'بُنيت أجزاؤه عبر سلالات تاريخية متعددة.', 'يقع في شرق آسيا.'],
  },
  {
    place: 'مدرجات الأرز في بالي', country: 'إندونيسيا', code: 'id', aliases: ['اندونيسيا', 'Indonesia'], region: 'آسيا', neighbors: ['ماليزيا', 'بابوا غينيا الجديدة', 'تيمور الشرقية'],
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    hints: ['جزيرة استوائية تشتهر بالمدرجات الخضراء والمعابد.', 'تقع في أرخبيل واسع جنوب شرق آسيا.', 'جاكرتا هي عاصمة الدولة.'],
  },
  {
    place: 'معبد وات آرون في بانكوك', country: 'تايلاند', code: 'th', aliases: ['Thailand'], region: 'آسيا', neighbors: ['ميانمار', 'لاوس', 'كمبوديا', 'ماليزيا'],
    image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80',
    hints: ['معبد مزخرف يقف على ضفة نهر تشاو فرايا.', 'يقع في مدينة بانكوك.', 'اسم عاصمتها يعني مدينة الملائكة.'],
  },
  {
    place: 'منازل سانتوريني البيضاء', country: 'اليونان', code: 'gr', aliases: ['Greece'], region: 'أوروبا', neighbors: ['ألبانيا', 'بلغاريا', 'تركيا', 'مقدونيا الشمالية'],
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    hints: ['قرية جزيرية بمنازل بيضاء وقباب زرقاء فوق البحر.', 'تقع في بحر إيجه.', 'أثينا هي عاصمة الدولة.'],
  },
  {
    place: 'دار أوبرا سيدني', country: 'أستراليا', code: 'au', aliases: ['استراليا', 'Australia'], region: 'أوقيانوسيا', neighbors: [],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Sydney_Opera_House_-_Dec_2008.jpg/960px-Sydney_Opera_House_-_Dec_2008.jpg',
    imageCredit: '[Diliff — CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_-_Dec_2008.jpg)',
    hints: ['مبنى أبيض بتصميم يشبه الأشرعة بجانب ميناء.', 'يقع في مدينة سيدني.', 'دولة وقارة في نصف الكرة الجنوبي.'],
  },
  {
    place: 'قمة ماترهورن الألبية', country: 'سويسرا', code: 'ch', aliases: ['Switzerland'], region: 'أوروبا', neighbors: ['فرنسا', 'ألمانيا', 'إيطاليا', 'النمسا', 'ليختنشتاين'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Matterhorn_Riffelsee_2005-06-11.jpg/960px-Matterhorn_Riffelsee_2005-06-11.jpg',
    imageCredit: '[Dirk Beyer — CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Matterhorn_Riffelsee_2005-06-11.jpg)',
    hints: ['قمة جبلية حادة تشتهر بشكلها الهرمي.', 'تقع قرب بلدة زيرمات في جبال الألب.', 'تشتهر الدولة بساعاتها وشوكولاتتها.'],
  },
  {
    place: 'هرم إل كاستيو في تشيتشن إيتزا', country: 'المكسيك', code: 'mx', aliases: ['Mexico'], region: 'أمريكا الشمالية', neighbors: ['الولايات المتحدة', 'بليز', 'غواتيمالا'],
    image: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=1200&q=80',
    hints: ['هرم مدرّج بناه شعب المايا قديماً.', 'يقع في شبه جزيرة يوكاتان.', 'تقع الدولة جنوب الولايات المتحدة.'],
  },
  {
    place: 'كنيسة ساغرادا فاميليا في برشلونة', country: 'إسبانيا', code: 'es', aliases: ['اسبانيا', 'Spain'], region: 'أوروبا', neighbors: ['فرنسا', 'البرتغال', 'أندورا'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Sagrada_Familia_March_2015-10a.jpg/960px-Sagrada_Familia_March_2015-10a.jpg',
    imageCredit: '[Alvesgaspar — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_March_2015-10a.jpg)',
    hints: ['كنيسة ضخمة صممها المعماري أنطوني غاودي.', 'تقع في مدينة برشلونة.', 'تقع الدولة في شبه الجزيرة الإيبيرية.'],
  },
  {
    place: 'ترام لشبونة الأصفر', country: 'البرتغال', code: 'pt', aliases: ['Portugal'], region: 'أوروبا', neighbors: ['إسبانيا'],
    image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=80',
    hints: ['ترام أصفر قديم يمر بين شوارع ضيقة وتلال.', 'يقع في عاصمة على ساحل الأطلسي.', 'الدولة تجاور إسبانيا غرباً.'],
  },
  {
    place: 'كاتدرائية القديس باسيل في موسكو', country: 'روسيا', code: 'ru', aliases: ['Russia'], region: 'أوروبا', neighbors: ['النرويج', 'فنلندا', 'إستونيا', 'لاتفيا', 'ليتوانيا', 'بولندا', 'بيلاروسيا', 'أوكرانيا', 'جورجيا', 'أذربيجان', 'كازاخستان', 'الصين', 'منغوليا', 'كوريا الشمالية'],
    image: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&w=1200&q=80',
    hints: ['كاتدرائية ذات قباب ملونة قرب الساحة الحمراء.', 'تقع في موسكو.', 'تمتد هذه الدولة عبر قارتي أوروبا وآسيا.'],
  },
  {
    place: 'قصر غيونغبوكغونغ في سيول', country: 'كوريا الجنوبية', code: 'kr', aliases: ['South Korea'], region: 'آسيا', neighbors: ['كوريا الشمالية'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Gyeonghoeru_%28Royal_Banquet_Hall%29_at_Gyeongbokgung_Palace%2C_Seoul.jpg/960px-Gyeonghoeru_%28Royal_Banquet_Hall%29_at_Gyeongbokgung_Palace%2C_Seoul.jpg',
    imageCredit: '[Frank Schulenburg — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Gyeonghoeru_(Royal_Banquet_Hall)_at_Gyeongbokgung_Palace,_Seoul.jpg)',
    hints: ['قصر ملكي تاريخي يقع وسط مدينة حديثة.', 'يقع في سيول.', 'تقع الدولة في النصف الجنوبي من شبه الجزيرة الكورية.'],
  },
  {
    place: 'مضايق ميلفورد ساوند', country: 'نيوزيلندا', code: 'nz', aliases: ['نيوزيلندا', 'New Zealand'], region: 'أوقيانوسيا', neighbors: [],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Milford_Sound_in_Fiordland_National_Park_01.jpg/960px-Milford_Sound_in_Fiordland_National_Park_01.jpg',
    imageCredit: '[Krzysztof Golik — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Milford_Sound_in_Fiordland_National_Park_01.jpg)',
    hints: ['مضيق بحري تحيط به جبال شاهقة وشلالات.', 'يقع في الجزيرة الجنوبية.', 'تقع الدولة جنوب شرق أستراليا.'],
  },
  {
    place: 'محمية ماساي مارا', country: 'كينيا', code: 'ke', aliases: ['Kenya'], region: 'أفريقيا', neighbors: ['إثيوبيا', 'الصومال', 'جنوب السودان', 'تنزانيا', 'أوغندا'],
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
    hints: ['سهول واسعة تشتهر بهجرة الحيوانات البرية.', 'تقع قرب سيرينغيتي.', 'نيروبي هي عاصمة الدولة.'],
  },
  {
    place: 'جبل الطاولة في كيب تاون', country: 'جنوب أفريقيا', code: 'za', aliases: ['جنوب افريقيا', 'South Africa'], region: 'أفريقيا', neighbors: ['ناميبيا', 'بوتسوانا', 'زيمبابوي', 'موزمبيق', 'إسواتيني', 'ليسوتو'],
    image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1200&q=80',
    hints: ['قمة مسطحة مميزة تطل على المحيط ومدينة ساحلية.', 'تقع في مدينة كيب تاون.', 'تقع في أقصى جنوب القارة الأفريقية.'],
  },
  {
    place: 'مضيق غيرانغير في النرويج', country: 'النرويج', code: 'no', aliases: ['Norway'], region: 'أوروبا', neighbors: ['السويد', 'فنلندا', 'روسيا'],
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Geirangerfjord_LC0188.jpg/960px-Geirangerfjord_LC0188.jpg',
    imageCredit: '[Jörg Hempel — CC BY-SA 2.0 DE](https://commons.wikimedia.org/wiki/File:Geirangerfjord_LC0188.jpg)',
    hints: ['ممر بحري عميق بين جبال شديدة الانحدار وشلالات.', 'يقع في منطقة اسكندنافية.', 'أوسلو هي عاصمة الدولة.'],
  },
  {
    place: 'قنوات أمستردام التاريخية', country: 'هولندا', code: 'nl', aliases: ['Netherlands'], region: 'أوروبا', neighbors: ['بلجيكا', 'ألمانيا'],
    image: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1200&q=80',
    hints: ['قنوات مائية تحيط بها منازل ضيقة وجسور كثيرة.', 'تقع في مدينة تشتهر بالدراجات.', 'تجاور بلجيكا وألمانيا في أوروبا الغربية.'],
  },
];

const randomOf = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => {
  const shuffled = [...list];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};
function geminiHttpError(status) {
  const reason = status === 400
    ? 'راجع صيغة طلب Gemini.'
    : status === 401 || status === 403
      ? 'تحقق من GEMINI_API_KEY وتفعيل Gemini API للمفتاح.'
      : status === 404
        ? 'نموذج Gemini غير متاح لهذا المفتاح.'
        : status === 429
          ? 'تجاوزت حصة Gemini؛ تحقق من حدود الاستخدام.'
          : 'تحقق من اتصال Gemini وحاول لاحقاً.';
  return new Error(`Gemini API رجع HTTP ${status}. ${reason}`);
}

const normalize = (text) => String(text || '')
  .normalize('NFD')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ى]/g, 'ي')
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('ar');

const COUNTRY_REGIONS = {
  'آسيا': 'af am az bh bd bt bn kh cn cy ge in id ir iq il jp jo kz kw kg la lb my mv mn mm np kp om pk ps ph qa sa sg kr lk sy tw tj th tl tr tm ae uz vn ye',
  'أوروبا': 'al ad at by be ba bg hr cz dk ee fi fr de gr hu is ie it lv li lt lu mt md mc me nl mk no pl pt ro ru sm rs sk si es se ch ua gb',
  'أفريقيا': 'dz ao bj bw bf bi cv cm cf td km cg cd ci dj eg gq er sz et ga gm gh gn gw ke ls lr ly mg mw ml mr mu ma mz na ne ng rw st sn sc sl so za ss sd tz tg tn ug zm zw',
  'أمريكا الشمالية': 'ag bs bb bz ca cr cu dm do sv gd gt ht hn jm mx ni pa kn lc vc tt us',
  'أمريكا الجنوبية': 'ar bo br cl co ec gy py pe sr uy ve',
  'أوقيانوسيا': 'au fj ki mh fm nr nz pw pg ws sb to tv vu',
};
const REGION_BY_CODE = new Map(
  Object.entries(COUNTRY_REGIONS).flatMap(([region, codes]) =>
    codes.split(' ').map((code) => [code, region])),
);
REGION_BY_CODE.set('tr', 'آسيا');
const COUNTRY_CODE_BY_ALIAS = new Map(
  [
    ...countryFlags.flatMap(([names, code]) => names.split('|').map((name) => [normalize(name), code])),
    ...COUNTRY_QUESTIONS.flatMap((question) =>
      [question.country, ...question.aliases].map((name) => [normalize(name), question.code])),
  ],
);
const COUNTRY_REGION_BY_CODE = new Map(
  REGION_BY_CODE.entries(),
);
const ADJACENT_REGIONS = {
  'آسيا': new Set(['أوروبا', 'أفريقيا']),
  'أوروبا': new Set(['آسيا', 'أفريقيا']),
  'أفريقيا': new Set(['آسيا', 'أوروبا']),
  'أمريكا الشمالية': new Set(['أمريكا الجنوبية']),
  'أمريكا الجنوبية': new Set(['أمريكا الشمالية']),
  'أوقيانوسيا': new Set(['آسيا']),
};
const ALL_COUNTRY_QUESTIONS = COUNTRY_QUESTIONS;

async function generateGeminiJson(systemInstruction, prompt, responseSchema) {
  if (!GEMINI_API_KEY) {
    throw new Error('ضبط GEMINI_API_KEY في ملف .env لتوليد تحديات التخمين.');
  }
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw geminiHttpError(response.status);
  }
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return JSON.parse(text);
}

function validateArabicText(value, field, maxLength = 80) {
  if (typeof value !== 'string') throw new Error(`Gemini returned an invalid ${field}.`);
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || text.length > maxLength || !/\p{Script=Arabic}/u.test(text)) {
    throw new Error(`Gemini returned an invalid ${field}.`);
  }
  return text;
}

function validateWordList(value, field, { min = 2, max = 8, excluded = [] } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`Gemini returned an invalid ${field} list.`);
  }
  const seen = new Set(excluded.map(normalize));
  const words = value
    .map((word) => validateArabicText(word, field, 32))
    .filter((word) => {
      const key = normalize(word);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (words.length < min) throw new Error(`Gemini returned too few ${field}.`);
  return words;
}

async function generateCountryQuestion(game) {
  const question = game.countryQuestions?.pop();
  if (!question) throw new Error('انتهت قائمة صور جولات خمن الدولة.');
  return question;
}

function validateDrawingPath(value) {
  if (typeof value !== 'string' || value.length > 1_800 || !/^\s*[Mm]/.test(value)
    || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(value)
    || !/\d/.test(value)) {
    throw new Error('Gemini returned unsafe or invalid SVG path data.');
  }
  const coordinates = value.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi) || [];
  if (coordinates.some((coordinate) => !Number.isFinite(Number(coordinate)) || Math.abs(Number(coordinate)) > 1000)) {
    throw new Error('Gemini returned out-of-range SVG coordinates.');
  }
  return value;
}

async function generateDrawing() {
  const generated = await generateGeminiJson(
    'أنت رسام ألعاب محترف تصمم رسومات vector line-art واضحة للتخمين. اختر شيئاً يومياً بسيطاً ومألوفاً يمكن رسمه بخطوط فقط. أنشئ رسمة SVG أصلية مقسمة إلى 5 مراحل متدرجة: كل عنصر في parts عبارة عن بيانات d لمسار SVG فقط داخل viewBox من 0 إلى 100، وليس HTML أو SVG أو CSS. استخدم أوامر M L H V C S Q T A Z وأرقاماً بين 5 و95. ابدأ بالشكل الخارجي ثم أضف التفاصيل المميزة تدريجياً. كل مرحلة يجب أن تضيف خطوطاً مفيدة، والرسمة النهائية يجب أن تكون واضحة ومميزة. أعد اسم الإجابة بالعربية الفصحى ومرادفات عربية صحيحة.',
    'أنشئ تحدي رسمة جديداً ومختلفاً. أعد JSON بالحقول answer وaliases (مرادفان إلى خمسة) وparts (خمسة مسارات متدرجة بالضبط).',
    {
      type: 'OBJECT',
      properties: {
        answer: { type: 'STRING' },
        aliases: { type: 'ARRAY', items: { type: 'STRING' } },
        parts: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['answer', 'aliases', 'parts'],
    },
  );
  const answer = validateArabicText(generated.answer, 'drawing answer', 36);
  const aliases = validateWordList(generated.aliases, 'drawing aliases', { min: 1, max: 6, excluded: [answer] });
  if (!Array.isArray(generated.parts) || generated.parts.length !== 5) {
    throw new Error('Gemini returned an invalid drawing.');
  }
  const parts = generated.parts.map(validateDrawingPath);
  return { answer, aliases, parts };
}

async function generateWordQuestion() {
  const generated = await generateGeminiJson(
    'أنت مصمم تحديات مفردات عربية. اختر كلمة سرية واحدة مألوفة وواضحة، وأنشئ لها مرادفات، وكلمات قريبة جداً في المعنى، وكلمات مرتبطة بها. كل القيم بالعربية فقط، وتجنب تكرار الكلمات بين القوائم.',
    'أنشئ تحدي تخمين كلمة جديداً. أعد JSON بالحقول answer وaliases (مرادفان إلى أربعة) وclose (أربع كلمات قريبة في المعنى) وrelated (أربع كلمات مرتبطة بالموضوع).',
    {
      type: 'OBJECT',
      properties: {
        answer: { type: 'STRING' },
        aliases: { type: 'ARRAY', items: { type: 'STRING' } },
        close: { type: 'ARRAY', items: { type: 'STRING' } },
        related: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['answer', 'aliases', 'close', 'related'],
    },
  );
  const answer = validateArabicText(generated.answer, 'secret word', 36);
  const aliases = validateWordList(generated.aliases, 'word aliases', { min: 1, max: 6, excluded: [answer] });
  const close = validateWordList(generated.close, 'close words', { min: 3, max: 8, excluded: [answer, ...aliases] });
  const related = validateWordList(generated.related, 'related words', { min: 3, max: 8, excluded: [answer, ...aliases, ...close] });
  return { answer, aliases, close, related };
}

async function startAiChallenge(game, generate, start) {
  game.status = 'generating';
  try {
    const challenge = await generate();
    if (games.get(game.channelId) !== game) return;
    await start(challenge);
  } catch (error) {
    console.error(`[fizbo-server-games] failed to prepare challenge for ${game.key}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = Number(errorMessage.match(/HTTP (\d+)/)?.[1]);
    const reason = game.key === 'guessthecountry'
      ? 'حاول بدء جولة جديدة.'
      : status === 400
        ? 'راجع إعدادات طلب Gemini.'
        : status === 401 || status === 403
          ? 'تحقق من صحة GEMINI_API_KEY وتفعيل Gemini API.'
          : status === 404
            ? 'نموذج Gemini غير متاح لهذا المفتاح.'
            : status === 429
              ? 'حصة Gemini غير كافية حالياً.'
              : 'تحقق من المفتاح والاتصال بالخدمة.';
    await editGame(game, {
      embeds: [embed(
        'تعذّر تجهيز اللعبة',
        `لم تبدأ اللعبة. ${reason}${game.key === 'guessthecountry' || !status ? '' : ` (HTTP ${status})`}`,
        0xed4245,
      )],
      components: [],
    });
    stop(game);
  }
}

function safePayload(payload) {
  return { ...payload, allowedMentions: payload.allowedMentions || { parse: [] } };
}

function cid(channelId, action) {
  return `${PREFIX}${channelId}:${action}`;
}

function btn(channelId, action, label, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(cid(channelId, action))
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function row(buttons) {
  return new ActionRowBuilder().addComponents(buttons);
}

function embed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'dev.splosh' })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'dev.splosh • ألعاب وتحديات' });
}

function schedule(game, callback, delay) {
  const timer = setTimeout(() => {
    game.timers.delete(timer);
    if (games.get(game.channelId) === game) {
      Promise.resolve(callback()).catch((error) => console.error('[fizbo-server-games]', error));
    }
  }, delay);
  if (typeof timer.unref === 'function') timer.unref();
  game.timers.add(timer);
  return timer;
}

function stop(game) {
  for (const timer of game.timers) clearTimeout(timer);
  game.timers.clear();
  clearTimeout(game.idleTimer);
  game.idleTimer = null;
  if (games.get(game.channelId) === game) games.delete(game.channelId);
}

function refreshIdleTimer(game) {
  clearTimeout(game.idleTimer);
  game.idleTimer = setTimeout(() => {
    if (games.get(game.channelId) !== game || game.status !== 'playing') return;
    void channelSend(game, {
      content: `⏱️ انتهت لعبة **${game.title}** بسبب عدم وجود تفاعل لمدة دقيقتين.`,
      allowedMentions: { parse: [] },
    }).finally(() => stop(game));
  }, IDLE_MS);
  if (typeof game.idleTimer.unref === 'function') game.idleTimer.unref();
}

function clearScheduled(game) {
  for (const timer of game.timers) clearTimeout(timer);
  game.timers.clear();
}

async function editGame(game, payload) {
  if (!game.message) return;
  try {
    await game.message.edit(safePayload(payload));
  } catch (error) {
    if (error.code !== 10008 && error.code !== 10003) console.error('[fizbo-server-games] update failed:', error);
  }
}

async function channelSend(game, payload) {
  try {
    return await game.message.channel.send(safePayload(payload));
  } catch (error) {
    console.error('[fizbo-server-games] send failed:', error);
    return null;
  }
}

function playerName(game, id) {
  return game.players.find((player) => player.id === id)?.name || `<@${id}>`;
}

function names(game, ids = game.players.map((player) => player.id)) {
  return ids.map((id) => playerName(game, id)).join('، ');
}

function winner(game, id, message) {
  const mention = id ? `<@${id}>` : '';
  return channelSend(game, {
    content: `${message}${mention ? ` ${mention}` : ''}`,
    allowedMentions: { users: id ? [id] : [], parse: [] },
  }).finally(() => stop(game));
}

function lobbyPayload(game) {
  const secondsRemaining = Math.max(0, Math.ceil((game.lobbyDeadline - Date.now()) / 1_000));
  const details = game.key === 'chairs'
    ? 'في كل جولة اختاروا مقعداً بسرعة؛ بعض المقاعد فخاخ!'
    : game.key === 'rps_tournament'
      ? 'في كل جولة اختار الجميع حركة سرّاً؛ أضعف الحركات تخرج من البطولة.'
      : game.key === 'dice_teams'
        ? 'يتوزع اللاعبون على فريقين حسب ترتيب الانضمام، ثم يتنافسون في ثلاث جولات نرد.'
        : game.key === 'deathwheel'
          ? 'تدور العجلة لتختار لاعباً، ثم يختار صندوقاً قد يكون آمناً أو فخاً.'
          : game.key === 'hideandseek'
            ? 'يصبح لاعب واحد باحثاً، ويختبئ الآخرون في أماكن سرية.'
            : game.key === 'guessthecountry'
              ? '6 جولات من صور الأماكن والمعالم؛ خمّنوا الدولة واجمعوا النقاط للفوز.'
              : game.key === 'guessthedraw'
                ? 'ستظهر رسمة أصلية على مراحل؛ أول من يخمنها في الدردشة يفوز.'
                : game.key === 'guesstheword'
                  ? 'اكتبوا كلمات في الدردشة؛ تفوز الكلمة الأقرب في المعنى إلى الكلمة السرية.'
                  : game.key === 'hotxo'
                    ? 'إكس أو سريع: بعد ست علامات تختفي أقدم علامة من اللوح.'
                    : 'بطولة إقصائية من مباريات إكس أو، والفائز يتقدم إلى الجولة التالية.';
  const roster = game.players.length
    ? game.players.map((player, index) => `${index + 1}. ${player.name}${game.key === 'dice_teams' ? ` — ${index % 2 ? '🔵' : '🔴'}` : ''}`).join('\n')
    : 'لاعبو اللعبة: 0';
  const lobbyEmbed = embed(
    `🎮 ${game.title}`,
    `${details}\n\n**اللاعبون (${game.players.length}):**\n${roster}\n\n⏳ يبدأ اللعب تلقائياً بعد **${secondsRemaining} ثانية**.\nالمنظّم: ${playerName(game, game.hostId)}`,
  );
  if (game.banner) lobbyEmbed.setImage(`attachment://${game.banner.name}`);
  const payload = {
    embeds: [lobbyEmbed],
    components: [row([
      btn(game.channelId, 'join', 'انضمام', ButtonStyle.Success),
      btn(game.channelId, 'leave', 'مغادرة'),
    ])],
  };
  if (game.bannerAttachmentId) payload.attachments = [{ id: game.bannerAttachmentId }];
  else if (game.banner) payload.files = [game.banner];
  return payload;
}

async function expireLobby(game) {
  if (game.status !== 'lobby') return;
  clearScheduled(game);
  if (game.players.length < minimum(game)
      || (game.key === 'hotxo' && game.players.length !== 2)) {
    const needed = game.key === 'hotxo'
      ? 'تحتاج إكس أو الساخنة لاعبين اثنين بالضبط.'
      : `تحتاج اللعبة إلى ${minimum(game)} لاعبين على الأقل.`;
    await editGame(game, {
      embeds: [embed(`انتهى تسجيل ${game.title}`, `ما اكتمل العدد خلال 45 ثانية. ${needed}`)],
      components: [],
    });
    stop(game);
    return;
  }
  await editGame(game, {
    embeds: [embed(`⏱️ انتهى التسجيل — ${game.title}`, `اكتمل التسجيل بـ **${game.players.length}** لاعبين؛ تبدأ الجولة الآن.`)],
    components: [],
  });
  await begin(game);
}

function setBoardComponents(game, board, disabled = false) {
  const components = [];
  const token = game.key === 'xo_tournament'
    ? `${game.matchIndex}-${game.matchAttempt}-${game.moveCount}-${game.turn}`
    : `${game.moveCount}-${game.turn}`;
  for (let y = 0; y < 3; y += 1) {
    components.push(row(Array.from({ length: 3 }, (_, x) => {
      const cell = y * 3 + x;
      return btn(game.channelId, `cell:${token}:${cell}`, board[cell] || '　', board[cell] ? ButtonStyle.Secondary : ButtonStyle.Primary, disabled || Boolean(board[cell]));
    })));
  }
  return components;
}

function lineWinner(board) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}

function showBracketMatch(game) {
  if (game.roundPlayers.length === 1) {
    winner(game, game.roundPlayers[0], '🏆 بطل بطولة إكس أو:');
    return;
  }
  if (!game.pairings) {
    const players = shuffle(game.roundPlayers);
    game.pairings = [];
    game.nextRound = [];
    if (players.length % 2) game.nextRound.push(players.pop());
    while (players.length) game.pairings.push([players.pop(), players.pop()]);
    game.matchIndex = 0;
    game.matchAttempt = 0;
    if (!game.pairings.length) {
      game.roundPlayers = game.nextRound;
      game.pairings = null;
      showBracketMatch(game);
      return;
    }
    channelSend(game, { content: `🏁 بدأت جولة جديدة في بطولة إكس أو (${game.roundPlayers.length} متنافسين).`, allowedMentions: { parse: [] } });
  }
  if (game.matchIndex >= game.pairings.length) {
    game.roundPlayers = game.nextRound;
    game.pairings = null;
    showBracketMatch(game);
    return;
  }
  const [a, b] = game.pairings[game.matchIndex];
  game.matchPlayers = [a, b];
  game.board = Array(9).fill(null);
  game.turn = 0;
  game.moveCount = 0;
  editGame(game, {
    embeds: [embed(`🏆 إكس أو — المباراة ${game.matchIndex + 1}/${game.pairings.length}`, `❌ ${playerName(game, a)} ضد ⭕ ${playerName(game, b)}\nالدور على **${playerName(game, a)}**.`)],
    components: setBoardComponents(game, game.board),
  });
}

function showHotBoard(game) {
  editGame(game, {
    embeds: [embed('🔥 إكس أو الساخنة', `❌ ${playerName(game, game.players[0].id)} — ⭕ ${playerName(game, game.players[1].id)}\nالدور على **${playerName(game, game.players[game.turn].id)}**. أقدم علامة تختفي بعد ست علامات.`)],
    components: setBoardComponents(game, game.board),
  });
}

async function beginChairs(game) {
  game.status = 'playing';
  game.alive = game.players.map((player) => player.id);
  game.round = 0;
  await chairRound(game);
}

async function chairRound(game) {
  if (game.alive.length === 1) return winner(game, game.alive[0], '🪑 فاز بسباق الكراسي:');
  game.round += 1;
  game.seatCount = Math.max(1, game.alive.length - 1);
  game.trapSeat = game.alive.length > 2 ? Math.floor(Math.random() * game.seatCount) : -1;
  game.seatPicks = new Map();
  game.roundResolving = false;
  await editGame(game, {
    embeds: [embed(`🪑 جولة ${game.round}: المقاعد تختفي!`, `**الناجون:** ${names(game, game.alive)}\nهناك ${game.seatCount} مقعداً${game.trapSeat < 0 ? '' : '، أحدها فخ'}. اضغطوا على مقعد الآن؛ الحجز للأسرع، ومن لا يجلس يخرج.`, 0xf1c40f)],
    components: Array.from({ length: Math.ceil(game.seatCount / 5) }, (_, group) => row(
      Array.from({ length: Math.min(5, game.seatCount - group * 5) }, (_, offset) => {
        const seat = group * 5 + offset;
        return btn(game.channelId, `seat:${game.round}:${seat}`, `مقعد ${seat + 1}`, ButtonStyle.Primary);
      }),
    )),
  });
  schedule(game, () => resolveChairs(game), 12_000);
}

async function resolveChairs(game) {
  if (game.roundResolving) return;
  game.roundResolving = true;
  clearScheduled(game);
  const claims = [...game.seatPicks.entries()];
  const claimedSeats = new Set();
  const survivors = [];
  const eliminated = [];
  for (const [id, seat] of claims) {
    if (claimedSeats.has(seat)) {
      eliminated.push(id);
    } else {
      claimedSeats.add(seat);
      if (seat === game.trapSeat) eliminated.push(id);
      else survivors.push(id);
    }
  }
  for (const id of game.alive) if (!game.seatPicks.has(id)) eliminated.push(id);
  game.alive = survivors;
  if (!game.alive.length) {
    game.alive = [randomOf(eliminated)];
  }
  await editGame(game, {
    embeds: [embed('انتهى سباق المقاعد', `${game.trapSeat < 0 ? 'لا يوجد فخ في الجولة النهائية.' : `المقعد الفخ: **${game.trapSeat + 1}**.`}\nخرج: ${eliminated.length ? names(game, [...new Set(eliminated)]) : 'لا أحد'}.\nالناجون: ${names(game, game.alive)}`)],
    components: [],
  });
  schedule(game, () => chairRound(game), 3_500);
}

function rpsResult(choice) {
  return { حجر: 0, ورقة: 1, مقص: 2 }[choice];
}

function resolveRps(game) {
  const choices = game.choices;
  if (game.roundResolving || choices.size < game.alive.length) return;
  game.roundResolving = true;
  clearScheduled(game);
  const counts = [0, 0, 0];
  for (const choice of choices.values()) counts[rpsResult(choice)] += 1;
  const active = counts.map((count, index) => count ? index : -1).filter((value) => value >= 0);
  let winningHand;
  if (active.length <= 1) winningHand = null;
  else {
    const beats = (left, right) => (left - right + 3) % 3 === 1;
    const undefeated = active.filter((candidate) => active.every((other) => candidate === other || beats(candidate, other)));
    winningHand = undefeated.length === 1 ? undefeated[0] : null;
  }
  if (winningHand === null) {
    game.round += 1;
    game.choices = new Map();
    game.roundResolving = false;
    editGame(game, {
      embeds: [embed(`✊ جولة ${game.round}: تعادل!`, `لم يُقصَ أحد. عاد الجميع للاختيار.\nالباقون: ${names(game, game.alive)}`)],
      components: [rpsButtons(game)],
    });
    schedule(game, () => finishRpsTimeout(game), 25_000);
    return;
  }
  const handNames = ['حجر', 'ورقة', 'مقص'];
  const survivors = game.alive.filter((id) => rpsResult(choices.get(id)) === winningHand);
  const losers = game.alive.filter((id) => rpsResult(choices.get(id)) !== winningHand);
  game.alive = survivors;
  editGame(game, {
    embeds: [embed(`✊ انتهت الجولة ${game.round}`, `الحركة الفائزة: **${handNames[winningHand]}**.\nخرج: ${names(game, losers)}\nالباقون: ${names(game, survivors)}`)],
    components: [],
  });
  if (survivors.length === 1) return winner(game, survivors[0], '✊ فاز ببطولة حجر ورقة مقص:');
  if (survivors.length === 0) {
    const champion = randomOf(losers);
    return winner(game, champion, '✊ فاز بعد تعادل نهائي:');
  }
  schedule(game, () => startRpsRound(game), 3_000);
}

function rpsButtons(game) {
  return row([
    btn(game.channelId, `rps:${game.round}:rock`, '🪨 حجر', ButtonStyle.Primary),
    btn(game.channelId, `rps:${game.round}:paper`, '📄 ورقة', ButtonStyle.Primary),
    btn(game.channelId, `rps:${game.round}:scissors`, '✂️ مقص', ButtonStyle.Primary),
  ]);
}

function finishRpsTimeout(game) {
  if (game.status !== 'playing' || game.roundResolving || game.choices.size === game.alive.length) return;
  game.roundResolving = true;
  const missing = game.alive.filter((id) => !game.choices.has(id));
  game.alive = game.alive.filter((id) => game.choices.has(id));
  if (game.alive.length === 1) return winner(game, game.alive[0], '✊ فاز؛ منافسوه لم يختاروا في الوقت المحدد:');
  if (game.alive.length === 0) return winner(game, randomOf(missing), '✊ فاز بعد انسحاب الجميع:');
  game.choices = new Map();
  schedule(game, () => startRpsRound(game), 2_000);
}

function startRpsRound(game) {
  if (game.status !== 'playing') return;
  game.round += 1;
  game.choices = new Map();
  game.roundResolving = false;
  editGame(game, {
    embeds: [embed(`✊ حجر ورقة مقص — الجولة ${game.round}`, `اختاروا حركة سرّاً. من يخسر الحركة يخرج.\nالباقون: ${names(game, game.alive)}\nالاختيارات: 0/${game.alive.length}`)],
    components: [rpsButtons(game)],
  });
  schedule(game, () => finishRpsTimeout(game), 25_000);
}

async function beginDice(game) {
  game.status = 'playing';
  game.round = 0;
  game.teamTotals = [0, 0];
  game.roundTotals = [0, 0];
  game.rolls = new Map();
  await diceRound(game);
}

async function diceRound(game) {
  game.round += 1;
  game.rolls = new Map();
  game.roundTotals = [0, 0];
  game.roundResolving = false;
  await editGame(game, {
    embeds: [embed(`🎲 الجولة ${game.round} من 3`, `كل لاعب يرمي مرة واحدة. الفرق بالتناوب حسب ترتيب الانضمام.\n🔴 الفريق الأول: **${game.teamTotals[0]}**\n🔵 الفريق الثاني: **${game.teamTotals[1]}**\nالرميات: 0/${game.players.length}`)],
    components: [row([btn(game.channelId, `roll:${game.round}`, '🎲 ارمِ النرد', ButtonStyle.Primary)])],
  });
  schedule(game, () => resolveDice(game), 30_000);
}

async function resolveDice(game) {
  if (game.status !== 'playing' || game.roundResolving) return;
  game.roundResolving = true;
  clearScheduled(game);
  for (let index = 0; index < game.players.length; index += 1) {
    const player = game.players[index];
    const roll = game.rolls.get(player.id) || 0;
    game.roundTotals[index % 2] += roll;
  }
  game.teamTotals[0] += game.roundTotals[0];
  game.teamTotals[1] += game.roundTotals[1];
  if (game.round < 3) {
    await editGame(game, {
      embeds: [embed(`🎲 نتيجة الجولة ${game.round}`, `🔴 الفريق الأول: **+${game.roundTotals[0]}** (الإجمالي ${game.teamTotals[0]})\n🔵 الفريق الثاني: **+${game.roundTotals[1]}** (الإجمالي ${game.teamTotals[1]})\n${game.rolls.size < game.players.length ? `لم يرْمِ ${names(game, game.players.map((p) => p.id).filter((id) => !game.rolls.has(id)))}؛ احتسبت لهم 0.` : ''}`)],
      components: [],
    });
    schedule(game, () => diceRound(game), 3_000);
    return;
  }
  const result = game.teamTotals[0] === game.teamTotals[1] ? 'تعادل!' : game.teamTotals[0] > game.teamTotals[1] ? '🔴 فاز الفريق الأول!' : '🔵 فاز الفريق الثاني!';
  await editGame(game, { embeds: [embed('🎲 انتهت جولات النرد الثلاث', `🔴 الفريق الأول: **${game.teamTotals[0]}**\n🔵 الفريق الثاني: **${game.teamTotals[1]}**\n\n${result}`)], components: [] });
  stop(game);
}

async function beginDeathwheel(game) {
  game.status = 'playing';
  game.alive = game.players.map((player) => player.id);
  game.round = 0;
  game.wheelPhase = 'spin';
  await deathwheelRound(game);
}

async function deathwheelRound(game) {
  if (game.alive.length === 1) return winner(game, game.alive[0], '🎡 نجا وفاز بعجلة الموت:');
  game.round += 1;
  game.selected = null;
  game.wheelPhase = 'spin';
  await editGame(game, {
    embeds: [embed(`🎡 عجلة الموت — الجولة ${game.round}`, `الناجون: ${names(game, game.alive)}\nعلى المنظّم تدوير العجلة لاختيار لاعب يغامر باختيار صندوق.`)],
    components: [row([btn(game.channelId, `spin:${game.round}`, '🎡 أدر العجلة', ButtonStyle.Danger)])],
  });
}

async function spinDeathwheel(game) {
  if (game.wheelPhase !== 'spin') return;
  game.wheelPhase = 'box';
  game.selected = randomOf(game.alive);
  game.trapBox = Math.floor(Math.random() * 3);
  await editGame(game, {
    embeds: [embed('🎡 وقع الاختيار!', `اللاعب المختار: **${playerName(game, game.selected)}**\nاختر صندوقاً من الثلاثة؛ واحد منها فخ.`, 0xe74c3c)],
    components: [row([0, 1, 2].map((box) => btn(game.channelId, `box:${game.round}:${box}`, `صندوق ${box + 1}`, ButtonStyle.Primary)))],
  });
}

async function chooseDeathBox(game, interaction, box) {
  if (interaction.user.id !== game.selected) return privateReply(interaction, 'العجلة اختارت لاعباً آخر؛ هو وحده يختار الصندوق.');
  if (game.wheelPhase !== 'box') return privateReply(interaction, 'انتهى اختيار الصندوق.');
  game.wheelPhase = 'resolving';
  if (box === game.trapBox) {
    game.alive = game.alive.filter((id) => id !== game.selected);
    await editGame(game, { embeds: [embed('💥 كان فخاً!', `خرج **${playerName(game, game.selected)}** من اللعبة.\nالناجون: ${game.alive.length ? names(game, game.alive) : 'لا أحد'}`)], components: [] });
    if (!game.alive.length) {
      const last = randomOf(game.players.map((player) => player.id));
      return winner(game, last, '🎡 فاز بعد أن ابتعد عن الخطر:');
    }
    schedule(game, () => deathwheelRound(game), 3_000);
  } else {
    await editGame(game, { embeds: [embed('✨ صندوق آمن!', `نجا **${playerName(game, game.selected)}** هذه المرة.\nستدور العجلة مجدداً.`)], components: [] });
    schedule(game, () => deathwheelRound(game), 3_000);
  }
}

async function beginHotxo(game) {
  game.status = 'playing';
  game.board = Array(9).fill(null);
  game.queue = [];
  game.turn = 0;
  game.moveCount = 0;
  showHotBoard(game);
}

async function beginHide(game) {
  game.status = 'playing';
  game.seeker = randomOf(game.players.map((player) => player.id));
  game.hiders = game.players.map((player) => player.id).filter((id) => id !== game.seeker);
  game.found = [];
  game.round = 0;
  await hideRound(game);
}

async function hideRound(game) {
  if (game.found.length === game.hiders.length) return winner(game, game.seeker, '🔎 عثر الباحث على الجميع وفاز:');
  if (game.round >= 3) {
    const remaining = game.hiders.filter((id) => !game.found.includes(id));
    await channelSend(game, {
      content: `🙈 انتهت الجولات! نجح المختبئون في الإفلات: ${remaining.map((id) => `<@${id}>`).join(' ')}`,
      allowedMentions: { users: remaining, parse: [] },
    });
    stop(game);
    return;
  }
  game.round += 1;
  game.hiding = new Map();
  game.guessing = false;
  await editGame(game, {
    embeds: [embed(`🙈 الجولة ${game.round}: اختبئوا`, `الباحث هو **${playerName(game, game.seeker)}**. المختبئون، اختاروا مكاناً سرياً خلال 20 ثانية. كل مختبئ يُعثر عليه يخرج من الاختباء.`)],
    components: [row(PLACE_NAMES.map((place, index) => btn(game.channelId, `hide:${game.round}:${index}`, place, ButtonStyle.Primary)))],
  });
  schedule(game, () => startSeek(game), 20_000);
}

async function startSeek(game) {
  if (game.status !== 'playing' || game.guessing) return;
  game.guessing = true;
  const remaining = game.hiders.filter((id) => !game.found.includes(id));
  if (remaining.some((id) => !game.hiding.has(id))) {
    for (const id of remaining) if (!game.hiding.has(id)) game.hiding.set(id, Math.floor(Math.random() * PLACE_NAMES.length));
  }
  await editGame(game, {
    embeds: [embed('🔎 دور الباحث!', `**${playerName(game, game.seeker)}**، اختر مكاناً واحداً لتبحث فيه.\nالأماكن: ${PLACE_NAMES.join('، ')}`)],
    components: [row(PLACE_NAMES.map((place, index) => btn(game.channelId, `seek:${game.round}:${index}`, place, ButtonStyle.Primary)))],
  });
  schedule(game, () => resolveSeek(game, null), 25_000);
}

async function resolveSeek(game, place) {
  if (!game.guessing) return;
  clearScheduled(game);
  game.guessing = false;
  const caught = place === null ? [] : game.hiders.filter((id) => !game.found.includes(id) && game.hiding.get(id) === place);
  game.found.push(...caught);
  if (game.found.length === game.hiders.length) {
    await editGame(game, { embeds: [embed('🔎 وجدهم!', `عثر الباحث على آخر المختبئين في **${PLACE_NAMES[place]}**.`)], components: [] });
    return schedule(game, () => winner(game, game.seeker, '🔎 فاز الباحث: عثر على الجميع: '), 2_000);
  }
  await editGame(game, {
    embeds: [embed(place === null ? 'انتهى وقت البحث' : caught.length ? '🔎 عُثر على مختبئ!' : '💨 المكان خالٍ', `${place === null ? 'لم يختر الباحث في الوقت المحدد.' : `المكان: **${PLACE_NAMES[place]}**.`}\n${caught.length ? `عُثر على: ${names(game, caught)}.` : 'لم يعثر على أحد.'}\nالمختبئون الباقون: ${names(game, game.hiders.filter((id) => !game.found.includes(id)))}`)],
    components: [],
  });
  schedule(game, () => hideRound(game), 3_000);
}

function countryScore(question, guess) {
  const normalizedGuess = normalize(guess);
  const guessedCode = COUNTRY_CODE_BY_ALIAS.get(normalizedGuess);
  if (!guessedCode) return 0;
  if (guessedCode === question.code) return 100;
  const neighborCodes = question.neighbors
    .map((country) => COUNTRY_CODE_BY_ALIAS.get(normalize(country)))
    .filter(Boolean);
  if (neighborCodes.includes(guessedCode)) return 90;

  const targetRegions = question.code === 'tr'
    ? ['آسيا', 'أوروبا']
    : [REGION_BY_CODE.get(question.code)].filter(Boolean);
  const guessRegions = [COUNTRY_REGION_BY_CODE.get(guessedCode)].filter(Boolean);
  if (!guessRegions.length) return 0;
  if (targetRegions.some((region) => guessRegions.includes(region))) return 45;
  if (targetRegions.some((region) => guessRegions.some((guessRegion) => ADJACENT_REGIONS[region]?.has(guessRegion)))) return 20;
  return 0;
}

function countryChallengeCard(game) {
  const hintIndex = Math.max(0, Math.min(game.hintsShown - 1, game.question.hints.length - 1));
  const nextHintIn = Math.max(0, 15 - (Math.floor((Date.now() - game.startedAt) / 1_000) % 15));
  const imageAttribution = game.question.imageCredit
    ? `\n📷 مصدر الصورة: ${game.question.imageCredit}`
    : '';
  return embed(
    `🌍 خمن الدولة — الجولة ${game.countryRound}/6`,
    `شاهدوا صورة المكان وحاولوا معرفة الدولة التي يقع فيها.\n\n## تلميح ${hintIndex + 1} / ${game.question.hints.length}\n${game.question.hints[hintIndex]}\n\nاكتب اسم الدولة في الدردشة. يمكن لكل لاعب إرسال عدة تخمينات، وتُحتسب أفضل نتيجة.\n⏱️ **ينتهي التحدي خلال دقيقة واحدة.**${imageAttribution}`,
    0x38bdf8,
  )
    .addFields(
      { name: '🏆 النقاط حسب القرب', value: '**100** نفس الدولة • **90** دولة مجاورة\n**45** نفس المنطقة • **20** منطقة قريبة • **0** بعيد', inline: true },
      { name: '💡 التلميح التالي', value: hintIndex < game.question.hints.length - 1 ? `بعد **${nextHintIn} ث**` : 'ظهرت كل التلميحات', inline: true },
      { name: '📍 الدليل', value: 'مكان أو معلم حقيقي', inline: true },
    )
    .setImage(game.question.image)
    .setFooter({ text: `dev.splosh • تحدي الجغرافيا • ${game.guesses.size} مشاركاً خمّن` });
}

async function revealCountryHint(game, hintIndex) {
  if (game.status !== 'playing' || game.hintsShown >= game.question.hints.length) return;
  game.hintsShown = Math.min(game.question.hints.length, hintIndex + 1);
  await editGame(game, { embeds: [countryChallengeCard(game)], components: [] });
}

async function beginCountry(game, question) {
  game.status = 'playing';
  game.question = question;
  game.guesses = new Map();
  game.startedAt = Date.now();
  game.hintsShown = 1;
  refreshIdleTimer(game);
  await editGame(game, { embeds: [countryChallengeCard(game)], components: [] });
  schedule(game, () => revealCountryHint(game, 1), 15_000);
  schedule(game, () => revealCountryHint(game, 2), 30_000);
  schedule(game, () => finishCountry(game), GUESS_MS);
}

async function finishCountry(game) {
  if (game.status !== 'playing') return;
  const scores = game.players.map((player) => ({
    id: player.id,
    ...(game.guesses.get(player.id) || { guess: '—', score: 0 }),
  }));
  for (const { id, score } of scores) {
    game.countryTotals.set(id, (game.countryTotals.get(id) || 0) + score);
  }
  const roundLeaderboard = [...scores]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((entry, index) => `${['🥇', '🥈', '🥉', '▪️', '▪️'][index]} <@${entry.id}> — **${entry.score}** نقطة`)
    .join('\n');
  const totalLeaderboard = [...game.countryTotals.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score)
    .map((entry, index) => `${['🥇', '🥈', '🥉'][index] || '▪️'} <@${entry.id}> — **${entry.score}** نقطة`)
    .join('\n');
  const results = roundLeaderboard || 'ماكو تخمينات مسجلة بهالجولة.';
  game.status = 'transition';
  const isFinalRound = game.countryRound === 6;
  await channelSend(game, {
    embeds: [embed(
      isFinalRound ? '🏆 انتهت لعبة خمن الدولة' : `🌍 نتيجة الجولة ${game.countryRound}/6`,
      `المكان: **${game.question.place}** — **${game.question.country}**.\n\n**نقاط هذه الجولة:**\n${results}\n\n**الترتيب الكلي:**\n${totalLeaderboard}`,
      0x38bdf8,
    ).setImage(game.question.image)],
    allowedMentions: { users: game.players.map((player) => player.id), parse: [] },
  });
  if (isFinalRound) {
    const highScore = Math.max(0, ...game.countryTotals.values());
    const winners = [...game.countryTotals.entries()]
      .filter(([, score]) => score === highScore)
      .map(([id]) => id);
    await channelSend(game, {
      content: `🏆 ${winners.length > 1 ? 'تعادل بالفوز بين' : 'فاز'} ${winners.map((id) => `<@${id}>`).join('، ')} بأعلى مجموع: **${highScore}** نقطة!`,
      allowedMentions: { users: winners, parse: [] },
    });
    stop(game);
    return;
  }
  game.countryRound += 1;
  schedule(game, () => startAiChallenge(game, () => generateCountryQuestion(game), (question) => beginCountry(game, question)), 3_000);
}

function svgForDraw(drawing, count) {
  const visibleParts = drawing.parts.slice(0, count);
  const glowStrokes = visibleParts.map((part) => `<path d="${part}" fill="none" stroke="#62e8dc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".3" filter="url(#glow)"/>`).join('');
  const strokes = visibleParts.map((part) => `<path d="${part}" fill="none" stroke="url(#ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 100 100"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#081525"/><stop offset="1" stop-color="#123c50"/></linearGradient><linearGradient id="ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eafffb"/><stop offset="1" stop-color="#7be7d8"/></linearGradient><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#b7d9e8" stroke-opacity=".07" stroke-width=".18"/></pattern><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter><radialGradient id="spot"><stop stop-color="#27c7bf" stop-opacity=".17"/><stop offset="1" stop-color="#27c7bf" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" rx="8" fill="url(#bg)"/><rect x="3" y="3" width="94" height="94" rx="6" fill="url(#grid)" stroke="#83ded7" stroke-opacity=".35" stroke-width=".45"/><circle cx="50" cy="46" r="42" fill="url(#spot)"/><path d="M9 86H91" stroke="#93b8ca" stroke-opacity=".4" stroke-width=".35"/><circle cx="10" cy="10" r="1" fill="#7be7d8"/><circle cx="90" cy="10" r="1" fill="#7be7d8"/>${glowStrokes}${strokes}</svg>`;
}

async function drawAttachment(game) {
  const drawing = game.drawing;
  const svg = Buffer.from(svgForDraw(drawing, game.stage));
  if (sharp) {
    const png = await sharp(svg).png().toBuffer();
    return new AttachmentBuilder(png, { name: 'fizbo-draw.png' });
  }
  return new AttachmentBuilder(svg, { name: 'fizbo-draw.svg' });
}

async function showDrawStage(game) {
  const attachment = await drawAttachment(game);
  const filename = sharp ? 'fizbo-draw.png' : 'fizbo-draw.svg';
  await editGame(game, {
    embeds: [embed(`🎨 خمن الرسمة — المرحلة ${game.stage}/${game.drawing.parts.length}`, `اكتبوا تخمينكم في الدردشة. أول إجابة صحيحة تفوز.\nتكشف الرسمة جزءاً جديداً بعد كل مرحلة.`).setImage(`attachment://${filename}`)],
    files: [attachment],
    attachments: [],
    components: [],
  });
}

async function beginDraw(game, drawing) {
  game.status = 'playing';
  game.drawing = drawing;
  game.stage = 1;
  game.answerKey = new Set([game.drawing.answer, ...game.drawing.aliases].map(normalize));
  await showDrawStage(game);
  schedule(game, () => nextDrawStage(game), 7_000);
}

async function nextDrawStage(game) {
  if (game.stage >= game.drawing.parts.length) {
    await channelSend(game, { content: `🎨 انتهى الوقت! كانت الرسمة: **${game.drawing.answer}**.` });
    stop(game);
    return;
  }
  game.stage += 1;
  await showDrawStage(game);
  schedule(game, () => nextDrawStage(game), 7_000);
}

function wordScore(question, guess) {
  const normalized = normalize(guess);
  if (!normalized) return 0;
  if ([question.answer, ...question.aliases].some((word) => normalize(word) === normalized)) return 100;
  if (question.close.some((word) => normalize(word) === normalized)) return 80;
  if (question.related.some((word) => normalize(word) === normalized)) return 55;
  const target = normalize(question.answer);
  const overlap = [...new Set(normalized.replace(/\s/g, ''))].filter((letter) => target.includes(letter)).length;
  return overlap ? Math.min(25, Math.round((overlap / Math.max(target.length, normalized.length)) * 25)) : 0;
}

async function beginWord(game, question) {
  game.status = 'playing';
  game.question = question;
  game.guesses = new Map();
  await editGame(game, {
    embeds: [embed('🧠 تحدي Gemini — خمن الكلمة', 'أنشأ Gemini كلمة سرية وتلميحاتها. اكتبوا تخميناتكم في الدردشة خلال دقيقة؛ يمكنكم تغيير التخمين، وتُحسب أقرب كلمة في المعنى.')],
    components: [],
  });
  schedule(game, () => finishWord(game), GUESS_MS);
}

async function finishWord(game) {
  const scores = [...game.guesses.entries()].map(([id, guess]) => ({ id, guess, score: wordScore(game.question, guess) }));
  const high = Math.max(0, ...scores.map((entry) => entry.score));
  const winners = scores.filter((entry) => entry.score === high && high > 0);
  if (!winners.length) {
    await channelSend(game, { content: `🧠 الكلمة كانت **${game.question.answer}**؛ لم تصل أي إجابة إلى معنى قريب.` });
    stop(game);
    return;
  }
  await channelSend(game, {
    content: `🧠 الكلمة السرية: **${game.question.answer}**. أقرب تخمين: ${winners.map((entry) => `<@${entry.id}> («${entry.guess}»، ${entry.score} نقطة)`).join('، ')}`,
    allowedMentions: { users: winners.map((entry) => entry.id), parse: [] },
  });
  stop(game);
}

async function begin(game) {
  switch (game.key) {
    case 'xo_tournament':
      game.status = 'playing';
      game.roundPlayers = game.players.map((player) => player.id);
      showBracketMatch(game);
      break;
    case 'chairs': await beginChairs(game); break;
    case 'rps_tournament': game.status = 'playing'; game.alive = game.players.map((player) => player.id); game.round = 0; startRpsRound(game); break;
    case 'dice_teams': await beginDice(game); break;
    case 'deathwheel': await beginDeathwheel(game); break;
    case 'hotxo': await beginHotxo(game); break;
    case 'hideandseek': await beginHide(game); break;
    case 'guessthecountry':
      game.countryRound = 1;
      game.countryTotals = new Map(game.players.map((player) => [player.id, 0]));
      game.countryQuestions = shuffle(ALL_COUNTRY_QUESTIONS).slice(0, 6);
      await startAiChallenge(game, () => generateCountryQuestion(game), (question) => beginCountry(game, question));
      break;
    case 'guessthedraw': await startAiChallenge(game, generateDrawing, (drawing) => beginDraw(game, drawing)); break;
    case 'guesstheword': await startAiChallenge(game, generateWordQuestion, (question) => beginWord(game, question)); break;
    default: return false;
  }
  if (games.get(game.channelId) !== game || game.status !== 'playing') return true;
  refreshIdleTimer(game);
  return true;
}

function minimum(game) {
  return game.key === 'hotxo' ? 2 : game.key === 'xo_tournament' || game.key === 'chairs' || game.key === 'hideandseek' ? 3 : 2;
}

async function privateReply(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, ephemeral: true, allowedMentions: { parse: [] } });
  } else {
    await interaction.reply({ content, ephemeral: true, allowedMentions: { parse: [] } });
  }
}

async function ack(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
}

async function handleLobbyComponent(game, interaction, action) {
  if (action === 'join') {
    if (game.players.some((player) => player.id === interaction.user.id)) return privateReply(interaction, 'أنت منضم بالفعل.');
    const maximum = game.key === 'hotxo' ? 2 : game.key === 'chairs' ? 26 : 50;
    if (game.players.length >= maximum) return privateReply(interaction, `وصلت اللعبة إلى الحد الأقصى (${maximum} لاعباً).`);
    game.players.push({ id: interaction.user.id, name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username });
    await ack(interaction);
    await editGame(game, lobbyPayload(game));
    return;
  }
  if (action === 'leave') {
    const index = game.players.findIndex((player) => player.id === interaction.user.id);
    if (index < 0) return privateReply(interaction, 'لست ضمن اللاعبين.');
    game.players.splice(index, 1);
    await ack(interaction);
    await editGame(game, lobbyPayload(game));
    return;
  }
  if (action === 'begin') {
    return privateReply(interaction, 'اللعبة تبدأ تلقائياً بعد انتهاء مؤقّت التسجيل؛ ماكو زر بدء.');
  }
}

async function handlePlayingComponent(game, interaction, action) {
  const id = interaction.user.id;
  const [kind, value, extra] = action.split(':');
  if (game.status !== 'playing') return privateReply(interaction, 'انتهت اللعبة أو لم تبدأ بعد؛ هذا الزر قديم.');
  refreshIdleTimer(game);
  if (kind === 'cell') {
    const expectedToken = game.key === 'xo_tournament'
      ? `${game.matchIndex}-${game.matchAttempt}-${game.moveCount}-${game.turn}`
      : `${game.moveCount}-${game.turn}`;
    if (value !== expectedToken) return privateReply(interaction, 'هذه اللوحة قديمة؛ استخدم الأزرار الحالية.');
    const cell = Number(extra);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return privateReply(interaction, 'هذه الخانة غير صالحة.');
    if (game.key === 'xo_tournament') {
      if (!game.matchPlayers.includes(id)) return privateReply(interaction, 'أنت لست لاعباً في هذه المباراة.');
      if (game.matchPlayers[game.turn] !== id) return privateReply(interaction, 'ليس دورك.');
      if (game.board[cell]) return privateReply(interaction, 'هذه الخانة مشغولة.');
      game.board[cell] = MARKS[game.turn];
      const winnerMark = lineWinner(game.board);
      await ack(interaction);
      if (winnerMark) {
        const matchWinner = game.matchPlayers[winnerMark === MARKS[0] ? 0 : 1];
        game.nextRound.push(matchWinner);
        await editGame(game, {
          embeds: [embed('🏆 انتهت المباراة!', `فاز **${playerName(game, matchWinner)}** وتأهل إلى الجولة التالية.`)],
          components: setBoardComponents(game, game.board, true),
        });
        game.matchIndex += 1;
        game.matchAttempt = 0;
        schedule(game, () => showBracketMatch(game), 2_500);
      } else if (game.board.every(Boolean)) {
        await editGame(game, {
          embeds: [embed('🤝 تعادل — إعادة المباراة', 'امتلأ اللوح بلا فائز. مباراة جديدة بين اللاعبين نفسيهما.')],
          components: setBoardComponents(game, game.board, true),
        });
        schedule(game, () => {
          game.board = Array(9).fill(null);
          game.turn = 0;
          game.matchAttempt += 1;
          showBracketMatch(game);
        }, 2_000);
      } else {
        game.turn = 1 - game.turn;
        game.moveCount += 1;
        await editGame(game, {
          embeds: [embed('🏆 إكس أو — المباراة الجارية', `❌ ${playerName(game, game.matchPlayers[0])} ضد ⭕ ${playerName(game, game.matchPlayers[1])}\nالدور على **${playerName(game, game.matchPlayers[game.turn])}**.`)],
          components: setBoardComponents(game, game.board),
        });
      }
      return;
    }
    if (game.players[game.turn].id !== id) return privateReply(interaction, 'ليس دورك.');
    if (game.board[cell]) return privateReply(interaction, 'هذه الخانة مشغولة.');
    game.board[cell] = MARKS[game.turn];
    game.queue.push(cell);
    if (game.queue.length > 6) game.board[game.queue.shift()] = null;
    const winMark = lineWinner(game.board);
    await ack(interaction);
    if (winMark) {
      const idWinner = game.players[winMark === MARKS[0] ? 0 : 1].id;
      await editGame(game, { embeds: [embed('🔥 إكس أو الساخنة', `فاز **${playerName(game, idWinner)}** بثلاثة على التوالي!`)], components: setBoardComponents(game, game.board, true) });
      return winner(game, idWinner, '🔥 فاز بإكس أو الساخنة:');
    }
    game.turn = 1 - game.turn;
    game.moveCount += 1;
    showHotBoard(game);
    return;
  }
  if (kind === 'seat') {
    if (!game.alive.includes(id)) return privateReply(interaction, 'لست من الناجين في هذه الجولة.');
    if (Number(value) !== game.round || game.roundResolving) return privateReply(interaction, 'انتهت هذه الجولة؛ استخدم أزرار الجولة الحالية.');
    const seat = Number(extra);
    if (!Number.isInteger(seat) || seat < 0 || seat >= game.seatCount) return privateReply(interaction, 'المقعد غير صالح.');
    if (game.seatPicks.has(id)) return privateReply(interaction, 'اخترت مقعداً بالفعل؛ لا يمكن تغييره.');
    game.seatPicks.set(id, seat);
    await privateReply(interaction, `حُفظ اختيارك: مقعد ${seat + 1}.`);
    if (game.seatPicks.size === game.alive.length) await resolveChairs(game);
    return;
  }
  if (kind === 'rps') {
    if (Number(value) !== game.round || game.roundResolving) return privateReply(interaction, 'انتهت هذه الجولة؛ استخدم أزرار الجولة الحالية.');
    if (!game.alive.includes(id)) return privateReply(interaction, 'خرجت من البطولة.');
    if (game.choices.has(id)) return privateReply(interaction, 'سجلت اختيارك بالفعل.');
    const choices = { rock: 'حجر', paper: 'ورقة', scissors: 'مقص' };
    if (!choices[extra]) return privateReply(interaction, 'اختيار غير صالح.');
    game.choices.set(id, choices[extra]);
    await privateReply(interaction, 'تم تسجيل حركتك سرّاً. انتظر بقية اللاعبين.');
    resolveRps(game);
    return;
  }
  if (kind === 'roll') {
    if (Number(value) !== game.round || game.roundResolving) return privateReply(interaction, 'انتهت هذه الجولة؛ استخدم أزرار الجولة الحالية.');
    if (!game.players.some((player) => player.id === id)) return privateReply(interaction, 'لست لاعباً في اللعبة.');
    if (game.rolls.has(id)) return privateReply(interaction, 'رميت النرد بالفعل في هذه الجولة.');
    const valueRoll = Math.floor(Math.random() * 6) + 1;
    game.rolls.set(id, valueRoll);
    await privateReply(interaction, `🎲 نتيجتك: **${valueRoll}**. انتظر بقية الفريقين.`);
    if (game.rolls.size === game.players.length) await resolveDice(game);
    return;
  }
  if (kind === 'spin') {
    if (Number(value) !== game.round || game.wheelPhase !== 'spin') return privateReply(interaction, 'هذه العجلة لم تعد نشطة.');
    if (id !== game.hostId) return privateReply(interaction, 'منظّم اللعبة فقط يدير العجلة.');
    await ack(interaction);
    await spinDeathwheel(game);
    return;
  }
  if (kind === 'box') {
    if (Number(value) !== game.round || game.wheelPhase !== 'box') return privateReply(interaction, 'انتهى اختيار الصندوق.');
    const box = Number(extra);
    if (![0, 1, 2].includes(box) || !game.selected) return privateReply(interaction, 'لا يوجد اختيار صندوق جارٍ.');
    if (id !== game.selected) return privateReply(interaction, 'العجلة اختارت لاعباً آخر؛ هو وحده يختار الصندوق.');
    await ack(interaction);
    await chooseDeathBox(game, interaction, box);
    return;
  }
  if (kind === 'hide') {
    if (Number(value) !== game.round) return privateReply(interaction, 'انتهت مرحلة الاختباء؛ استخدم أزرار الجولة الحالية.');
    if (!game.hiders.includes(id) || game.found.includes(id)) return privateReply(interaction, 'أنت لست مختبئاً في هذه الجولة.');
    if (game.guessing) return privateReply(interaction, 'انتهى وقت الاختباء.');
    if (game.hiding.has(id)) return privateReply(interaction, 'اخترت مكاناً بالفعل.');
    const place = Number(extra);
    if (!Number.isInteger(place) || place < 0 || place >= PLACE_NAMES.length) return privateReply(interaction, 'المكان غير صالح.');
    game.hiding.set(id, place);
    await privateReply(interaction, 'اخترت مخبأك بسرية. انتظر الباحث.');
    return;
  }
  if (kind === 'seek') {
    if (Number(value) !== game.round) return privateReply(interaction, 'انتهت مرحلة البحث؛ استخدم أزرار الجولة الحالية.');
    if (id !== game.seeker) return privateReply(interaction, 'الباحث وحده يستطيع اختيار مكان البحث.');
    if (!game.guessing) return privateReply(interaction, 'انتهت مرحلة البحث.');
    const place = Number(extra);
    if (!Number.isInteger(place) || place < 0 || place >= PLACE_NAMES.length) return privateReply(interaction, 'المكان غير صالح.');
    await ack(interaction);
    await resolveSeek(game, place);
    return;
  }
  if (kind === 'unknown') return privateReply(interaction, 'هذا الزر غير صالح.');
  return privateReply(interaction, 'هذا الزر لا يخص هذه المرحلة.');
}

const SERVER_GAME_CHOICES = GAME_CATALOG.map(([value, name]) => ({ name, value }));

async function handleServerGameStart(interaction, gameKey) {
  const key = String(gameKey || '').toLowerCase();
  const catalogEntry = GAME_CATALOG.find(([value]) => value === key);
  if (!catalogEntry) return false;
  if (!interaction.guildId || !interaction.channel || !interaction.channelId) {
    await privateReply(interaction, 'هذه اللعبة تحتاج قناة نصية.');
    return true;
  }
  if (games.has(interaction.channelId)) {
    await privateReply(interaction, 'هناك لعبة من مجموعة ألعاب فيزبو جارية بالفعل في هذه القناة.');
    return true;
  }
  const game = {
    key,
    title: catalogEntry[1],
    channelId: interaction.channelId,
    hostId: interaction.user.id,
    players: [],
    status: 'lobby',
    lobbyDeadline: Date.now() + LOBBY_MS,
    timers: new Set(),
    message: null,
    banner: gameBanner(
      catalogEntry[1],
      'بطاقة افتتاحية مصممة خصيصاً لهذه اللعبة',
      GAME_BANNER_THEMES[key],
    ),
  };
  games.set(game.channelId, game);
  try {
    await interaction.reply(safePayload(lobbyPayload(game)));
    game.message = await interaction.fetchReply();
    game.bannerAttachmentId = game.message.attachments.find(
      (attachment) => attachment.name === game.banner.name,
    )?.id;
    if (games.get(game.channelId) !== game) {
      await editGame(game, {
        embeds: [embed('⛔ تم إيقاف اللعبة', `تم إيقاف **${game.title}** بواسطة مشرف.`, 0xed4245)],
        components: [],
        attachments: [],
        files: [],
        allowedMentions: { parse: [] },
      });
      return true;
    }
    schedule(game, () => expireLobby(game), LOBBY_MS);
    const countdown = () => {
      if (game.status !== 'lobby' || games.get(game.channelId) !== game) return;
      void editGame(game, lobbyPayload(game));
      schedule(game, countdown, 5_000);
    };
    schedule(game, countdown, 5_000);
  } catch (error) {
    stop(game);
    throw error;
  }
  return true;
}

function hasServerGameInChannel(channelId) {
  return games.has(channelId);
}

async function stopServerGame(channelId) {
  const game = games.get(channelId);
  if (!game) return false;
  stop(game);
  if (game.message) {
    await editGame(game, {
      embeds: [embed('⛔ تم إيقاف اللعبة', `تم إيقاف **${game.title}** بواسطة مشرف.`, 0xed4245)],
      components: [],
      attachments: [],
      files: [],
      allowedMentions: { parse: [] },
    });
  }
  return true;
}

async function handleServerGameComponent(interaction) {
  const customId = interaction.customId;
  if (typeof customId !== 'string' || !customId.startsWith(PREFIX)) return false;
  const payload = customId.slice(PREFIX.length);
  const separator = payload.indexOf(':');
  if (separator < 0) {
    await privateReply(interaction, 'زر اللعبة غير صالح.');
    return true;
  }
  const channelId = payload.slice(0, separator);
  const action = payload.slice(separator + 1);
  const game = games.get(channelId);
  if (!game || interaction.channelId !== channelId || !game.message || interaction.message.id !== game.message.id) {
    await privateReply(interaction, 'انتهت هذه اللعبة أو أن الزر قديم.');
    return true;
  }
  if (!action.includes(':') && game.status === 'lobby') {
    await handleLobbyComponent(game, interaction, action);
    return true;
  }
  if (game.status === 'lobby') {
    await privateReply(interaction, 'ابدأ اللعبة أولاً.');
    return true;
  }
  await handlePlayingComponent(game, interaction, action);
  return true;
}

async function handleServerGameMessage(message) {
  if (!message || message.author?.bot || !message.channelId) return false;
  const game = games.get(message.channelId);
  if (!game || game.status !== 'playing' || !['guessthecountry', 'guessthedraw', 'guesstheword'].includes(game.key)) return false;
  const guess = String(message.content || '').trim().slice(0, 100);
  if (!guess) return true;
  if (game.key === 'guessthecountry') {
    if (!game.players.some((player) => player.id === message.author.id)) return true;
    const score = countryScore(game.question, guess);
    const previous = game.guesses.get(message.author.id);
    if (!previous || score > previous.score) {
      game.guesses.set(message.author.id, { guess, score });
    }
    const bestScore = Math.max(score, previous?.score || 0);
    try {
      await message.reply({
        content: `نقاط تخمينك: **${score}/100** • أفضل نقاطك بالجولة: **${bestScore}/100**`,
        allowedMentions: { repliedUser: false, parse: [] },
      });
    } catch (error) {
      console.error('[fizbo-server-games] country score reply failed:', error);
    }
  } else if (game.key === 'guessthedraw') {
    if (!game.players.some((player) => player.id === message.author.id)) return true;
    if (game.answerKey.has(normalize(guess))) {
      await channelSend(game, {
        content: `🎨 أول إجابة صحيحة: <@${message.author.id}> خمن **${game.drawing.answer}** وفاز!`,
        allowedMentions: { users: [message.author.id], parse: [] },
      });
      stop(game);
    }
  } else {
    if (!game.players.some((player) => player.id === message.author.id)) return true;
    game.guesses.set(message.author.id, guess);
  }
  return true;
}

module.exports = {
  SERVER_GAME_CHOICES,
  hasServerGameInChannel,
  stopServerGame,
  handleServerGameStart,
  handleServerGameComponent,
  handleServerGameMessage,
  countryScore,
};
