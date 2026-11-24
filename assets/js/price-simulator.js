// くわしい料金シミュレーター (/price-simulator/)
// 宿泊・BBQ・給食・サンド・少人数プランの料金は pricing-board.js が公開する
// window.KATASHO_PRICING（唯一の定義元）から読む。ここに書くのは、/play/option/ に掲載されている
// オプション価格・割引率・祝日などの「転記」だけ（出典は各定数のコメント参照）。
(function () {
  'use strict';

  var P = window.KATASHO_PRICING;
  var DATA = window.KATASHO_DATA || {};
  var form = document.getElementById('sim-form');
  if (!form) { return; }
  if (!P) {
    var errEl = document.getElementById('sim-error');
    if (errEl) { errEl.hidden = false; }
    return;
  }

  function fmt(v) { return Math.round(v).toLocaleString('ja-JP') + '円'; }
  function $(id) { return document.getElementById(id); }

  // ---- 転記データ（/play/option/ の記載） ---------------------------------
  var MAX_NIGHTS = 5;
  var MEAL_MIN_SERVINGS = 5; // 食事メニューの「5人分〜」
  var DISCOUNT_PERCENT = { renpaku: 5, chiiki: 5, repeat: 5 }; // 連泊割・地域割・リピート割とも、宿泊の基本料金から5%OFF（お食事・オプションは対象外）
  var DRINK = { label: '飲み放題2時間', price: 1500 }; // 1,500円/人（税込）
  var SEASON_LABEL = { weekday: '平日・オフシーズン', holiday: '土日祝・ハイシーズン' }; // 2026-11-24 一度「平日／土日祝」にしたが、オーナー判断でこの表記に戻した

  // 昼食（チェックイン前）: 給食は MEALS.kyushoku（全年齢同額）、弁当は 1,250円/人（子ども料金の記載なし）
  var LUNCHES = [
    { id: 'byo', label: '不要・持ち込み' }, // 2026-11-24 食べない人も選べる言い方に（オーナー指摘）
    { id: 'kyushoku', label: '懐かしの給食', mealKey: 'kyushoku' },
    { id: 'bento', label: '贅沢しずおか四色弁当', flat: 1250 }
  ];
  // 夕食: 子ども料金は夕食のみ（小学生30%OFF・3〜5歳50%OFF、FAQ記載・2026-11-19オーナー確認）。
  // BBQ は MEALS.bbq、それ以外は大人料金 × KID_RATIO で計算（kidRates）。
  // 少人数プランは「夕食オプションはBBQのみ」。
  var DINNERS = [
    { id: 'byo', label: '不要・持ち込み（BBQも可）', compactOk: true },
    { id: 'bbq', label: 'BBQ（満腹コース）', mealKey: 'bbq', compactOk: true },
    { id: 'sukiyaki', label: '【冬季限定】すき焼き', flat: 5000, kidRates: true, months: [11, 12, 1, 2, 3], seasonNote: '【冬季限定】すき焼きは11月〜3月のみの提供です' },
    { id: 'curry', label: '林間学校式カレー', flat: 2000, kidRates: true, note: 'お客様自身で調理していただきます' },
    { id: 'bento', label: '贅沢しずおか四色弁当', flat: 1250, kidRates: true }
  ];
  var KID_RATIO = { elem: 0.7, pre: 0.5 };
  var BREAKFAST = { label: 'サンドイッチ朝食', mealKey: 'sando' };
  // 2026-11-24 昼食・夕食は写真つきカードで選ぶ（オーナー判断）。写真は /play/option/ などで使っている写真を
  // カード用に縮めたサムネイル（480×360のJPG、assets/img/meal-thumbs/）。元の大きい写真は読まない。
  // 写真がないもの（不要・持ち込み、すき焼き＝今の写真は別の料理）は、薄い色の枠に文字だけ出す。
  var MEAL_PHOTOS = {
    kyushoku: { src: '/assets/img/meal-thumbs/kyushoku.jpg', w: 480, h: 360 },
    bento: { src: '/assets/img/meal-thumbs/bento.jpg', w: 480, h: 360 },
    bbq: { src: '/assets/img/meal-thumbs/bbq.jpg', w: 480, h: 360 },
    curry: { src: '/assets/img/meal-thumbs/curry.jpg', w: 480, h: 360 }
  };
  var MEAL_NO_PHOTO = { byo: '不要・持ち込み', sukiyaki: '写真準備中' };
  // 2026-11-24 朝食・飲み放題・オプションの行にも小さな写真（オーナー指示：写真を付けられるものは全部付ける）。
  // /play/option/ で使っている写真を同じ 480×360 のサムネイルに縮めたもの。写真がないものは「写真準備中」の枠。
  var ROW_PHOTOS = {
    sando: '/assets/img/meal-thumbs/sando.jpg',
    drinks: '/assets/img/meal-thumbs/drinks.jpg',
    gym: '/assets/img/meal-thumbs/gym.jpg',
    surf: '/assets/img/meal-thumbs/surf.jpg',
    sauna: '/assets/img/meal-thumbs/sauna.jpg',
    beer: '/assets/img/meal-thumbs/beer.jpg',
    room: '/assets/img/meal-thumbs/room.jpg'
  };

  // オプション（価格・単位は /play/option/ の記載）。
  var OPTIONS = [
    {
      id: 'gym', name: '体育館の延長利用', price: 2000, unit: '/時間（税込）',
      note: DATA.gym && DATA.gym.noteMid ? DATA.gym.noteMid : '体育館は市営のため事前予約が必要です。',
      fields: [{ key: 'hours', label: '延長時間', unit: '時間', max: 10 }]
    },
    {
      id: 'surf', name: 'サーフィン教室', price: 8000, from: true, unit: '/人（税込）',
      // 2026-11-24 経緯の文は名前の横のⓘへ（P79）。料金が変わる一文は表に残す
      info: { label: 'サーフィン教室について', text: '地元のサーフショップの方から、サーフィンとボディボードのレクチャーを受けられます（チェックアウト後の参加もできます）。' },
      note: '料金は受け入れてくださるサーフショップによって変わるため、合計は目安になります。',
      fields: [{ key: 'people', label: '参加人数', unit: '人', max: 'payers' }]
    },
    {
      id: 'sauna', name: 'プライベート貸切サウナ', price: 1000, minCharge: 4000, unit: '/人・時間（税込）',
      note: '最低利用金額は4,000円です。',
      fields: [
        { key: 'people', label: '利用人数', unit: '人', max: 'payers' },
        { key: 'hours', label: '利用時間', unit: '時間', max: 6 }
      ]
    },
    {
      // 2026-11-24 入力欄はステップ4の「お飲み物」に置き、内訳も「お食事」の欄に出す（group: 'drink'）。計算・合計は今までどおり
      id: 'beer', name: '生ビール10L', price: 11000, unit: '/樽（税込）', group: 'drink',
      note: 'ジョッキ約25杯分です。',
      fields: [{ key: 'kegs', label: '樽の数', unit: '樽', max: 10 }]
    },
    {
      id: 'room', name: '部屋分けオプション', quote: true, unitText: '5,000円/追加1部屋・26名以上は1部屋無料',
      // 2026-11-24 「合計には含めず」は合計欄の注記（P91）と重なるので外した（P82）
      // 2026-11-24 オーナー確認：少人数プランも「少人数用の追加部屋を1部屋まで」使える（料金は未確認なので出さない）
      compactUnitText: '少人数プランの追加部屋の料金は予約時にご確認ください',
      compactNote: '少人数プランは追加部屋1部屋まで',
      note: '追加部屋は最大2部屋です。泊数ごとの扱いなどは予約時にご確認いただくため、「お見積り」としています。',
      fields: [{ key: 'rooms', label: '追加する部屋数', unit: '部屋', max: 2, compactMax: 1 }]
    }
  ];

  var OPT = {};
  OPTIONS.forEach(function (def) { OPT[def.id] = def; });

  // ---- 日付・料金区分の判定 --------------------------------------------
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  // ハイシーズン期間。夏休み・春休みの日付は料金ページの注記どおり。
  // ゴールデンウィーク・年末年始は注記に日付がないため目安の日付（approx）。
  var HIGH_PERIODS = [
    { name: 'ゴールデンウィーク', from: 429, to: 505, text: '4/29〜5/5', approx: true },
    { name: '夏休み', from: 715, to: 930, text: '7/15〜9/30' },
    { name: '年末年始', from: 1228, to: 103, text: '12/28〜1/3' },
    { name: '春休み', from: 201, to: 410, text: '2/1〜4/10' }
  ];
  // 日本の祝日（2026〜2027年・振替休日と国民の休日を含む）
  var HOLIDAYS = {
    '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日', '2026-02-23': '天皇誕生日',
    '2026-03-20': '春分の日', '2026-04-29': '昭和の日', '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日',
    '2026-05-05': 'こどもの日', '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
    '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日',
    '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
    '2027-01-01': '元日', '2027-01-11': '成人の日', '2027-02-11': '建国記念の日', '2027-02-23': '天皇誕生日',
    '2027-03-21': '春分の日', '2027-03-22': '振替休日', '2027-04-29': '昭和の日', '2027-05-03': '憲法記念日',
    '2027-05-04': 'みどりの日', '2027-05-05': 'こどもの日', '2027-07-19': '海の日', '2027-08-11': '山の日',
    '2027-09-20': '敬老の日', '2027-09-23': '秋分の日', '2027-10-11': 'スポーツの日', '2027-11-03': '文化の日',
    '2027-11-23': '勤労感謝の日'
  };
  var HOLIDAY_YEARS = [2026, 2027];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    if (!m) { return null; }
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) { return null; }
    return d;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateLabel(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WEEKDAYS[d.getDay()] + ')'; }
  function dateLabelW(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WEEKDAYS[d.getDay()] + '）'; }
  function inPeriod(md, period) {
    return period.from <= period.to ? (md >= period.from && md <= period.to) : (md >= period.from || md <= period.to);
  }

  // その日の宿泊（チェックイン日の夜）が「土日祝・ハイシーズン」か「平日・オフシーズン」かの目安を返す
  function classifyNight(dateStr) {
    var d = parseDate(dateStr);
    if (!d) { return null; }
    var md = (d.getMonth() + 1) * 100 + d.getDate();
    var reasons = [];
    var holiday = HOLIDAYS[ymd(d)];
    if (holiday) { reasons.push('祝日（' + holiday + '）'); }
    HIGH_PERIODS.forEach(function (period) {
      if (inPeriod(md, period)) {
        reasons.push(period.name + '期間（' + (period.approx ? '目安 ' : '') + period.text + '）');
      }
    });
    if (d.getDay() === 6) { reasons.push('土曜日'); }
    if (d.getDay() === 0) { reasons.push('日曜日'); }
    return {
      season: reasons.length ? 'holiday' : 'weekday',
      reasons: reasons,
      holidayDataMissing: HOLIDAY_YEARS.indexOf(d.getFullYear()) === -1
    };
  }

  // ---- 計算（純粋関数。画面からもコンソールからも使える） --------------------
  function clampInt(v, min, max) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { n = min; }
    return Math.max(min, Math.min(max, n));
  }
  function mealPrices(def) {
    if (def.mealKey) { return P.MEALS[def.mealKey]; }
    if (def.kidRates) {
      return { adult: def.flat, elem: Math.round(def.flat * KID_RATIO.elem), pre: Math.round(def.flat * KID_RATIO.pre) };
    }
    return { adult: def.flat, elem: def.flat, pre: def.flat };
  }
  function isFlat(pr) { return pr.adult === pr.elem && pr.elem === pr.pre; }
  function findDef(list, id) {
    for (var i = 0; i < list.length; i += 1) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }
  function describeCounts(counts, pr) {
    if (isFlat(pr)) { return (counts.adult + counts.elem + counts.pre) + '人×' + fmt(pr.adult); }
    var parts = [];
    if (counts.adult > 0) { parts.push('おとな' + counts.adult + '人×' + fmt(pr.adult)); }
    if (counts.elem > 0) { parts.push('小学生' + counts.elem + '人×' + fmt(pr.elem)); }
    if (counts.pre > 0) { parts.push('3〜5歳' + counts.pre + '人×' + fmt(pr.pre)); }
    return parts.join('・');
  }

  function defaultState() {
    var arr = function (v) { var a = []; for (var i = 0; i < MAX_NIGHTS; i += 1) { a.push(v); } return a; };
    return {
      plan: 'standard',
      checkin: '',
      checkout: '',
      datesMode: false,
      nights: 1,
      seasons: arr('weekday'),
      people: { adult: 10, elem: 0, pre: 0, infant: 0 },
      lunch: 'byo',
      lunchCount: null, // 昼食の人数（null＝料金のかかる全員）
      dinner: arr('byo'),
      dinnerCount: arr(null), // 夕食の人数（null＝料金のかかる全員）
      drink: arr(false),
      breakfast: arr(false),
      opts: { gym: { hours: 0 }, surf: { people: 0 }, sauna: { people: 0, hours: 0 }, beer: { kegs: 0 }, room: { rooms: 0 } },
      local: false,
      repeat: false
    };
  }

  function calculate(s) {
    var d0 = parseDate(s.checkin);
    var people = s.people;
    var payers = people.adult + people.elem + people.pre;
    var totalPeople = payers + people.infant;
    var compact = s.plan === 'compact' && totalPeople <= P.COMPACT_HARD_MAX;
    var counts = { adult: people.adult, elem: people.elem, pre: people.pre };
    var mealsOk = payers >= MEAL_MIN_SERVINGS;
    var res = {
      compact: compact, payers: payers, totalPeople: totalPeople,
      nights: [], meals: [], options: [], quotes: [], notes: [], approx: false,
      lodgingTotal: 0, mealTotal: 0, optionTotal: 0, discount: null, total: 0, perPerson: 0
    };
    function note(text) { if (res.notes.indexOf(text) === -1) { res.notes.push(text); } }
    function nightDate(i) { return d0 ? dateLabel(addDays(d0, i)) : (i + 1) + '泊目の夜'; }

    // 宿泊（1泊ごとに料金区分の単価と最低利用金額を適用）
    var anyFloor = false;
    for (var i = 0; i < s.nights; i += 1) {
      var season = s.seasons[i] === 'holiday' ? 'holiday' : 'weekday';
      var rates = P.getRates(season, compact);
      var sum = people.adult * rates.adult + people.elem * rates.elem + people.pre * rates.pre;
      var floor = rates.floor || 0;
      var floorApplied = sum < floor;
      var lodging = floorApplied ? floor : sum;
      if (floorApplied) { anyFloor = true; }
      res.nights.push({
        index: i,
        label: d0 ? (i + 1) + '泊目 ' + dateLabel(addDays(d0, i)) : (i + 1) + '泊目',
        season: season,
        seasonLabel: SEASON_LABEL[season],
        detail: describeCounts(counts, { adult: rates.adult, elem: rates.elem, pre: rates.pre }),
        sum: sum, floor: floor, floorApplied: floorApplied, amount: lodging
      });
      res.lodgingTotal += lodging;
    }
    if (anyFloor) { note('最低利用金額に満たない泊は、最低利用金額で計算しています'); }

    // 食事（食事は「5人分〜」。少人数プランの夕食はBBQのみ）
    // 夕食の人数が全員より少ないときは、おとな→小学生→3〜5歳の順に減らす
    function countsFor(count) {
      var c = { adult: counts.adult, elem: counts.elem, pre: counts.pre };
      if (typeof count !== 'number' || isNaN(count)) { return c; }
      var need = payers - Math.max(0, Math.min(payers, Math.round(count)));
      ['adult', 'elem', 'pre'].forEach(function (k) {
        var take = Math.min(c[k], need);
        c[k] -= take;
        need -= take;
      });
      return c;
    }
    function addMeal(label, def, extraNote, useCounts) {
      var cs = useCounts || counts;
      var pr = mealPrices(def);
      var amount = cs.adult * pr.adult + cs.elem * pr.elem + cs.pre * pr.pre;
      res.meals.push({ label: label, detail: describeCounts(cs, pr), amount: amount, note: extraNote || '' });
      res.mealTotal += amount;
    }
    if (mealsOk) {
      var lunch = findDef(LUNCHES, s.lunch);
      if (lunch.id !== 'byo') {
        addMeal('1日目 昼食 ' + lunch.label, lunch, '', countsFor(s.lunchCount));
      }
      for (var n = 0; n < s.nights; n += 1) {
        var dinner = findDef(DINNERS, s.dinner[n]);
        if (compact && !dinner.compactOk) { dinner = DINNERS[0]; }
        if (dinner.id !== 'byo') {
          var extra = '';
          var dc = countsFor(s.dinnerCount ? s.dinnerCount[n] : null);
          if (dinner.flat && !dinner.mealKey && !dinner.kidRates && (dc.elem + dc.pre) > 0) {
            extra = 'お子さま料金の記載がないため全員同額で計算';
            res.approx = true;
            note('お子さま料金の記載がない夕食（すき焼き・カレー・弁当）は、全員同額で計算しています（目安）');
          }
          // 2026-11-24 すき焼きの提供期間は、選んだ夕食の下のキャプション（P75）にだけ出す。合計欄の同じ文は消した（P88）
          addMeal(nightDate(n) + ' 夕食 ' + dinner.label, dinner, extra, dc);
        }
        if (s.drink[n]) {
          var cups = payers;
          var drinkAmount = cups * DRINK.price;
          res.meals.push({ label: nightDate(n) + ' ' + DRINK.label, detail: cups + '人×' + fmt(DRINK.price), amount: drinkAmount, note: '' });
          res.mealTotal += drinkAmount;
        }
        if (s.breakfast[n]) {
          addMeal((d0 ? dateLabel(addDays(d0, n + 1)) : (n + 2) + '日目の朝') + ' 朝食 ' + BREAKFAST.label, BREAKFAST);
        }
      }
      if (people.infant > 0) { note('2歳以下のお食事は計算に含めていません'); }
    }

    // オプション（単価は OPTIONS = /play/option/ の転記）
    var o = s.opts;
    if (o.gym.hours > 0) {
      res.options.push({ label: OPT.gym.name, detail: o.gym.hours + '時間×' + fmt(OPT.gym.price), amount: o.gym.hours * OPT.gym.price });
    }
    if (o.surf.people > 0) {
      res.options.push({ label: OPT.surf.name, detail: o.surf.people + '人×' + fmt(OPT.surf.price) + '〜', amount: o.surf.people * OPT.surf.price, approx: true });
      res.approx = true;
      note('サーフィン教室は「' + fmt(OPT.surf.price) + '〜」の料金のため、合計は目安です');
    }
    if (o.sauna.people > 0 && o.sauna.hours > 0) {
      var raw = o.sauna.people * o.sauna.hours * OPT.sauna.price;
      var saunaMin = raw < OPT.sauna.minCharge;
      res.options.push({
        label: OPT.sauna.name,
        detail: o.sauna.people + '人×' + o.sauna.hours + '時間×' + fmt(OPT.sauna.price) + (saunaMin ? '（最低利用金額' + fmt(OPT.sauna.minCharge) + 'で計算）' : ''),
        amount: saunaMin ? OPT.sauna.minCharge : raw
      });
    }
    if (o.beer.kegs > 0) {
      res.options.push({ label: OPT.beer.name, detail: o.beer.kegs + '樽×' + fmt(OPT.beer.price), amount: o.beer.kegs * OPT.beer.price, group: OPT.beer.group });
    }
    // 少人数プランは追加部屋1部屋まで（料金は未確認のため、どちらのプランも合計に入れず「お見積り」）
    var roomCount = compact ? Math.min(o.room.rooms, OPT.room.fields[0].compactMax) : o.room.rooms;
    if (roomCount > 0) {
      res.quotes.push({ label: OPT.room.name + '（追加' + roomCount + '部屋）', detail: compact ? OPT.room.compactUnitText : OPT.room.unitText, amountText: 'お見積り' });
      note('部屋分けオプションは合計に含めていません（予約時にご確認ください）');
    }
    res.options.forEach(function (it) { res.optionTotal += it.amount; });

    // 割引（宿泊の基本料金に対して。お食事・オプションは対象外。連泊割・地域割・リピート割はどれか1つのみ）
    var eligible = [];
    if (s.nights >= 2) { eligible.push({ id: 'renpaku', label: '連泊割', percent: DISCOUNT_PERCENT.renpaku }); }
    if (s.local) { eligible.push({ id: 'chiiki', label: '地域割（牧之原市内）', percent: DISCOUNT_PERCENT.chiiki }); }
    if (s.repeat) { eligible.push({ id: 'repeat', label: 'リピート割', percent: DISCOUNT_PERCENT.repeat }); }
    if (eligible.length) {
      var best = eligible[0];
      eligible.forEach(function (it) { if (it.percent > best.percent) { best = it; } });
      var amountOff = Math.floor(res.lodgingTotal * best.percent / 100);
      res.discount = { label: best.label, percent: best.percent, amount: amountOff };
      // 2026-11-24 割引を1つだけ計算に入れる説明は、割引の欄の注記（P84）に1本化。合計欄の同じ説明は消した（P92）
    }

    res.total = res.lodgingTotal - (res.discount ? res.discount.amount : 0) + res.mealTotal + res.optionTotal;
    res.perPerson = payers > 0 ? Math.round(res.total / payers) : 0;
    return res;
  }

  // ---- DOM ヘルパー -------------------------------------------------------
  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }
  // 行の左に置く小さな写真（4:3）。写真がないときは薄い枠に「写真準備中」
  function rowThumb(key) {
    var src = ROW_PHOTOS[key];
    if (!src) {
      var blank = h('span', 'top-v2-sim-thumb is-blank', '写真準備中');
      blank.setAttribute('aria-hidden', 'true');
      return blank;
    }
    var wrap = h('span', 'top-v2-sim-thumb');
    var img = h('img');
    img.src = src;
    img.alt = '';
    img.width = 480;
    img.height = 360;
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
    return wrap;
  }
  // ⓘ（トップのクチコミⓘと同じ部品）。label は読み上げ用の名前、text は中に出す説明
  function infoPop(label, text) {
    var d = h('details', 'top-v2-info top-v2-info--inline');
    var sm = h('summary');
    sm.setAttribute('aria-label', label);
    var dot = h('span', '', 'i');
    dot.setAttribute('aria-hidden', 'true');
    sm.appendChild(dot);
    d.appendChild(sm);
    var pop = h('div', 'top-v2-info-pop');
    pop.appendChild(h('p', '', text));
    d.appendChild(pop);
    return d;
  }
  function stepperHTML(inputId, label, attrs, value, min, max) {
    var wrap = h('div', 'top-v2-sim-stepper');
    var minus = h('button', 'top-v2-chalk-step', '−');
    minus.type = 'button';
    minus.setAttribute('data-step', '-1');
    minus.setAttribute('data-for', inputId);
    minus.setAttribute('aria-label', label + 'を減らす');
    var input = h('input', 'top-v2-sim-num');
    input.type = 'number';
    input.id = inputId;
    input.setAttribute('inputmode', 'numeric');
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    Object.keys(attrs).forEach(function (k) { input.setAttribute(k, attrs[k]); });
    var plus = h('button', 'top-v2-chalk-step', '＋');
    plus.type = 'button';
    plus.setAttribute('data-step', '1');
    plus.setAttribute('data-for', inputId);
    plus.setAttribute('aria-label', label + 'を増やす');
    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);
    return wrap;
  }
  function labelledStepperRow(inputId, label, sub, unit, attrs, value, min, max) {
    var row = h('div', 'top-v2-sim-row');
    var lab = h('label', 'top-v2-sim-rowlabel', label);
    lab.setAttribute('for', inputId);
    if (sub) { lab.appendChild(h('small', '', sub)); }
    row.appendChild(lab);
    row.appendChild(stepperHTML(inputId, label, attrs, value, min, max));
    if (unit) { row.appendChild(h('span', 'top-v2-sim-unit', unit)); }
    return row;
  }
  function priceYen(v) { return v.toLocaleString('ja-JP') + '円'; }

  // ---- 画面の組み立て（動的部分） ---------------------------------------
  var els = {
    checkin: $('sim-checkin'),
    checkout: $('sim-checkout'),
    nightList: $('sim-night-list'),
    dateNights: $('sim-date-nights'),
    dateMsg: $('sim-date-msg'),
    undecided: $('sim-undecided'),
    undecidedMsg: $('sim-undecided-msg'),
    undecidedBody: $('sim-undecided-body'),
    bfNights: $('sim-bf-nights'),
    lunchCardsBox: $('sim-lunch-cards'),
    lunchCards: null,
    lunchNote: $('sim-lunch-note'),
    lunchCountWrap: null,
    lunchCount: null,
    mealNights: $('sim-meal-nights'),
    drinkNights: $('sim-drink-nights'),
    mealGate: $('sim-meal-gate'),
    options: $('sim-options'),
    drinkOptions: $('sim-drink-options'),
    planNote: $('sim-plan-note'),
    discountNote: $('sim-discount-note'),
    peopleSum: $('sim-peoplesum'),
    local: $('sim-local'),
    repeat: $('sim-repeat'),
    total: $('sim-total'),
    per: $('sim-per'),
    approx: $('sim-approx'),
    breakdown: $('sim-breakdown'),
    notes: $('sim-notes'),
    rateTable: $('sim-ratetable'),
    summary: $('sim-summary'),
    toggle: $('sim-sum-toggle')
  };
  var planInputs = form.querySelectorAll('input[name="sim-plan"]');
  var nightInputs = form.querySelectorAll('input[name="sim-nights"]');
  var peopleInputs = {};
  Array.prototype.forEach.call(form.querySelectorAll('[data-people]'), function (input) {
    peopleInputs[input.getAttribute('data-people')] = input;
  });
  var compactRadio = $('sim-plan-compact');

  var nightRows = [];
  var mealRows = [];
  var optionRefs = {};

  // カードの値段の行（2026-11-24 までのプルダウンの「名前　価格」の価格の部分と同じ文字）
  function mealPriceText(def) {
    var pr = def.mealKey || def.flat ? mealPrices(def) : null;
    if (!pr) { return '0円'; }
    return priceYen(pr.adult);
  }
  // 昼食・夕食の写真つきカード（ラジオ）。プランのカードと同じく、丸印と「選択中」は CSS で付ける
  function buildMealCards(box, list, name, withPlanRule) {
    var refs = { inputs: {}, labels: {}, offs: {} };
    list.forEach(function (def) {
      var lab = h('label', 'top-v2-sim-mealcard');
      var inp = h('input');
      inp.type = 'radio';
      inp.name = name;
      inp.value = def.id;
      inp.id = name + '-' + def.id;
      if (def.id === 'byo') { inp.checked = true; }
      var body = h('span', 'top-v2-sim-mealcard-body');
      var photo = MEAL_PHOTOS[def.id];
      var fig;
      if (photo) {
        fig = h('span', 'top-v2-sim-mealcard-photo');
        var img = h('img');
        img.src = photo.src;
        img.alt = '';
        img.width = photo.w;
        img.height = photo.h;
        img.loading = 'lazy';
        img.decoding = 'async';
        fig.appendChild(img);
      } else {
        fig = h('span', 'top-v2-sim-mealcard-photo is-blank', MEAL_NO_PHOTO[def.id] || '');
        fig.setAttribute('aria-hidden', 'true');
      }
      var text = h('span', 'top-v2-sim-mealcard-text');
      text.appendChild(h('strong', 'top-v2-sim-mealcard-name', def.label));
      text.appendChild(h('span', 'top-v2-sim-mealcard-price', mealPriceText(def)));
      if (withPlanRule && !def.compactOk) {
        var off = h('span', 'top-v2-sim-mealcard-off', '少人数プランでは選べません');
        off.hidden = true;
        text.appendChild(off);
        refs.offs[def.id] = off;
      }
      body.appendChild(fig);
      body.appendChild(text);
      lab.appendChild(inp);
      lab.appendChild(body);
      box.appendChild(lab);
      refs.inputs[def.id] = inp;
      refs.labels[def.id] = lab;
    });
    return refs;
  }
  // 選ばれている値・使えるかどうかをカードに反映（gated＝5人分に満たない、compact＝少人数プランの夕食ルール）
  function syncMealCards(refs, list, value, gated, compact) {
    list.forEach(function (def) {
      var inp = refs.inputs[def.id];
      var planOff = !!(compact && refs.offs[def.id]);
      inp.checked = def.id === value;
      inp.disabled = gated || planOff;
      refs.labels[def.id].classList.toggle('is-disabled', inp.disabled);
      if (refs.offs[def.id]) { refs.offs[def.id].hidden = !planOff; }
    });
  }
  function checkedValue(name, fallback) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : fallback;
  }
  function mealCaption(def) {
    if (!(def.mealKey || def.flat)) { return def.note || ''; }
    var pr = mealPrices(def);
    var text = isFlat(pr)
      ? '全年齢 ' + priceYen(pr.adult) + '/人'
      : 'おとな ' + priceYen(pr.adult) + '・小学生 ' + priceYen(pr.elem) + '・3〜5歳 ' + priceYen(pr.pre);
    // 2026-11-24 「（2歳以下は含みません）」は合計欄の「2歳以下のお食事は計算に含めていません」（P89）に1回だけ（P74）
    return text + (def.note ? '。' + def.note : '');
  }

  function buildNights() {
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      (function (idx) {
        var li = h('li', 'top-v2-sim-night');
        var fs = h('fieldset', 'top-v2-sim-season');
        var legend = h('legend', '', (idx + 1) + '泊目は？');
        fs.appendChild(legend);
        var radios = {};
        ['weekday', 'holiday'].forEach(function (key) {
          var lab = h('label', '');
          var inp = document.createElement('input');
          inp.type = 'radio';
          inp.name = 'sim-season-' + idx;
          inp.value = key;
          if (key === 'weekday') { inp.checked = true; }
          var sp = h('span', '', SEASON_LABEL[key]);
          lab.appendChild(inp);
          lab.appendChild(sp);
          fs.appendChild(lab);
          radios[key] = inp;
        });
        li.appendChild(fs);
        els.nightList.appendChild(li);
        nightRows.push({ li: li, legend: legend, radios: radios, name: 'sim-season-' + idx });
      })(i);
    }
  }

  // 食事の人数ステッパー（昼食・夕食で共通）
  function buildMealCount(inputId, label, noun, attrs) {
    var wrap = h('div', 'top-v2-sim-dinnercount');
    var rows = h('div', 'top-v2-sim-rows');
    var row = labelledStepperRow(inputId, label, '', '人', attrs, 10, MEAL_MIN_SERVINGS, 100);
    // スマホで「夕食を頼む人／数」と切れないよう、折り返すなら「人数」の前だけにする（2026-11-24）
    var labEl = row.querySelector('label');
    var cut = label.lastIndexOf('人数');
    if (labEl && cut > 0) {
      labEl.textContent = '';
      labEl.appendChild(h('span', 'top-v2-sim-nobr', label.slice(0, cut)));
      labEl.appendChild(h('span', 'top-v2-sim-nobr', label.slice(cut)));
    }
    rows.appendChild(row);
    wrap.appendChild(rows);
    wrap.appendChild(h('p', 'top-v2-sim-note', noun + 'は' + MEAL_MIN_SERVINGS + '人分からご注文できます。人数を減らすと、おとなの分から減らして計算します。'));
    return { wrap: wrap, input: row.querySelector('input') };
  }

  function buildMeals() {
    els.lunchCards = buildMealCards(els.lunchCardsBox, LUNCHES, 'sim-lunch', false);
    var lunchCount = buildMealCount('sim-lunch-count', '昼食の人数', '昼食', { 'data-lunch-count': '1' });
    els.lunchCountWrap = lunchCount.wrap;
    els.lunchCount = lunchCount.input;
    els.lunchNote.parentNode.insertBefore(lunchCount.wrap, els.lunchNote);
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      (function (idx) {
        // 夕食（1泊ごと）：選択・人数（飲み放題は下の「お飲み物」へ。2026-11-24）
        var box = h('div', 'top-v2-sim-mealblock');
        var title = h('h4', 'top-v2-sim-mealtitle');
        // 2泊目以降は「1泊目と同じにする」（はじめはオン）。オンのあいだはカードをたたみ、1泊目の夕食をそのまま使う
        var same = null;
        var sameRow = null;
        var sameSum = null;
        if (idx > 0) {
          sameRow = h('label', 'top-v2-sim-check top-v2-sim-samecheck');
          same = h('input');
          same.type = 'checkbox';
          same.id = 'sim-dinner-same-' + idx;
          same.setAttribute('data-dinner-same', String(idx));
          same.checked = true;
          var sameText = h('span');
          sameText.appendChild(h('strong', '', '1泊目と同じにする'));
          sameRow.appendChild(same);
          sameRow.appendChild(sameText);
          sameSum = h('p', 'top-v2-sim-samesum');
        }
        var fs = h('fieldset', 'top-v2-sim-fieldset top-v2-sim-mealfs');
        var legend = h('legend', 'top-v2-sim-sr', '夕食');
        fs.appendChild(legend);
        var cardsBox = h('div', 'top-v2-sim-mealcards');
        fs.appendChild(cardsBox);
        var cards = buildMealCards(cardsBox, DINNERS, 'sim-dinner-' + idx, true);
        var dinnerCount = buildMealCount('sim-dinner-count-' + idx, '夕食を頼む人数', '夕食', { 'data-dinner-count': String(idx) });
        var countWrap = dinnerCount.wrap;
        var dinnerNote = h('p', 'top-v2-sim-note');
        box.appendChild(title);
        if (sameRow) {
          box.appendChild(sameRow);
          box.appendChild(sameSum);
        }
        box.appendChild(fs);
        box.appendChild(countWrap);
        box.appendChild(dinnerNote);
        els.mealNights.appendChild(box);
        // 飲み放題（1泊ごと）：「お飲み物」の欄。人数は選べない（料金のかかる方全員分）ことをすぐ下に書く
        var drinkBox = h('div', 'top-v2-sim-mealblock');
        var drinkTitle = h('h4', 'top-v2-sim-mealtitle');
        var drinkRow = h('label', 'top-v2-sim-check top-v2-sim-check--photo');
        var drinkInput = h('input');
        drinkInput.type = 'checkbox';
        drinkInput.id = 'sim-drink-' + idx;
        drinkInput.setAttribute('data-drink', String(idx));
        var drinkText = h('span');
        var drinkStrong = h('strong', '', DRINK.label + 'をつける');
        drinkText.appendChild(drinkStrong);
        drinkText.appendChild(document.createTextNode('\u3000全員分・1人' + priceYen(DRINK.price) + '（2歳以下を除く）'));
        drinkText.appendChild(h('small', 'top-v2-sim-check-sub', '人数は選べません（料金のかかる方全員分）'));
        drinkRow.appendChild(drinkInput);
        drinkRow.appendChild(rowThumb('drinks'));
        drinkRow.appendChild(drinkText);
        drinkBox.appendChild(drinkTitle);
        drinkBox.appendChild(drinkRow);
        els.drinkNights.appendChild(drinkBox);
        // 朝食（翌朝ごと）
        var bfBox = h('div', 'top-v2-sim-mealblock');
        var bfLabel = h('label', 'top-v2-sim-check top-v2-sim-check--photo');
        var bf = h('input');
        bf.type = 'checkbox';
        bf.id = 'sim-bf-' + idx;
        bf.setAttribute('data-bf', String(idx));
        var bfText = h('span');
        bfLabel.appendChild(bf);
        bfLabel.appendChild(rowThumb(BREAKFAST.mealKey));
        bfLabel.appendChild(bfText);
        bfBox.appendChild(bfLabel);
        els.bfNights.appendChild(bfBox);
        mealRows.push({ box: box, title: title, legend: legend, fs: fs, cards: cards, same: same, sameSum: sameSum, note: dinnerNote, countWrap: countWrap, count: dinnerCount.input, drinkBox: drinkBox, drinkTitle: drinkTitle, drink: drinkInput, bfBox: bfBox, bf: bf, bfText: bfText });
      })(i);
    }
  }

  function buildOptions() {
    OPTIONS.forEach(function (def) {
      // 生ビールなど group: 'drink' のものはステップ4「お飲み物」（見出しh3）の中に置くので、名前はh4
      var inDrinks = def.group === 'drink';
      var nameTag = inDrinks ? 'h4' : 'h3';
      var card = h('div', 'top-v2-sim-opt');
      var head = h('div', 'top-v2-sim-opt-head');
      if (def.info) {
        // 名前の横にⓘ（見た目・開け閉めは top-v2.css の .top-v2-info と info-pop.js）
        var titleWrap = h('div', 'top-v2-sim-opt-title');
        titleWrap.appendChild(h(nameTag, 'top-v2-sim-opt-name', def.name));
        titleWrap.appendChild(infoPop(def.info.label, def.info.text));
        head.appendChild(titleWrap);
      } else {
        head.appendChild(h(nameTag, 'top-v2-sim-opt-name', def.name));
      }
      var priceP = h('p', 'top-v2-sim-opt-price');
      var priceSmall = null;
      if (def.quote) {
        priceP.appendChild(h('strong', '', 'お見積り'));
        priceSmall = h('small', '', '（' + def.unitText + '）');
        priceP.appendChild(priceSmall);
      } else {
        priceP.appendChild(h('strong', '', priceYen(def.price) + (def.from ? '〜' : '')));
        priceP.appendChild(h('small', '', def.unit));
      }
      head.appendChild(priceP);
      // 名前・値段の左に小さな写真（2026-11-24）
      var optTop = h('div', 'top-v2-sim-opt-top');
      optTop.appendChild(rowThumb(def.id));
      optTop.appendChild(head);
      card.appendChild(optTop);
      card.appendChild(h('p', 'top-v2-sim-note', def.note));
      var gate = h('p', 'top-v2-sim-note top-v2-sim-note--warn');
      gate.hidden = true;
      card.appendChild(gate);
      var rows = h('div', 'top-v2-sim-rows');
      var refs = { card: card, gate: gate, priceSmall: priceSmall, inputs: {} };
      def.fields.forEach(function (f) {
        var inputId = 'sim-opt-' + def.id + '-' + f.key;
        var max = typeof f.max === 'number' ? f.max : 100;
        var row = labelledStepperRow(inputId, f.label, '', f.unit, { 'data-opt': def.id, 'data-field': f.key }, 0, 0, max);
        rows.appendChild(row);
        refs.inputs[f.key] = { input: row.querySelector('input'), def: f };
      });
      card.appendChild(rows);
      (inDrinks && els.drinkOptions ? els.drinkOptions : els.options).appendChild(card);
      optionRefs[def.id] = refs;
    });
  }

  function renderRateInfo() {
    var std = [P.getRates('weekday', false), P.getRates('holiday', false)];
    var cmp = [P.getRates('weekday', true), P.getRates('holiday', true)];
    var stdSmall = form.querySelector('[data-sim-rate="standard"]');
    var cmpSmall = form.querySelector('[data-sim-rate="compact"]');
    if (stdSmall) {
      stdSmall.textContent = '平日・オフ ' + priceYen(std[0].adult) + '〜 ／ 土日祝・ハイ ' + priceYen(std[1].adult) + '〜（おとな1泊）';
    }
    if (cmpSmall) {
      cmpSmall.textContent = 'おとな' + priceYen(-P.COMPACT.adultDelta) + '引き（' + priceYen(cmp[0].adult) + '〜 ／ ' + priceYen(cmp[1].adult) + '〜）';
    }
    var max = form.querySelector('[data-sim-compact-max]');
    if (max) { max.textContent = String(P.COMPACT_HARD_MAX); }
    Array.prototype.forEach.call(form.querySelectorAll('[data-sim-percent]'), function (node) {
      node.textContent = String(DISCOUNT_PERCENT[node.getAttribute('data-sim-percent')]);
    });
  }

  function renderRateTable(compact) {
    var w = P.getRates('weekday', compact);
    var hd = P.getRates('holiday', compact);
    var rows = [
      ['おとな', priceYen(w.adult), priceYen(hd.adult)],
      ['小学生（30%OFF）', priceYen(w.elem), priceYen(hd.elem)],
      ['3〜5歳（50%OFF）', priceYen(w.pre), priceYen(hd.pre)],
      ['2歳以下（添い寝）', '無料', '無料'],
      ['最低人数', w.minPeople + '名', hd.minPeople + '名'],
      ['最低利用金額', priceYen(w.floor), priceYen(hd.floor)]
    ];
    els.rateTable.textContent = '';
    rows.forEach(function (r) {
      var tr = h('tr');
      tr.appendChild(h('th', '', r[0])).scope = 'row';
      tr.appendChild(h('td', '', r[1]));
      tr.appendChild(h('td', '', r[2]));
      els.rateTable.appendChild(tr);
    });
  }

  // ---- 状態の読み取り・正規化・書き戻し ------------------------------------
  var state = defaultState();
  var lunchTouched = false; // 昼食の人数を利用者が変えたか
  var dinnerTouched = []; // 夕食の人数を利用者が変えたか（変えていなければ人数に合わせて増減）
  var dateMsg = false; // 「5泊まで」の案内を出すか
  var prevDatesMode = null;
  var flash = { plan: '', meal: '' };

  function readState() {
    var s = state;
    var planChecked = form.querySelector('input[name="sim-plan"]:checked');
    s.plan = planChecked ? planChecked.value : 'standard';
    var nightChecked = form.querySelector('input[name="sim-nights"]:checked');
    s.nights = nightChecked ? clampInt(nightChecked.value, 1, MAX_NIGHTS) : 1;
    // 日付がそろっていれば泊数と時期は日付から決める。なければ「日付が決まっていない場合」のボタンから
    var dIn = parseDate(els.checkin.value);
    var dOut = parseDate(els.checkout.value);
    s.datesMode = !!(dIn && dOut && dOut > dIn);
    s.checkin = '';
    s.checkout = '';
    if (s.datesMode) {
      var diff = Math.round((Date.UTC(dOut.getFullYear(), dOut.getMonth(), dOut.getDate()) - Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate())) / 86400000);
      if (diff > MAX_NIGHTS) {
        diff = MAX_NIGHTS;
        dOut = addDays(dIn, MAX_NIGHTS);
        els.checkout.value = ymd(dOut);
        dateMsg = true;
      }
      s.nights = diff;
      s.checkin = ymd(dIn);
      s.checkout = ymd(dOut);
    }
    ['adult', 'elem', 'pre', 'infant'].forEach(function (key) {
      s.people[key] = clampInt(peopleInputs[key].value, key === 'adult' ? 1 : 0, P.MAX_PEOPLE);
    });
    s.lunch = checkedValue('sim-lunch', 'byo');
    s.lunchCount = lunchTouched ? clampInt(els.lunchCount.value, 0, P.MAX_PEOPLE) : null;
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      s.seasons[i] = nightRows[i].radios.holiday.checked ? 'holiday' : 'weekday';
      // 「1泊目と同じにする」がオンの泊は、1泊目の夕食をそのまま使う（i=0 を先に読んでいる）
      var sameAsFirst = i > 0 && mealRows[i].same && mealRows[i].same.checked;
      s.dinner[i] = sameAsFirst ? s.dinner[0] : checkedValue('sim-dinner-' + i, 'byo');
      s.dinnerCount[i] = dinnerTouched[i] ? clampInt(mealRows[i].count.value, 0, P.MAX_PEOPLE) : null;
      s.drink[i] = mealRows[i].drink.checked;
      s.breakfast[i] = mealRows[i].bf.checked;
      // 日付がそろっていれば、泊ごとの区分は日付から自動で決める
      var auto = autoSeason(i);
      if (s.datesMode && auto) { s.seasons[i] = auto.season; }
    }
    OPTIONS.forEach(function (def) {
      def.fields.forEach(function (f) {
        s.opts[def.id][f.key] = clampInt(optionRefs[def.id].inputs[f.key].input.value, 0, 100);
      });
    });
    s.local = els.local.checked;
    s.repeat = els.repeat.checked;
  }

  function autoSeason(i) {
    var d0 = state.datesMode ? parseDate(state.checkin) : null;
    if (!d0) { return null; }
    return classifyNight(ymd(addDays(d0, i)));
  }

  function normalize() {
    var s = state;
    var remaining = P.MAX_PEOPLE;
    ['adult', 'elem', 'pre', 'infant'].forEach(function (key) {
      s.people[key] = Math.min(s.people[key], remaining);
      remaining -= s.people[key];
    });
    if (s.people.adult < 1) { s.people.adult = 1; }
    var total = s.people.adult + s.people.elem + s.people.pre + s.people.infant;
    var payers = total - s.people.infant;
    // flash（自動で戻したことの案内）は update() が操作ごとに消す。ここでは戻したときに立てるだけ
    if (s.plan === 'compact' && total > P.COMPACT_HARD_MAX) {
      s.plan = 'standard';
      flash.plan = '合計が' + P.COMPACT_HARD_MAX + '名を超えたため、スタンダードプランの料金で計算しています。';
    }
    var compact = s.plan === 'compact';
    if (payers < MEAL_MIN_SERVINGS) {
      s.lunch = 'byo';
      for (var i = 0; i < MAX_NIGHTS; i += 1) { s.dinner[i] = 'byo'; s.breakfast[i] = false; s.drink[i] = false; }
    }
    if (compact) {
      for (var j = 0; j < MAX_NIGHTS; j += 1) {
        if (!findDef(DINNERS, s.dinner[j]).compactOk) {
          s.dinner[j] = 'byo';
          flash.meal = '少人数プランの夕食オプションはBBQのみのため、BBQ以外は「不要・持ち込み」に戻しました。';
        }
      }
      // 少人数プランは追加部屋1部屋まで（スタンダードプランは最大2部屋のまま）
      s.opts.room.rooms = Math.min(s.opts.room.rooms, OPT.room.fields[0].compactMax);
    }
    // 昼食・夕食の人数：触っていなければ全員、触っていれば5人〜全員の範囲に収める
    function clampMealCount(v) {
      return (v === null || payers < MEAL_MIN_SERVINGS) ? payers : Math.max(MEAL_MIN_SERVINGS, Math.min(payers, v));
    }
    s.lunchCount = clampMealCount(s.lunchCount);
    for (var k = 0; k < MAX_NIGHTS; k += 1) {
      s.dinnerCount[k] = clampMealCount(s.dinnerCount[k]);
    }
    s.opts.surf.people = Math.min(s.opts.surf.people, payers);
    s.opts.sauna.people = Math.min(s.opts.sauna.people, payers);
  }

  function setNum(input, value, min, max, force) {
    input.min = String(min);
    input.max = String(max);
    if (force || document.activeElement !== input) { input.value = String(value); }
    var wrap = input.parentNode;
    if (wrap) {
      var buttons = wrap.querySelectorAll('button[data-step]');
      Array.prototype.forEach.call(buttons, function (b) {
        var dir = Number(b.getAttribute('data-step'));
        b.disabled = dir < 0 ? value <= min : value >= max;
      });
    }
  }

  function writeBack(force) {
    var s = state;
    var p = s.people;
    var total = p.adult + p.elem + p.pre + p.infant;
    var payers = total - p.infant;
    var compactOk = total <= P.COMPACT_HARD_MAX;
    var compact = s.plan === 'compact' && compactOk;

    // プラン
    Array.prototype.forEach.call(planInputs, function (input) { input.checked = input.value === s.plan; });
    compactRadio.disabled = !compactOk;
    compactRadio.parentNode.classList.toggle('is-disabled', !compactOk);
    var planText = '少人数プランの中部屋・小部屋は、手狭でもよければ最大20名＋10名まで泊まれます。';
    if (!compactOk) { planText = '合計' + total + '名のため、少人数プラン（' + P.COMPACT_HARD_MAX + '名まで）は選べません。'; }
    else if (compact && total > P.COMPACT_COMFORT_MAX) {
      var rooms = DATA.rooms || {};
      var mid = rooms.s1f1 ? rooms.s1f1.max : '';
      var small = rooms.s1f2 ? rooms.s1f2.max : '';
      planText += '中部屋・小部屋の目安' + P.COMPACT_COMFORT_MAX + '名を超えます' + (mid && small ? '（中部屋' + mid + '名＋小部屋' + small + '名までの手狭な配置）' : '') + '。ご相談ください。';
    }
    els.planNote.textContent = (flash.plan ? flash.plan + ' ' : '') + planText;
    renderRateTable(compact);

    // 日程
    var d0 = s.datesMode ? parseDate(s.checkin) : null;
    els.dateMsg.hidden = !(dateMsg && s.datesMode);
    els.dateMsg.textContent = els.dateMsg.hidden ? '' : 'このページでは' + MAX_NIGHTS + '泊まで計算できます';
    // 日付があるとき：泊ごとの時期を読み取り専用で一覧にする
    els.dateNights.hidden = !s.datesMode;
    els.dateNights.textContent = '';
    // 2026-11-24 オーナー指摘「これ出す必要ある？」→ 泊ごとの一覧をやめ、内訳は1行にまとめる（泊ごとの金額は右の「お見積りの目安」に出る）
    if (s.datesMode) {
      var missing = false;
      var nWeek = 0, highDays = [];
      for (var di = 0; di < s.nights; di += 1) {
        var cls = autoSeason(di);
        if (!cls) { continue; }
        if (cls.holidayDataMissing) { missing = true; }
        if (cls.season === 'holiday') { highDays.push(dateLabelW(addDays(d0, di))); } else { nWeek += 1; }
      }
      var parts = [];
      if (nWeek) { parts.push(SEASON_LABEL.weekday + ' ' + nWeek + '泊'); }
      if (highDays.length) { parts.push(SEASON_LABEL.holiday + ' ' + highDays.length + '泊（' + highDays.join('・') + '）'); }
      els.dateNights.appendChild(h('li', 'top-v2-sim-datenight-sum', '料金の区分：' + parts.join('／')));
      if (missing) { els.dateNights.appendChild(h('li', 'top-v2-sim-datenight-why', '祝日は2026〜2027年分のみ反映しています')); }
    }
    // 日付が決まっていない場合のボタン：日付があるときは閉じて使えなくし、中身は日付から決めた値に合わせておく
    els.undecidedMsg.hidden = !s.datesMode;
    els.undecidedBody.classList.toggle('is-dimmed', s.datesMode);
    els.undecidedBody.setAttribute('aria-disabled', s.datesMode ? 'true' : 'false');
    Array.prototype.forEach.call(nightInputs, function (input) {
      input.checked = Number(input.value) === s.nights;
      input.disabled = s.datesMode;
    });
    if (prevDatesMode !== s.datesMode) {
      if (s.datesMode) { els.undecided.open = false; }
      prevDatesMode = s.datesMode;
    }
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      var row = nightRows[i];
      row.li.hidden = i >= s.nights;
      row.radios.holiday.disabled = s.datesMode;
      row.radios.weekday.disabled = s.datesMode;
      row.radios.holiday.checked = s.seasons[i] === 'holiday';
      row.radios.weekday.checked = s.seasons[i] !== 'holiday';
    }

    // 人数
    setNum(peopleInputs.adult, p.adult, 1, Math.max(1, P.MAX_PEOPLE - (total - p.adult)), force);
    setNum(peopleInputs.elem, p.elem, 0, P.MAX_PEOPLE - (total - p.elem), force);
    setNum(peopleInputs.pre, p.pre, 0, P.MAX_PEOPLE - (total - p.pre), force);
    setNum(peopleInputs.infant, p.infant, 0, P.MAX_PEOPLE - (total - p.infant), force);
    els.peopleSum.textContent = '合計 ' + total + '名（料金のかかる方 ' + payers + '名＋2歳以下 ' + p.infant + '名）';

    // 食事
    var mealsOk = payers >= MEAL_MIN_SERVINGS;
    els.mealGate.textContent = mealsOk
      ? (flash.meal || '')
      : 'お食事は' + MEAL_MIN_SERVINGS + '人分からのご注文です。料金のかかる人数が' + MEAL_MIN_SERVINGS + '名以上になると選べます（いまは' + payers + '名）。';
    els.mealGate.hidden = !els.mealGate.textContent;
    syncMealCards(els.lunchCards, LUNCHES, s.lunch, !mealsOk, false);
    els.lunchNote.textContent = mealCaption(findDef(LUNCHES, s.lunch));
    els.lunchCountWrap.hidden = !(mealsOk && s.lunch !== 'byo');
    setNum(els.lunchCount, s.lunchCount, Math.min(MEAL_MIN_SERVINGS, Math.max(payers, 0)), Math.max(payers, MEAL_MIN_SERVINGS), force);
    for (var n = 0; n < MAX_NIGHTS; n += 1) {
      var mr = mealRows[n];
      mr.box.hidden = n >= s.nights;
      mr.bfBox.hidden = n >= s.nights;
      mr.drinkBox.hidden = n >= s.nights;
      if (n >= s.nights) { continue; }
      mr.title.textContent = d0 ? (n + 1) + '泊目 ' + dateLabelW(addDays(d0, n)) + 'の夕食' : (n + 1) + '泊目の夕食';
      mr.legend.textContent = mr.title.textContent;
      mr.drinkTitle.textContent = d0 ? (n + 1) + '泊目 ' + dateLabelW(addDays(d0, n)) + 'の夜' : (n + 1) + '泊目の夜';
      // 隠れているカードも、いまの値（1泊目と同じならその値）に合わせておく。オフにした直前の値から選び直せる
      syncMealCards(mr.cards, DINNERS, s.dinner[n], !mealsOk, compact);
      var sameOn = !!(mr.same && mr.same.checked);
      if (mr.same) {
        mr.same.disabled = !mealsOk;
        mr.sameSum.hidden = !sameOn;
        mr.sameSum.textContent = sameOn ? '1泊目と同じ：' + findDef(DINNERS, s.dinner[n]).label : '';
      }
      mr.fs.hidden = sameOn;
      var showCount = mealsOk && s.dinner[n] !== 'byo' && !(compact && !findDef(DINNERS, s.dinner[n]).compactOk);
      mr.countWrap.hidden = !showCount;
      setNum(mr.count, s.dinnerCount[n], Math.min(MEAL_MIN_SERVINGS, Math.max(payers, 0)), Math.max(payers, MEAL_MIN_SERVINGS), force);
      var dinnerDef = findDef(DINNERS, s.dinner[n]);
      var caption = mealCaption(dinnerDef);
      if (d0 && dinnerDef.months && dinnerDef.months.indexOf(addDays(d0, n).getMonth() + 1) === -1) {
        caption += (caption ? '。' : '') + dinnerDef.seasonNote + '。この日付では提供されない可能性があります';
      } else if (dinnerDef.seasonNote) {
        caption += (caption ? '。' : '') + dinnerDef.seasonNote;
      }
      // 2026-11-24 お子さま料金の記載がない夕食の「全員同額で計算」は、合計欄の注記（P87）に1本化（P76）
      mr.note.textContent = caption;
      mr.drink.checked = !!s.drink[n];
      mr.drink.disabled = !mealsOk;
      mr.bf.checked = s.breakfast[n];
      mr.bf.disabled = !mealsOk;
      var sando = P.MEALS[BREAKFAST.mealKey];
      mr.bfText.textContent = (d0 ? (n + 2) + '日目 ' + dateLabelW(addDays(d0, n + 1)) + 'の朝食　' : (n + 2) + '日目の朝食　') + BREAKFAST.label + ' +' + priceYen(sando.adult) + '/人（全年齢同額）';
    }

    // オプション
    OPTIONS.forEach(function (def) {
      var refs = optionRefs[def.id];
      // 少人数プランのときだけ出す案内（部屋分けオプション＝「少人数プランは追加部屋1部屋まで」）
      var compactNote = compact && def.compactNote ? def.compactNote : '';
      refs.gate.hidden = !compactNote;
      refs.gate.textContent = compactNote;
      if (refs.priceSmall) {
        refs.priceSmall.textContent = '（' + (compact && def.compactUnitText ? def.compactUnitText : def.unitText) + '）';
      }
      def.fields.forEach(function (f) {
        var max = f.max === 'payers' ? Math.max(0, payers) : (compact && f.compactMax !== undefined ? f.compactMax : f.max);
        var value = s.opts[def.id][f.key];
        setNum(refs.inputs[f.key].input, value, 0, max, force);
      });
    });

    // 割引
    var dn = '';
    var dnNames = [];
    if (s.nights >= 2) { dnNames.push('連泊割'); }
    if (s.local) { dnNames.push('地域割'); }
    if (s.repeat) { dnNames.push('リピート割'); }
    if (dnNames.length >= 2) {
      dn = dnNames.join('と') + 'を同時に使えるかは確認が取れていないため、割引率の大きい方（同率なら 連泊割→地域割→リピート割 の順）の1つだけを計算に入れています。併用の可否は予約画面でご確認ください。';
    } else if (s.nights >= 2) {
      dn = 'いまの泊数は連泊割の対象です。';
    }
    els.discountNote.textContent = dn;
  }

  // ---- 合計パネル -------------------------------------------------------
  function lineItem(label, detail, amountText, cls) {
    var li = h('li', 'top-v2-sim-line' + (cls ? ' ' + cls : ''));
    var left = h('span', 'top-v2-sim-line-main');
    left.appendChild(h('span', 'top-v2-sim-line-label', label));
    if (detail) { left.appendChild(h('small', 'top-v2-sim-line-detail', detail)); }
    li.appendChild(left);
    li.appendChild(h('b', 'top-v2-sim-line-amount', amountText));
    return li;
  }
  function section(title, items) {
    if (!items.length) { return null; }
    var sec = h('section', 'top-v2-sim-bd');
    sec.appendChild(h('h3', 'top-v2-sim-bd-title', title));
    var ul = h('ul', 'top-v2-sim-bd-list');
    items.forEach(function (it) { ul.appendChild(it); });
    sec.appendChild(ul);
    return sec;
  }

  function renderSummary(res) {
    var totalText = fmt(res.total);
    if (els.total.textContent !== totalText) { els.total.textContent = totalText; }
    els.per.textContent = '';
    if (res.payers > 0) {
      els.per.appendChild(document.createTextNode('1人あたり 約' + fmt(res.perPerson)));
      els.per.appendChild(h('span', 'top-v2-sim-per-note', '（2歳以下を除く）'));
    }
    els.approx.hidden = !res.approx;

    var bd = els.breakdown;
    bd.textContent = '';
    var lodgingItems = [];
    res.nights.forEach(function (n) {
      lodgingItems.push(lineItem(n.label, n.seasonLabel + '／' + n.detail, fmt(n.amount)));
      if (n.floorApplied) {
        lodgingItems.push(h('li', 'top-v2-sim-line-note', '最低利用金額に満たないため' + fmt(n.floor) + 'で計算'));
      }
    });
    // 生ビール（group: 'drink'）は入力欄と同じく「お食事」の欄に出す。金額・合計は変わらない（2026-11-24）
    function optionLine(o) { return lineItem(o.label, o.detail, fmt(o.amount) + (o.approx ? '〜' : '')); }
    var drinkOpts = res.options.filter(function (o) { return o.group === 'drink'; });
    var otherOpts = res.options.filter(function (o) { return o.group !== 'drink'; });
    var secs = [
      section('宿泊', lodgingItems),
      section('お食事', res.meals.map(function (m) {
        return lineItem(m.label, m.detail + (m.note ? '（' + m.note + '）' : ''), fmt(m.amount));
      }).concat(drinkOpts.map(optionLine))),
      section('オプション', otherOpts.map(optionLine).concat(res.quotes.map(function (q) {
        return lineItem(q.label, q.detail, q.amountText, 'is-quote');
      })))
    ];
    if (res.discount) {
      secs.push(section('割引', [
        lineItem(res.discount.label + ' ' + res.discount.percent + '%OFF', '宿泊の基本料金 ' + fmt(res.lodgingTotal) + ' に対して（お食事・オプションは対象外）', '−' + fmt(res.discount.amount), 'is-discount')
      ]));
    }
    secs.forEach(function (sec) { if (sec) { bd.appendChild(sec); } });
    var totalRow = h('p', 'top-v2-sim-bd-total');
    totalRow.appendChild(h('span', '', '合計（税込）'));
    totalRow.appendChild(h('b', '', fmt(res.total)));
    bd.appendChild(totalRow);
    if (res.payers > 0) {
      bd.appendChild(h('p', 'top-v2-sim-bd-per', '1人あたり 約' + fmt(res.perPerson) + '（2歳以下を除く）'));
    }

    els.notes.textContent = '';
    var notes = ['最終的な料金は予約画面でご確認ください（時期の選び方・割引は目安です）'].concat(res.notes);
    notes.forEach(function (text) { els.notes.appendChild(h('li', '', text)); });
  }

  // ---- イベント -----------------------------------------------------------
  // keepFlash：ラジオやチェックは1回の操作で input → change の順に2回 update する。
  // 1回目で「戻しました」の案内を出しても、2回目は戻すものがなく案内が消えてしまうため、同じ操作の2回目では消さない
  function update(force, keepFlash) {
    if (!keepFlash) {
      flash.plan = '';
      flash.meal = '';
    }
    readState();
    normalize();
    writeBack(!!force);
    renderSummary(calculate(state));
  }

  // 日付の入力：チェックインを選んだら、チェックアウトが空か同じ日以前のときは翌日にする
  function onDateEvent(e) {
    var t = e.target;
    if (t !== els.checkin && t !== els.checkout) { return; }
    dateMsg = false;
    var dIn = parseDate(els.checkin.value);
    var dOut = parseDate(els.checkout.value);
    if (t === els.checkin && dIn && (!dOut || dOut <= dIn)) {
      els.checkout.value = ymd(addDays(dIn, 1));
    } else if (t === els.checkout && e.type === 'change' && dIn && dOut && dOut <= dIn) {
      els.checkout.value = ymd(addDays(dIn, 1));
    }
  }
  function trackDinnerCount(t) {
    if (!t || !t.getAttribute) { return; }
    var idx = t.getAttribute('data-dinner-count');
    if (idx !== null) { dinnerTouched[Number(idx)] = true; }
    if (t.getAttribute('data-lunch-count') !== null) { lunchTouched = true; }
  }
  var lastInputTarget = null; // 直前の input イベントの要素（続く change が同じ操作かを見分ける）
  form.addEventListener('input', function (e) {
    lastInputTarget = e.target;
    onDateEvent(e);
    trackDinnerCount(e.target);
    update(false);
  });
  form.addEventListener('change', function (e) {
    var sameAction = e.target === lastInputTarget;
    lastInputTarget = null;
    onDateEvent(e);
    trackDinnerCount(e.target);
    update(true, sameAction);
  });
  form.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-step]') : null;
    if (!btn || btn.disabled) { return; }
    var input = $(btn.getAttribute('data-for'));
    if (!input) { return; }
    var min = Number(input.min) || 0;
    var max = input.max === '' ? 100 : Number(input.max);
    var next = clampInt(input.value, min, max) + Number(btn.getAttribute('data-step'));
    input.value = String(Math.max(min, Math.min(max, next)));
    trackDinnerCount(input);
    update(true);
  });

  els.toggle.addEventListener('click', function () {
    var open = els.summary.classList.toggle('is-open');
    els.toggle.setAttribute('aria-expanded', String(open));
    els.toggle.textContent = open ? '内訳 ▴' : '内訳 ▾';
  });

  // ---- ページ内カレンダー（1回目のタップでチェックイン、2回目でチェックアウト。2026-11-24） ----
  var cal = {
    grid: $('sim-cal-grid'), title: $('sim-cal-title'), summary: $('sim-cal-summary'),
    prev: $('sim-cal-prev'), next: $('sim-cal-next'), clear: $('sim-cal-clear'),
    year: 0, month: 0
  };
  var calToday = new Date();
  calToday = new Date(calToday.getFullYear(), calToday.getMonth(), calToday.getDate());
  function calSetView(d) { cal.year = d.getFullYear(); cal.month = d.getMonth(); }
  function renderCalendar(focusDate) {
    if (!cal.grid) { return; }
    var inStr = els.checkin.value;
    var outStr = els.checkout.value;
    var todayStr = ymd(calToday);
    cal.title.textContent = cal.year + '年' + (cal.month + 1) + '月';
    cal.prev.disabled = cal.year * 12 + cal.month <= calToday.getFullYear() * 12 + calToday.getMonth();
    cal.grid.textContent = '';
    WEEKDAYS.forEach(function (w, i) {
      cal.grid.appendChild(h('span', 'top-v2-sim-cal-dow' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''), w));
    });
    var first = new Date(cal.year, cal.month, 1);
    for (var b = 0; b < first.getDay(); b += 1) { cal.grid.appendChild(h('span', 'top-v2-sim-cal-blank', '')); }
    var days = new Date(cal.year, cal.month + 1, 0).getDate();
    for (var n = 1; n <= days; n += 1) {
      var d = new Date(cal.year, cal.month, n);
      var key = ymd(d);
      var dow = d.getDay();
      var cls = 'top-v2-sim-cal-day';
      if (dow === 0 || HOLIDAYS[key]) { cls += ' is-sun'; } else if (dow === 6) { cls += ' is-sat'; }
      var info = classifyNight(key);
      if (info && info.season === 'holiday') { cls += ' is-high'; }
      var tag = '';
      var aria = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + n + '日（' + WEEKDAYS[dow] + '）';
      if (key === inStr) { cls += ' is-in'; tag = 'イン'; aria += ' チェックイン'; }
      else if (outStr && key === outStr) { cls += ' is-out'; tag = 'アウト'; aria += ' チェックアウト'; }
      else if (inStr && outStr && key > inStr && key < outStr) { cls += ' is-range'; }
      if (key === todayStr) { cls += ' is-today'; }
      var btn = h('button', cls, '');
      btn.type = 'button';
      btn.setAttribute('data-date', key);
      btn.setAttribute('aria-label', aria);
      if (key === inStr || key === outStr) { btn.setAttribute('aria-pressed', 'true'); }
      if (key < todayStr) { btn.disabled = true; }
      btn.appendChild(h('span', 'top-v2-sim-cal-num', String(n)));
      btn.appendChild(h('span', 'top-v2-sim-cal-tag', tag));
      cal.grid.appendChild(btn);
    }
    var dIn = parseDate(inStr);
    var dOut = parseDate(outStr);
    if (dIn && dOut && dOut > dIn) {
      var nn = Math.round((Date.UTC(dOut.getFullYear(), dOut.getMonth(), dOut.getDate()) - Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate())) / 86400000);
      cal.summary.textContent = dateLabelW(dIn).replace('/', '/') + '〜' + dateLabelW(dOut) + '・' + nn + '泊';
      cal.summary.className = 'top-v2-sim-cal-summary is-done';
    } else if (dIn) {
      cal.summary.textContent = dateLabelW(dIn) + 'チェックイン。チェックアウトの日をタップしてください';
      cal.summary.className = 'top-v2-sim-cal-summary';
    } else {
      cal.summary.textContent = 'チェックインの日をタップしてください';
      cal.summary.className = 'top-v2-sim-cal-summary';
    }
    cal.clear.hidden = !dIn;
    if (focusDate) {
      var f = cal.grid.querySelector('button[data-date="' + focusDate + '"]');
      if (f && !f.disabled) { f.focus(); }
    }
  }
  function calPick(key) {
    var inStr = els.checkin.value;
    var outStr = els.checkout.value;
    dateMsg = false;
    if (!inStr || outStr || key <= inStr) {
      els.checkin.value = key;
      els.checkout.value = '';
    } else {
      var dIn = parseDate(inStr);
      var dKey = parseDate(key);
      var diff = Math.round((Date.UTC(dKey.getFullYear(), dKey.getMonth(), dKey.getDate()) - Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate())) / 86400000);
      if (diff > MAX_NIGHTS) {
        els.checkout.value = ymd(addDays(dIn, MAX_NIGHTS));
        dateMsg = true;
      } else {
        els.checkout.value = key;
      }
    }
    var shown = parseDate(els.checkout.value) || parseDate(els.checkin.value);
    // チェックアウトが別の月になっても、いま見ている月は動かさない（続けてタップしやすいように）
    renderCalendar(key);
    update(true);
    return shown;
  }
  if (cal.grid) {
    cal.grid.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-date]') : null;
      if (!btn || btn.disabled) { return; }
      calPick(btn.getAttribute('data-date'));
    });
    cal.grid.addEventListener('keydown', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-date]') : null;
      if (!btn) { return; }
      var step = { 37: -1, 39: 1, 38: -7, 40: 7 }[e.keyCode];
      if (!step) { return; }
      var d = addDays(parseDate(btn.getAttribute('data-date')), step);
      var target = cal.grid.querySelector('button[data-date="' + ymd(d) + '"]');
      if (target && !target.disabled) { e.preventDefault(); target.focus(); }
    });
    cal.prev.addEventListener('click', function () {
      if (cal.prev.disabled) { return; }
      calSetView(new Date(cal.year, cal.month - 1, 1));
      renderCalendar();
    });
    cal.next.addEventListener('click', function () {
      calSetView(new Date(cal.year, cal.month + 1, 1));
      renderCalendar();
    });
    cal.clear.addEventListener('click', function () {
      els.checkin.value = '';
      els.checkout.value = '';
      dateMsg = false;
      // 2026-11-24 クリアしたら「日付なし」の初期（1泊・平日）に戻す。直前の泊数・時期を引きずらない
      Array.prototype.forEach.call(nightInputs, function (r) { r.checked = (r.value === '1'); });
      nightRows.forEach(function (row) { if (row && row.radios) { row.radios.weekday.checked = true; row.radios.holiday.checked = false; } });
      renderCalendar();
      update(true);
    });
    calSetView(parseDate(els.checkin.value) || calToday);
    renderCalendar();
  }

  // ---- 初期化 -------------------------------------------------------------
  renderRateInfo();
  buildNights();
  buildMeals();
  buildOptions();
  // ほかのページの料金計算から渡された人数・プランで始める（例 ?adult=12&elem=1&pre=2&plan=compact。2026-11-21）
  // 範囲外の数はこの後の update(true) が正規化する
  (function prefillFromQuery() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
    ['adult', 'elem', 'pre', 'infant'].forEach(function (key) {
      var v = q.get(key);
      if (v !== null && /^\d+$/.test(v) && peopleInputs[key]) { peopleInputs[key].value = v; }
    });
    if (q.get('plan') === 'compact' && compactRadio) { compactRadio.checked = true; }
  })();
  update(true);

  // 検算・動作確認用（コンソールから window.KATASHO_SIM.calculate(...) で使える）
  window.KATASHO_SIM = Object.freeze({
    calculate: calculate,
    classifyNight: classifyNight,
    defaultState: defaultState,
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  });
})();
