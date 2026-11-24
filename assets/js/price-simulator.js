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
  var SEASON_LABEL = { weekday: '平日・オフシーズン', holiday: '土日祝・ハイシーズン' };

  // 昼食（チェックイン前）: 給食は MEALS.kyushoku（全年齢同額）、弁当は 1,250円/人（子ども料金の記載なし）
  var LUNCHES = [
    { id: 'byo', label: '持ち込み調理' },
    { id: 'kyushoku', label: '懐かしの給食', mealKey: 'kyushoku' },
    { id: 'bento', label: '贅沢しずおか四色弁当', flat: 1250 }
  ];
  // 夕食: 子ども料金は夕食のみ（小学生30%OFF・3〜5歳50%OFF、FAQ記載・2026-11-19オーナー確認）。
  // BBQ は MEALS.bbq、それ以外は大人料金 × KID_RATIO で計算（kidRates）。
  // 少人数プランは「夕食オプションはBBQのみ」。
  var DINNERS = [
    { id: 'byo', label: '持ち込み調理', compactOk: true },
    { id: 'bbq', label: 'BBQ（満腹コース）', mealKey: 'bbq', compactOk: true },
    { id: 'sukiyaki', label: '【冬季限定】すき焼き', flat: 5000, kidRates: true, seasonNote: '【冬季限定】すき焼きは11月〜3月のみの提供です' },
    { id: 'curry', label: '林間学校式カレー', flat: 2000, kidRates: true, note: 'お客様自身で調理していただきます' },
    { id: 'bento', label: '贅沢しずおか四色弁当', flat: 1250, kidRates: true }
  ];
  var KID_RATIO = { elem: 0.7, pre: 0.5 };
  var BREAKFAST = { label: 'サンドイッチ朝食', mealKey: 'sando' };

  // オプション（価格・単位は /play/option/ の記載）。
  var OPTIONS = [
    {
      id: 'gym', name: '体育館の延長利用', price: 2000, unit: '/時間（税込）',
      note: DATA.gym && DATA.gym.noteMid ? DATA.gym.noteMid : '体育館は市営のため事前予約が必要です。',
      fields: [{ key: 'hours', label: '延長時間', unit: '時間', max: 10 }]
    },
    {
      id: 'surf', name: 'サーフィン教室', price: 8000, from: true, unit: '/人（税込）',
      note: '地元のサーフショップの方から、サーフィンとボディボードのレクチャーを受けられます（チェックアウト後の参加もできます）。料金は受け入れてくださるサーフショップによって変わるため、合計は目安になります。',
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
      id: 'beer', name: '生ビール10L', price: 11000, unit: '/樽（税込）',
      note: 'ジョッキ約25杯分です。',
      fields: [{ key: 'kegs', label: '樽の数', unit: '樽', max: 10 }]
    },
    {
      id: 'room', name: '部屋分けオプション', quote: true, unitText: '5,000円/追加1部屋・26名以上は1部屋無料',
      note: '追加部屋は最大2部屋です。泊数ごとの扱いなどは予約時にご確認いただくため、合計には含めず「お見積り」としています。少人数プランでは利用できません。',
      fields: [{ key: 'rooms', label: '追加する部屋数', unit: '部屋', max: 2 }]
    }
  ];

  var OPT = {};
  OPTIONS.forEach(function (def) { OPT[def.id] = def; });

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
      nights: 1,
      seasons: arr('weekday'),
      people: { adult: 10, elem: 0, pre: 0, infant: 0 },
      lunch: 'byo',
      dinner: arr('byo'),
      drink: arr(0),
      breakfast: arr(false),
      opts: { gym: { hours: 0 }, surf: { people: 0 }, sauna: { people: 0, hours: 0 }, beer: { kegs: 0 }, room: { rooms: 0 } },
      local: false,
      repeat: false
    };
  }

  function calculate(s) {
    var people = s.people;
    var payers = people.adult + people.elem + people.pre;
    var totalPeople = payers + people.infant;
    var compact = s.plan === 'compact' && totalPeople <= P.COMPACT_HARD_MAX;
    var counts = { adult: people.adult, elem: people.elem, pre: people.pre };
    var kids = people.elem + people.pre;
    var mealsOk = payers >= MEAL_MIN_SERVINGS;
    var res = {
      compact: compact, payers: payers, totalPeople: totalPeople,
      nights: [], meals: [], options: [], quotes: [], notes: [], approx: false,
      lodgingTotal: 0, mealTotal: 0, optionTotal: 0, discount: null, total: 0, perPerson: 0
    };
    function note(text) { if (res.notes.indexOf(text) === -1) { res.notes.push(text); } }
    function nightDate(i) { return (i + 1) + '泊目の夜'; }

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
        label: (i + 1) + '泊目',
        season: season,
        seasonLabel: SEASON_LABEL[season],
        detail: describeCounts(counts, { adult: rates.adult, elem: rates.elem, pre: rates.pre }),
        sum: sum, floor: floor, floorApplied: floorApplied, amount: lodging
      });
      res.lodgingTotal += lodging;
    }
    if (anyFloor) { note('最低利用金額に満たない泊は、最低利用金額で計算しています'); }

    // 食事（食事は「5人分〜」。少人数プランの夕食はBBQのみ）
    function addMeal(label, def, extraNote) {
      var pr = mealPrices(def);
      var amount = counts.adult * pr.adult + counts.elem * pr.elem + counts.pre * pr.pre;
      res.meals.push({ label: label, detail: describeCounts(counts, pr), amount: amount, note: extraNote || '' });
      res.mealTotal += amount;
    }
    if (mealsOk) {
      var lunch = findDef(LUNCHES, s.lunch);
      if (lunch.id !== 'byo') {
        addMeal('1日目 昼食 ' + lunch.label, lunch);
      }
      for (var n = 0; n < s.nights; n += 1) {
        var dinner = findDef(DINNERS, s.dinner[n]);
        if (compact && !dinner.compactOk) { dinner = DINNERS[0]; }
        if (dinner.id !== 'byo') {
          var extra = '';
          if (dinner.flat && !dinner.mealKey && !dinner.kidRates && kids > 0) {
            extra = 'お子さま料金の記載がないため全員同額で計算';
            res.approx = true;
            note('お子さま料金の記載がない夕食（すき焼き・カレー・弁当）は、全員同額で計算しています（目安）');
          }
          if (dinner.seasonNote) { note(dinner.seasonNote); }
          addMeal(nightDate(n) + ' 夕食 ' + dinner.label, dinner, extra);
        }
        if (s.drink[n] > 0) {
          var cups = Math.min(s.drink[n], payers);
          var drinkAmount = cups * DRINK.price;
          res.meals.push({ label: nightDate(n) + ' ' + DRINK.label, detail: cups + '人×' + fmt(DRINK.price), amount: drinkAmount, note: '' });
          res.mealTotal += drinkAmount;
        }
        if (s.breakfast[n]) {
          addMeal((n + 2) + '日目の朝 朝食 ' + BREAKFAST.label, BREAKFAST);
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
      res.options.push({ label: OPT.beer.name, detail: o.beer.kegs + '樽×' + fmt(OPT.beer.price), amount: o.beer.kegs * OPT.beer.price });
    }
    if (o.room.rooms > 0 && !compact) {
      res.quotes.push({ label: OPT.room.name + '（追加' + o.room.rooms + '部屋）', detail: OPT.room.unitText, amountText: 'お見積り' });
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
      if (eligible.length > 1) {
        var names = eligible.map(function (it) { return it.label.replace('（牧之原市内）', ''); }).join('と');
        note(names + 'を同時に使えるかは確認が取れていないため、割引率の大きい方（同率なら 連泊割→地域割→リピート割 の順）の1つだけを適用しています。併用の可否は予約画面でご確認ください');
      }
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
    nightList: $('sim-night-list'),
    lunch: $('sim-lunch'),
    lunchNote: $('sim-lunch-note'),
    mealNights: $('sim-meal-nights'),
    mealGate: $('sim-meal-gate'),
    options: $('sim-options'),
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

  function mealOptionText(def) {
    var pr = def.mealKey || def.flat ? mealPrices(def) : null;
    if (!pr) { return def.label; }
    return def.label + '　' + priceYen(pr.adult);
  }
  function fillSelect(select, list) {
    select.textContent = '';
    list.forEach(function (def) {
      var opt = h('option', '', mealOptionText(def));
      opt.value = def.id;
      select.appendChild(opt);
    });
  }
  function mealCaption(def) {
    if (!(def.mealKey || def.flat)) { return def.note || ''; }
    var pr = mealPrices(def);
    var text = isFlat(pr)
      ? '全年齢 ' + priceYen(pr.adult) + '/人'
      : 'おとな ' + priceYen(pr.adult) + '・小学生 ' + priceYen(pr.elem) + '・3〜5歳 ' + priceYen(pr.pre);
    return text + '（2歳以下は含みません）' + (def.note ? '。' + def.note : '');
  }

  function buildNights() {
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      (function (idx) {
        var li = h('li', 'top-v2-sim-night');
        var head = h('div', 'top-v2-sim-night-head');
        var no = h('span', 'top-v2-sim-night-no', (idx + 1) + '泊目');
        head.appendChild(no);
        var field = h('div', 'top-v2-sim-field');
        var lab = h('label', 'top-v2-sim-label', (idx + 1) + '泊目の料金区分');
        lab.setAttribute('for', 'sim-season-' + idx);
        var sel = h('select', 'top-v2-sim-select');
        sel.id = 'sim-season-' + idx;
        sel.setAttribute('data-season', String(idx));
        ['weekday', 'holiday'].forEach(function (key) {
          var opt = h('option', '', SEASON_LABEL[key]);
          opt.value = key;
          sel.appendChild(opt);
        });
        field.appendChild(lab);
        field.appendChild(sel);
        li.appendChild(head);
        li.appendChild(field);
        els.nightList.appendChild(li);
        nightRows.push({ li: li, select: sel });
      })(i);
    }
  }

  function buildMeals() {
    fillSelect(els.lunch, LUNCHES);
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      (function (idx) {
        var box = h('div', 'top-v2-sim-mealblock');
        var title = h('h3', 'top-v2-sim-sub');
        var field = h('div', 'top-v2-sim-field');
        var lab = h('label', 'top-v2-sim-label', '夕食');
        lab.setAttribute('for', 'sim-dinner-' + idx);
        var sel = h('select', 'top-v2-sim-select');
        sel.id = 'sim-dinner-' + idx;
        sel.setAttribute('data-dinner', String(idx));
        fillSelect(sel, DINNERS);
        field.appendChild(lab);
        field.appendChild(sel);
        var dinnerNote = h('p', 'top-v2-sim-note');
        var drinkRow = labelledStepperRow(
          'sim-drink-' + idx, DRINK.label, priceYen(DRINK.price) + '/人', '人', { 'data-drink': String(idx) }, 0, 0, 100
        );
        var drinkNote = h('p', 'top-v2-sim-note', '延長は1時間500円で可能です（合計には含みません）。ビールは含まれません。');
        var bfLabel = h('label', 'top-v2-sim-check');
        var bf = h('input');
        bf.type = 'checkbox';
        bf.id = 'sim-bf-' + idx;
        bf.setAttribute('data-bf', String(idx));
        var bfText = h('span');
        bfLabel.appendChild(bf);
        bfLabel.appendChild(bfText);
        box.appendChild(title);
        box.appendChild(field);
        box.appendChild(dinnerNote);
        box.appendChild(drinkRow);
        box.appendChild(drinkNote);
        box.appendChild(bfLabel);
        els.mealNights.appendChild(box);
        mealRows.push({ box: box, title: title, select: sel, note: dinnerNote, drink: drinkRow.querySelector('input'), bf: bf, bfText: bfText });
      })(i);
    }
  }

  function buildOptions() {
    OPTIONS.forEach(function (def) {
      var card = h('div', 'top-v2-sim-opt');
      var head = h('div', 'top-v2-sim-opt-head');
      head.appendChild(h('h3', 'top-v2-sim-opt-name', def.name));
      var priceP = h('p', 'top-v2-sim-opt-price');
      if (def.quote) {
        priceP.appendChild(h('strong', '', 'お見積り'));
        priceP.appendChild(h('small', '', '（' + def.unitText + '）'));
      } else {
        priceP.appendChild(h('strong', '', priceYen(def.price) + (def.from ? '〜' : '')));
        priceP.appendChild(h('small', '', def.unit));
      }
      head.appendChild(priceP);
      card.appendChild(head);
      card.appendChild(h('p', 'top-v2-sim-note', def.note));
      var gate = h('p', 'top-v2-sim-note top-v2-sim-note--warn');
      gate.hidden = true;
      card.appendChild(gate);
      var rows = h('div', 'top-v2-sim-rows');
      var refs = { card: card, gate: gate, inputs: {} };
      def.fields.forEach(function (f) {
        var inputId = 'sim-opt-' + def.id + '-' + f.key;
        var max = typeof f.max === 'number' ? f.max : 100;
        var row = labelledStepperRow(inputId, f.label, '', f.unit, { 'data-opt': def.id, 'data-field': f.key }, 0, 0, max);
        rows.appendChild(row);
        refs.inputs[f.key] = { input: row.querySelector('input'), def: f };
      });
      card.appendChild(rows);
      els.options.appendChild(card);
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
      ['2歳以下', '無料', '無料'],
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
  var flash = { plan: '', meal: '' };

  function readState() {
    var s = state;
    var planChecked = form.querySelector('input[name="sim-plan"]:checked');
    s.plan = planChecked ? planChecked.value : 'standard';
    var nightChecked = form.querySelector('input[name="sim-nights"]:checked');
    s.nights = nightChecked ? clampInt(nightChecked.value, 1, MAX_NIGHTS) : 1;
    ['adult', 'elem', 'pre', 'infant'].forEach(function (key) {
      s.people[key] = clampInt(peopleInputs[key].value, key === 'adult' ? 1 : 0, P.MAX_PEOPLE);
    });
    s.lunch = els.lunch.value;
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      s.seasons[i] = nightRows[i].select.value === 'holiday' ? 'holiday' : 'weekday';
      s.dinner[i] = mealRows[i].select.value;
      s.drink[i] = clampInt(mealRows[i].drink.value, 0, 100);
      s.breakfast[i] = mealRows[i].bf.checked;
    }
    OPTIONS.forEach(function (def) {
      def.fields.forEach(function (f) {
        s.opts[def.id][f.key] = clampInt(optionRefs[def.id].inputs[f.key].input.value, 0, 100);
      });
    });
    s.local = els.local.checked;
    s.repeat = els.repeat.checked;
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
    flash.plan = '';
    flash.meal = '';
    if (s.plan === 'compact' && total > P.COMPACT_HARD_MAX) {
      s.plan = 'standard';
      flash.plan = '合計が' + P.COMPACT_HARD_MAX + '名を超えたため、スタンダードプランの料金で計算しています。';
    }
    var compact = s.plan === 'compact';
    if (payers < MEAL_MIN_SERVINGS) {
      s.lunch = 'byo';
      for (var i = 0; i < MAX_NIGHTS; i += 1) { s.dinner[i] = 'byo'; s.breakfast[i] = false; }
    }
    if (compact) {
      for (var j = 0; j < MAX_NIGHTS; j += 1) {
        if (!findDef(DINNERS, s.dinner[j]).compactOk) {
          s.dinner[j] = 'byo';
          flash.meal = '少人数プランの夕食オプションはBBQのみのため、BBQ以外は「持ち込み調理」に戻しました。';
        }
      }
      s.opts.room.rooms = 0;
    }
    for (var k = 0; k < MAX_NIGHTS; k += 1) {
      s.drink[k] = Math.min(s.drink[k], payers);
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
    var planText = '少人数プランの目安は20名くらいまで、手狭でもよければ最大' + P.COMPACT_HARD_MAX + '名です。' + (DATA.compact && DATA.compact.roomsNote ? DATA.compact.roomsNote + '。' : '') +
      '大部屋・追加部屋は利用できず、夕食オプションはBBQのみです。';
    if (!compactOk) { planText = '合計' + total + '名のため、少人数プラン（' + P.COMPACT_HARD_MAX + '名まで）は選べません。'; }
    else if (compact && total > P.COMPACT_COMFORT_MAX) {
      var rooms = DATA.rooms || {};
      var mid = rooms.s1f1 ? rooms.s1f1.max : '';
      var small = rooms.s1f2 ? rooms.s1f2.max : '';
      planText += '寝室2部屋の目安' + P.COMPACT_COMFORT_MAX + '名を超えます' + (mid && small ? '（中部屋' + mid + '名＋小部屋' + small + '名までの手狭な配置）' : '') + '。ご相談ください。';
    }
    els.planNote.textContent = (flash.plan ? flash.plan + ' ' : '') + planText;
    renderRateTable(compact);

    // 日程
    Array.prototype.forEach.call(nightInputs, function (input) { input.checked = Number(input.value) === s.nights; });
    for (var i = 0; i < MAX_NIGHTS; i += 1) {
      var row = nightRows[i];
      row.li.hidden = i >= s.nights;
      if (i >= s.nights) { continue; }
      row.select.value = s.seasons[i];
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
    els.lunch.value = s.lunch;
    els.lunch.disabled = !mealsOk;
    els.lunchNote.textContent = mealCaption(findDef(LUNCHES, s.lunch));
    for (var n = 0; n < MAX_NIGHTS; n += 1) {
      var mr = mealRows[n];
      mr.box.hidden = n >= s.nights;
      if (n >= s.nights) { continue; }
      mr.title.textContent = (n + 1) + '泊目の夜と、翌朝';
      mr.select.value = s.dinner[n];
      mr.select.disabled = !mealsOk;
      Array.prototype.forEach.call(mr.select.options, function (opt) {
        var def = findDef(DINNERS, opt.value);
        opt.disabled = compact && !def.compactOk;
        opt.textContent = mealOptionText(def) + (opt.disabled ? '（少人数プランでは選べません）' : '');
      });
      var dinnerDef = findDef(DINNERS, s.dinner[n]);
      var caption = mealCaption(dinnerDef);
      if (dinnerDef.seasonNote) {
        caption += (caption ? '。' : '') + dinnerDef.seasonNote;
      }
      if (dinnerDef.flat && !dinnerDef.mealKey && !dinnerDef.kidRates && dinnerDef.id !== 'byo' && (p.elem + p.pre) > 0) {
        caption += '。お子さま料金の記載がないため、全員同額で計算します（目安）';
      }
      mr.note.textContent = caption;
      setNum(mr.drink, s.drink[n], 0, Math.max(0, payers), force);
      mr.drink.disabled = !mealsOk;
      mr.bf.checked = s.breakfast[n];
      mr.bf.disabled = !mealsOk;
      var sando = P.MEALS[BREAKFAST.mealKey];
      mr.bfText.textContent = '翌朝（' + (n + 2) + '日目）の朝食　' + BREAKFAST.label + ' +' + priceYen(sando.adult) + '/人（全年齢同額）';
    }

    // オプション
    OPTIONS.forEach(function (def) {
      var refs = optionRefs[def.id];
      var blocked = def.id === 'room' && compact;
      refs.gate.hidden = !blocked;
      refs.gate.textContent = blocked ? '少人数プランでは大部屋・追加部屋を利用できません。' : '';
      def.fields.forEach(function (f) {
        var max = f.max === 'payers' ? Math.max(0, payers) : f.max;
        var value = s.opts[def.id][f.key];
        setNum(refs.inputs[f.key].input, value, 0, max, force);
        refs.inputs[f.key].input.disabled = blocked;
        Array.prototype.forEach.call(refs.inputs[f.key].input.parentNode.querySelectorAll('button'), function (b) {
          if (blocked) { b.disabled = true; }
        });
      });
      refs.card.classList.toggle('is-disabled', blocked);
    });

    // 割引
    var dn = '';
    var dnNames = [];
    if (s.nights >= 2) { dnNames.push('連泊割'); }
    if (s.local) { dnNames.push('地域割'); }
    if (s.repeat) { dnNames.push('リピート割'); }
    if (dnNames.length >= 2) {
      dn = dnNames.join('と') + 'を同時に使えるかは確認が取れていないため、割引率の大きい方（同率なら 連泊割→地域割→リピート割 の順）の1つだけを計算に入れています。';
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
    var secs = [
      section('宿泊', lodgingItems),
      section('お食事', res.meals.map(function (m) {
        return lineItem(m.label, m.detail + (m.note ? '（' + m.note + '）' : ''), fmt(m.amount));
      })),
      section('オプション', res.options.map(function (o) {
        return lineItem(o.label, o.detail, fmt(o.amount) + (o.approx ? '〜' : ''));
      }).concat(res.quotes.map(function (q) {
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
    var notes = ['最終的な料金は予約画面でご確認ください（料金区分・割引は目安です）'].concat(res.notes);
    notes.forEach(function (text) { els.notes.appendChild(h('li', '', text)); });
  }

  // ---- イベント -----------------------------------------------------------
  function update(force) {
    readState();
    normalize();
    writeBack(!!force);
    renderSummary(calculate(state));
  }

  form.addEventListener('input', function (e) {
    var t = e.target;
    update(false);
  });
  form.addEventListener('change', function (e) {
    var t = e.target;
    update(true);
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
    update(true);
  });

  els.toggle.addEventListener('click', function () {
    var open = els.summary.classList.toggle('is-open');
    els.toggle.setAttribute('aria-expanded', String(open));
    els.toggle.textContent = open ? '内訳 ▴' : '内訳 ▾';
  });

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
    defaultState: defaultState,
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  });
})();
