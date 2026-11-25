// 料金黒板（TOP / friends / gasshuku / family / kenshu / option 共通）
// DOMを見てボードタイプを自動判別し、季節トグル・食事引き出し・人数ステッパーを結線する。
(function () {
  'use strict';

  // ---- 料金定数（唯一の定義元。数値を変更しないこと） -------------------
  // 最低利用金額(floor)と総定員は site.json (minSpend.* / capacity.total) が
  // 唯一の元数字。表示用文字列から「12,345円」の金額部分を抽出して使う。
  var MIN_SPEND = (window.KATASHO_DATA && window.KATASHO_DATA.minSpend) || {};
  function yenOf(str) {
    var m = String(str || '').match(/([\d,]+)円/);
    return m ? Number(m[1].replace(/,/g, '')) : 0;
  }
  var SEASONS = {
    weekday: { adult: 8900, elem: 6230, pre: 4450, minPeople: 5, floor: yenOf(MIN_SPEND.weekday) },
    holiday: { adult: 9900, elem: 6930, pre: 4950, minPeople: 7, floor: yenOf(MIN_SPEND.holiday) }
  };
  var MEALS = {
    byo: { adult: 0, elem: 0, pre: 0 },
    kyushoku: { adult: 1250, elem: 1250, pre: 1250 },
    bbq: { adult: 3800, elem: 2660, pre: 1900 },
    sando: { adult: 1000, elem: 1000, pre: 1000 }
  };
  var MEAL_LABELS = { kyushoku: '給食', bbq: '提供型BBQ', sando: 'サンド' };
  // 食事オプションを閉じたときの状態表示用の短い名前（2026-11-24）
  var MEAL_STATE_LABELS = { kyushoku: '給食', bbq: 'BBQ', sando: '朝食' };
  var MAX_PEOPLE = parseInt(window.KATASHO_DATA && window.KATASHO_DATA.capacity && window.KATASHO_DATA.capacity.total, 10) || 100;

  // 少人数プランの寝室2部屋(中部屋s1f1・小部屋s1f2)の定員は site.json
  // (rooms.s1f1/rooms.s1f2、map-rooms.jsの部屋データと同じ単一データソース)
  // が唯一の元数字。COMPACT_HARD_MAX(=「手狭でもよければ」の最大の合計、
  // 2026-11-19オーナー確認)はここで計算するだけで、数字そのものは持たない。
  // プランの目安人数 COMPACT_GUIDE は site.json の compact.guide(=20、
  // 2026-11-24オーナー確認：目安20名くらい・最大30名の2つに統一)から読む。
  var ROOMS_DATA = (window.KATASHO_DATA && window.KATASHO_DATA.rooms) || {};
  function roomCapacityNum(roomId, field) {
    return parseInt((ROOMS_DATA[roomId] || {})[field], 10) || 0;
  }
  var COMPACT_MID_MAX = roomCapacityNum('s1f1', 'max'); // 中部屋(手狭最大)
  var COMPACT_SMALL_MAX = roomCapacityNum('s1f2', 'max'); // 小部屋(手狭最大)
  var COMPACT_HARD_MAX = COMPACT_MID_MAX + COMPACT_SMALL_MAX;
  var COMPACT_GUIDE = parseInt(window.KATASHO_DATA && window.KATASHO_DATA.compact && window.KATASHO_DATA.compact.guide, 10) || 20;

  // 少人数プラン（1階・20名くらいまで）: 大人-1,000円、子どもは
  // 割引後の大人料金へ既存の子ども割引率(小学生30%OFF/3〜5歳50%OFF)を掛け直す。
  // floorは「最低人数(5/7)×割引後大人料金」と一致する値（検算済み）。site.json由来。
  var COMPACT = {
    adultDelta: -1000,
    elemRatio: 0.7,
    preRatio: 0.5,
    floor: { weekday: yenOf(MIN_SPEND.compactWeekday), holiday: yenOf(MIN_SPEND.compactHoliday) }
  };

  // 季節×少人数プランの単価をまとめて返す、料金定数の唯一の参照口。
  // 通常時はSEASONS[season]をそのまま返す＝プラン分岐はここに一本化する。
  function getRates(season, compact) {
    var base = SEASONS[season];
    if (!compact) { return base; }
    var adult = base.adult + COMPACT.adultDelta;
    return {
      adult: adult,
      elem: Math.round(adult * COMPACT.elemRatio),
      pre: Math.round(adult * COMPACT.preRatio),
      minPeople: base.minPeople,
      floor: COMPACT.floor[season]
    };
  }

  // 料金定数の読み取り専用公開口。くわしい料金シミュレーター(/price-simulator/)が
  // ここを参照するため、料金の数字は引き続きこのファイル(+site.json)だけに存在する。
  // 公開するのは凍結したコピーなので、ボード側の挙動・定数には一切影響しない。
  function frozenCopy(obj) {
    var copy = JSON.parse(JSON.stringify(obj));
    (function freezeDeep(o) {
      Object.keys(o).forEach(function (key) {
        if (o[key] && typeof o[key] === 'object') { freezeDeep(o[key]); }
      });
      Object.freeze(o);
    })(copy);
    return copy;
  }
  window.KATASHO_PRICING = Object.freeze({
    SEASONS: frozenCopy(SEASONS),
    MEALS: frozenCopy(MEALS),
    MEAL_LABELS: frozenCopy(MEAL_LABELS),
    COMPACT: frozenCopy(COMPACT),
    COMPACT_HARD_MAX: COMPACT_HARD_MAX,
    COMPACT_GUIDE: COMPACT_GUIDE,
    MAX_PEOPLE: MAX_PEOPLE,
    getRates: function (season, compact) {
      return frozenCopy(getRates(season, compact));
    }
  });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmt(v) { return v.toLocaleString('ja-JP') + '円'; }

  function renderFamilyUnits(el, cfg) {
    el.classList.add('top-v2-chalk-unitline');
    el.textContent = '';
    [
      ['おとな', cfg.adult],
      ['小学生', cfg.elem],
      ['3〜5歳', cfg.pre]
    ].forEach(function (item) {
      var part = document.createElement('span');
      part.className = 'top-v2-chalk-unitpart';
      part.textContent = item[0] + ' ' + fmt(item[1]);
      el.appendChild(part);
    });
    var note = document.createElement('span');
    note.className = 'top-v2-chalk-unitnote';
    note.textContent = '（宿泊のみ・1人あたり）';
    el.appendChild(note);
  }

  function animateRewrite(els) {
    if (reduceMotion) { return; }
    els.forEach(function (el) {
      if (!el) { return; }
      el.classList.remove('chalk-rewrite');
      void el.offsetWidth;
      el.classList.add('chalk-rewrite');
    });
  }

  // ---- 食事引き出し（両ボード共通） --------------------------------------
  // [data-slot][data-meal] ボタンを slot ごとにグループ化し、ラジオ挙動にする。
  // 初期選択は HTML 側で is-on が付いているボタンを尊重する（無ければ先頭）。
  function setupMealSlots(onChange) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-slot][data-meal]'));
    var slots = {};
    buttons.forEach(function (btn) {
      var slot = btn.dataset.slot;
      if (!slots[slot]) { slots[slot] = []; }
      slots[slot].push(btn);
    });
    var choice = {};
    Object.keys(slots).forEach(function (slot) {
      var arr = slots[slot];
      var onBtn = arr.filter(function (b) { return b.classList.contains('is-on'); })[0] || arr[0];
      choice[slot] = onBtn.dataset.meal;
    });

    // summary内に選択状態（有/無）を表示する。data-slotボタンを含むdetailsを
    // 対象にすることで、今後増える他のdetails（お子さま人数など）と混同しない。
    // spanが無ければJS側で生成する（HTMLは5ページとも触らない）。
    var mealDetails = buttons.length ? buttons[0].closest('details') : null;
    var mealSummary = mealDetails && mealDetails.querySelector('.top-v2-chalk-menu-summary');
    var mealStateEl = null;
    if (mealSummary) {
      mealStateEl = mealSummary.querySelector('.top-v2-chalk-menu-state');
      if (!mealStateEl) {
        mealStateEl = document.createElement('span');
        mealStateEl.className = 'top-v2-chalk-menu-state';
        mealSummary.appendChild(mealStateEl);
      }
    }
    function applyMealState() {
      if (!mealStateEl) { return; }
      // 入っている食事の短い名前を並べる（例「（給食・BBQ・朝食）」）。
      // 並びはHTMLのslot順（昼→夕→朝）に従う。
      var names = [];
      Object.keys(slots).forEach(function (slot) {
        var key = choice[slot];
        if (key !== 'byo') { names.push(MEAL_STATE_LABELS[key] || MEAL_LABELS[key] || key); }
      });
      mealStateEl.textContent = names.length ? '（' + names.join('・') + '）' : '（なし）';
    }
    function applyUI() {
      Object.keys(slots).forEach(function (slot) {
        slots[slot].forEach(function (btn) {
          var on = btn.dataset.meal === choice[slot];
          btn.classList.toggle('is-on', on);
          btn.setAttribute('aria-pressed', String(on));
        });
      });
      applyMealState();
    }
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        choice[btn.dataset.slot] = btn.dataset.meal;
        applyUI();
        onChange(true);
      });
    });
    applyUI();
    return { slots: slots, choice: choice };
  }

  // ---- 少人数プラン切替（全ボード共通） --------------------------------
  // [data-plan="compact"] のチェックボックス1個を見る。状態ラベル（適用中/なし）
  // はsummary内の.top-v2-chalk-menu-stateに書き込む（食事オプション／お子さま
  // 人数と同じ文法）。チェックボックス自体は6ページのHTMLに直書きしてある。
  function setupPlanToggle(onChange) {
    var input = document.querySelector('[data-plan="compact"]');
    if (!input) {
      return {
        isCompact: function () { return false; },
        setEligibility: function () {}
      };
    }
    var details = input.closest('details');
    var stateEl = details && details.querySelector('.top-v2-chalk-menu-state');
    var eligible = true;
    function applyState() {
      if (!stateEl) { return; }
      stateEl.textContent = input.checked ? (eligible ? '（適用中）' : '（対象外）') : '（なし）';
    }
    applyState();
    input.addEventListener('change', function () {
      applyState();
      onChange(true);
    });
    return {
      isCompact: function () { return input.checked; },
      setEligibility: function (value) {
        eligible = value;
        applyState();
      }
    };
  }

  // ---- 定員注意行（少人数プラン専用・非ブロッキング） ------------------
  // .top-v2-chalkboard--artの直後にJS側で1個だけ差し込む。食事状態spanと同じく
  // 状態依存の生成物のため、6ページのHTMLは触らずJS側で完結させる。
  function compactGuideOverText() {
    return '※ 少人数プランの目安（' + COMPACT_GUIDE + '名くらい）を超えています。最大' + COMPACT_HARD_MAX + '名まで泊まれますが、手狭になることがあるのでご相談ください';
  }
  // 少人数プランを使っていないときの一言（F3・2026-11-24）。数字は定数から組む。
  // トップの帯(.top-v2-price-min)が同じことを言っているページでは出さない。
  function compactHintText() {
    return '※ ' + COMPACT_GUIDE + '名くらいまでなら、少人数プラン（1階）で1人' + fmt(-COMPACT.adultDelta) + '引きにできます';
  }
  var HAS_PRICE_MIN_BAND = !!document.querySelector('.top-v2-price-min');
  function setupCapacityNotice() {
    var board = document.querySelector('.top-v2-chalkboard--art');
    if (!board) { return null; }
    var notice = document.createElement('p');
    notice.className = 'top-v2-chalk-capacity-notice';
    notice.textContent = compactGuideOverText();
    notice.hidden = true;
    board.insertAdjacentElement('afterend', notice);
    return notice;
  }
  function updateCapacityNotice(notice, compact, totalPeople) {
    if (!notice) { return; }
    if (!compact) {
      // 少人数プランなし：上限以下なら1,000円引きの案内（トップの帯があるページは出さない）
      notice.hidden = HAS_PRICE_MIN_BAND || totalPeople > COMPACT_HARD_MAX;
      if (!notice.hidden) { notice.textContent = compactHintText(); }
      return;
    }
    notice.hidden = totalPeople <= COMPACT_GUIDE;
    if (notice.hidden) { return; }
    notice.textContent = totalPeople <= COMPACT_HARD_MAX
      ? compactGuideOverText()
      : '※ 少人数プランの上限' + COMPACT_HARD_MAX + '名を超えるため、スタンダードプラン料金で計算しています';
  }

  // ---- 黒板の中の「ハイシーズンの平日」の1行（2026-11-25） ------------------
  // 人物シミュレーションで、ハイシーズンの平日に泊まる人が「平日」のまま黒板の
  // 数字だけ見て、1人1,000円安く伝えた。数字だけ見る人に届く場所は黒板の中しか
  // ないため、平日を選んでいるあいだだけ、同じ条件の土日祝・ハイシーズンの金額を
  // 黒板の中に1行出す。期間の日付はボタンの下の1行（high-season-note.html）にある。
  // スマホ幅（767px以下）は黒板に入りきらない（測ると最大33pxはみ出した）ので、
  // 同じ1行を黒板のすぐ下にも作り、どちらを見せるかはCSSで幅ごとに切り替える。
  // 期間の日付は site.json の highSeason（ボタンの下の1行と同じ元データ）。
  // 2026-11-25 実装後の読み手の確かめで、「春休み」だけでは2月・4月上旬の人が気づかなかったため日付も入れる。
  var HIGH_SEASON = (window.KATASHO_DATA && window.KATASHO_DATA.highSeason) || {};
  var SEASON_HINT_PARTS = [
    ['夏休み ' + (HIGH_SEASON.summer || '7/15〜9/30')], '・',
    ['春休み ' + (HIGH_SEASON.spring || '2/1〜4/10')], '・GW・',
    ['年末年始 ' + (HIGH_SEASON.yearEnd || '12/28〜1/3')], ' は、平日も '
  ];
  function setupSeasonHint() {
    var board = document.querySelector('.top-v2-chalkboard--art');
    var sub = board && board.querySelector('.top-v2-chalk-sub');
    if (!board || !sub) { return null; }
    var inside = document.createElement('li');
    inside.className = 'top-v2-chalk-season-hint';
    inside.hidden = true;
    sub.insertBefore(inside, sub.firstChild);
    var below = document.createElement('p');
    below.className = 'top-v2-chalk-season-hint-below';
    below.hidden = true;
    board.insertAdjacentElement('afterend', below);
    return [inside, below];
  }
  function nowrapSpan(text) {
    var span = document.createElement('span');
    span.className = 'top-v2-nowrap';
    span.textContent = text;
    return span;
  }
  // amountText の後ろに、土日祝・ハイシーズンの最低人数（7人）に満たないときだけ
  // 「（7人から）」を付ける（呼び出し側が人数を見て suffix を渡す）。
  function updateSeasonHint(els, season, amountText, suffix) {
    if (!els) { return; }
    els.forEach(function (el) {
      el.hidden = season !== 'weekday';
      if (el.hidden) { return; }
      el.textContent = '';
      SEASON_HINT_PARTS.forEach(function (part) {
        el.appendChild(typeof part === 'string' ? document.createTextNode(part) : nowrapSpan(part[0]));
      });
      el.appendChild(nowrapSpan(amountText + (suffix || '')));
    });
  }
  // ---- 「オプションも入れて、くわしく計算 →」へ黒板の条件を渡す（2026-11-25） ------
  // 人数・少人数プランは reserve-handoff.js が付ける（adult・elem・pre・plan）。ここでは
  // 黒板の季節（season=holiday）とお食事（lunch・dinner・bf=1）を付ける。
  // 平日・食事なしのときは付けない（くわしい計算の初期値のまま）。price-simulator.js が読む。
  function updateDetailLink(season, choice) {
    // リンクは黒板より後ろにあることがあるので、そのつど探す
    Array.prototype.forEach.call(document.querySelectorAll('.top-v2-sim-more-link'), function (a) {
      var url;
      try { url = new URL(a.getAttribute('href'), window.location.origin); } catch (e) { return; }
      if (url.pathname !== '/price-simulator/') { return; }
      var set = function (key, value) {
        if (value) { url.searchParams.set(key, value); } else { url.searchParams.delete(key); }
      };
      set('season', season === 'holiday' ? 'holiday' : '');
      set('lunch', choice.lunch && choice.lunch !== 'byo' ? choice.lunch : '');
      set('dinner', choice.dinner && choice.dinner !== 'byo' ? choice.dinner : '');
      set('bf', choice.morning === 'sando' ? '1' : '');
      var next = url.pathname + url.search + url.hash;
      if (a.getAttribute('href') !== next) { a.setAttribute('href', next); }
    });
  }
  // 式（人数の並び）を、1かたまりずつ折れない部品にして並べる。幅がせまい・字が大きいときは、
  // かたまりの切れ目で2行に折れる（かたまりの途中では折れない）。2026-11-25
  function setFormulaParts(el, parts) {
    el.textContent = '';
    parts.forEach(function (part, i) {
      if (i > 0 && part.charAt(0) !== '（') { el.appendChild(document.createTextNode(' ')); }
      el.appendChild(nowrapSpan(part));
    });
  }
  function holidayMinSuffix(adults) {
    var min = SEASONS.holiday.minPeople;
    return adults < min ? '（' + min + '人から）' : '';
  }

  // ---- グループボード（friends / gasshuku / kenshu） ---------------------
  function initGroupBoard() {
    var unitEl = document.getElementById('chalk-unit');
    var perEl = document.getElementById('chalk-per');
    var nEl = document.getElementById('chalk-n');
    var totalEl = document.getElementById('chalk-total');
    var countEl = document.getElementById('chalk-count');
    var breakdownEl = document.getElementById('chalk-breakdown');
    var minus = document.getElementById('chalk-minus');
    var plus = document.getElementById('chalk-plus');
    var stepperEl = document.querySelector('.top-v2-chalk-stepper');
    var seasonBtns = document.querySelectorAll('.top-v2-chalk-season .top-v2-chalk-tab');
    if (!unitEl || !nEl || !totalEl || !countEl || !minus || !plus) { return; }
    totalEl.setAttribute('aria-live', 'polite');
    // こたえの前置き：data-answer-prefix があれば、先頭の文字だけ差し替える
    var groupAnswerEl = document.querySelector('.top-v2-chalk-answer');
    var groupPrefix = groupAnswerEl && groupAnswerEl.getAttribute('data-answer-prefix');
    if (groupPrefix && groupAnswerEl.firstChild && groupAnswerEl.firstChild.nodeType === 3) {
      groupAnswerEl.firstChild.nodeValue = groupPrefix + ' ';
    }

    var requestedMax = stepperEl && parseInt(stepperEl.dataset.max, 10);
    var MAX = Math.min(requestedMax || MAX_PEOPLE, MAX_PEOPLE);
    var initialSeasonBtn = Array.prototype.filter.call(seasonBtns, function (b) { return b.classList.contains('is-on'); })[0];
    var season = (initialSeasonBtn && initialSeasonBtn.dataset.season) || 'weekday';
    var n = parseInt(countEl.textContent, 10);
    if (isNaN(n)) { n = SEASONS[season].minPeople; }

    var meal = setupMealSlots(render);
    var slots = meal.slots;
    var choice = meal.choice;
    var plan = setupPlanToggle(render);
    var capacityNotice = setupCapacityNotice();
    var seasonHint = setupSeasonHint();

    function render(animate) {
      var compactEligible = n <= COMPACT_HARD_MAX;
      plan.setEligibility(compactEligible);
      var cfg = getRates(season, plan.isCompact() && compactEligible);
      var holidayCfg = getRates('holiday', plan.isCompact() && compactEligible);
      if (n < cfg.minPeople) { n = cfg.minPeople; }
      var mealCost = 0;
      var bdParts = ['宿泊 ' + fmt(cfg.adult)];
      Object.keys(slots).forEach(function (slot) {
        var mealKey = choice[slot];
        if (mealKey !== 'byo') {
          var price = MEALS[mealKey].adult;
          mealCost += price;
          bdParts.push((MEAL_LABELS[mealKey] || mealKey) + ' ' + fmt(price));
        }
      });
      var unit = cfg.adult + mealCost;
      unitEl.textContent = fmt(unit);
      if (perEl) { perEl.textContent = fmt(unit); }
      countEl.textContent = n + '人';
      nEl.textContent = n + '人';
      totalEl.textContent = fmt(unit * n);
      if (breakdownEl) { breakdownEl.textContent = '1人あたり: ' + bdParts.join(' ＋ '); }
      minus.disabled = n <= cfg.minPeople;
      plus.disabled = n >= MAX;
      updateDetailLink(season, choice);
      updateCapacityNotice(capacityNotice, plan.isCompact(), n);
      updateSeasonHint(seasonHint, season, '1人 ' + fmt(holidayCfg.adult + mealCost) + '〜', holidayMinSuffix(n));
      if (animate) { animateRewrite([unitEl, nEl, totalEl]); }
    }

    minus.addEventListener('click', function () { if (n > SEASONS[season].minPeople) { n -= 1; render(true); } });
    plus.addEventListener('click', function () { if (n < MAX) { n += 1; render(true); } });
    seasonBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        season = btn.dataset.season;
        seasonBtns.forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render(true);
      });
    });

    render(false);
  }

  // ---- 人数内訳ボード（TOP / family / option） ----------------------------
  function initFamilyBoard() {
    var MINIMUMS = { adult: 1, elem: 0, pre: 0 };
    var lineEl = document.getElementById('fam-line');
    var totalEl = document.getElementById('fam-total');
    var unitsEl = document.getElementById('fam-units');
    var minEl = document.getElementById('fam-min');
    var totalLabelEl = document.getElementById('fam-total-label');
    var seasonBtns = document.querySelectorAll('.top-v2-chalk-season .top-v2-chalk-tab');
    var countEls = { adult: document.getElementById('fam-adult'), elem: document.getElementById('fam-elem'), pre: document.getElementById('fam-pre') };
    var minusBtns = { adult: document.getElementById('fam-adult-minus'), elem: document.getElementById('fam-elem-minus'), pre: document.getElementById('fam-pre-minus') };
    var plusBtns = { adult: document.getElementById('fam-adult-plus'), elem: document.getElementById('fam-elem-plus'), pre: document.getElementById('fam-pre-plus') };
    var kidsMenuEl = document.querySelector('.top-v2-chalk-menu--kids');
    var kidsStateEl = kidsMenuEl ? kidsMenuEl.querySelector('.top-v2-chalk-menu-state') : null;
    if (!lineEl || !totalEl || !unitsEl || !minEl) { return; }
    totalEl.setAttribute('aria-live', 'polite');

    var initialSeasonBtn = Array.prototype.filter.call(seasonBtns, function (b) { return b.classList.contains('is-on'); })[0];
    var season = (initialSeasonBtn && initialSeasonBtn.dataset.season) || 'weekday';
    var counts = {
      adult: parseInt(countEls.adult && countEls.adult.textContent, 10) || 0,
      elem: parseInt(countEls.elem && countEls.elem.textContent, 10) || 0,
      pre: parseInt(countEls.pre && countEls.pre.textContent, 10) || 0
    };

    var meal = setupMealSlots(render);
    var slots = meal.slots;
    var choice = meal.choice;
    var plan = setupPlanToggle(render);
    var capacityNotice = setupCapacityNotice();
    var seasonHint = setupSeasonHint();

    function render(animate) {
      var totalPeople = counts.adult + counts.elem + counts.pre;
      var compactEligible = totalPeople <= COMPACT_HARD_MAX;
      plan.setEligibility(compactEligible);
      var cfg = getRates(season, plan.isCompact() && compactEligible);
      var holidayCfg = getRates('holiday', plan.isCompact() && compactEligible);
      var sum = counts.adult * cfg.adult + counts.elem * cfg.elem + counts.pre * cfg.pre;
      var lodging = Math.max(sum, cfg.floor);
      var holidaySum = counts.adult * holidayCfg.adult + counts.elem * holidayCfg.elem + counts.pre * holidayCfg.pre;
      var holidayLodging = Math.max(holidaySum, holidayCfg.floor);
      var mealTotal = 0;
      var anyPaid = false;
      Object.keys(slots).forEach(function (slot) {
        var mealKey = choice[slot];
        if (mealKey !== 'byo') {
          anyPaid = true;
          var m = MEALS[mealKey];
          mealTotal += counts.adult * m.adult + counts.elem * m.elem + counts.pre * m.pre;
        }
      });
      var total = lodging + mealTotal;
      updateSeasonHint(seasonHint, season, fmt(holidayLodging + mealTotal) + '〜');
      if (totalLabelEl) { totalLabelEl.textContent = anyPaid ? '宿泊＋お食事で' : '宿泊料金'; }
      var parts = ['おとな' + counts.adult + '人'];
      if (counts.elem > 0) { parts.push('小学生' + counts.elem + '人'); }
      if (counts.pre > 0) { parts.push('3〜5歳' + counts.pre + '人'); }
      setFormulaParts(lineEl, parts.map(function (part, i) { return i > 0 ? '＋ ' + part : part; }));
      totalEl.textContent = fmt(total);
      renderFamilyUnits(unitsEl, cfg);
      minEl.hidden = !(sum < cfg.floor);
      if (kidsStateEl) {
        var kidsCount = counts.elem + counts.pre;
        kidsStateEl.textContent = kidsCount > 0 ? '（' + kidsCount + '人）' : '（なし）';
      }
      Object.keys(counts).forEach(function (key) {
        if (countEls[key]) { countEls[key].textContent = counts[key]; }
        if (minusBtns[key]) { minusBtns[key].disabled = counts[key] <= MINIMUMS[key]; }
        if (plusBtns[key]) { plusBtns[key].disabled = totalPeople >= MAX_PEOPLE; }
      });
      updateDetailLink(season, choice);
      updateCapacityNotice(capacityNotice, plan.isCompact(), totalPeople);
      if (animate) { animateRewrite([lineEl, totalEl]); }
    }

    Object.keys(counts).forEach(function (key) {
      if (!minusBtns[key] || !plusBtns[key]) { return; }
      minusBtns[key].addEventListener('click', function () {
        if (counts[key] > MINIMUMS[key]) { counts[key] -= 1; render(true); }
      });
      plusBtns[key].addEventListener('click', function () {
        if (counts.adult + counts.elem + counts.pre < MAX_PEOPLE) { counts[key] += 1; render(true); }
      });
    });
    seasonBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        season = btn.dataset.season;
        seasonBtns.forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render(true);
      });
    });

    render(false);
  }

  // ---- 旧ハイブリッドボード（現行ページでは未使用・互換用） ---------------
  // chalk-count（おとな人数のgroupステッパー）とfam-elem/fam-pre（お子さま
  // 人数のfamilyステッパー）が同居するボード専用。子ども0人のときは
  // initGroupBoardと1文字も変わらない表示を保ち、1人以上になったら
  // 家族ボード相当の内訳表示（おとな/小学生/3〜5歳の単価内訳＋合計）へ切替える。
  function initHybridBoard() {
    var countEl = document.getElementById('chalk-count');
    var minus = document.getElementById('chalk-minus');
    var plus = document.getElementById('chalk-plus');
    var stepperEl = document.querySelector('.top-v2-chalk-stepper');
    var seasonBtns = document.querySelectorAll('.top-v2-chalk-season .top-v2-chalk-tab');
    var formulaEl = document.querySelector('.top-v2-chalk-formula');
    var answerEl = document.querySelector('.top-v2-chalk-answer');
    var breakdownEl = document.getElementById('chalk-breakdown');
    if (!countEl || !minus || !plus || !formulaEl || !answerEl || !breakdownEl) { return; }
    // こたえの前置き。研修ページは data-answer-prefix="こたえ：1人あたり"（無ければ割り勘）
    var answerPrefix = answerEl.getAttribute('data-answer-prefix') || 'こたえ：割り勘で 1人';

    var KID_MINIMUMS = { elem: 0, pre: 0 };
    var countEls = { elem: document.getElementById('fam-elem'), pre: document.getElementById('fam-pre') };
    var minusBtns = { elem: document.getElementById('fam-elem-minus'), pre: document.getElementById('fam-pre-minus') };
    var plusBtns = { elem: document.getElementById('fam-elem-plus'), pre: document.getElementById('fam-pre-plus') };
    var kidsMenuEl = document.querySelector('.top-v2-chalk-menu--kids');
    var kidsStateEl = kidsMenuEl ? kidsMenuEl.querySelector('.top-v2-chalk-menu-state') : null;

    var requestedMax = stepperEl && parseInt(stepperEl.dataset.max, 10);
    var MAX = Math.min(requestedMax || MAX_PEOPLE, MAX_PEOPLE);
    var initialSeasonBtn = Array.prototype.filter.call(seasonBtns, function (b) { return b.classList.contains('is-on'); })[0];
    var season = (initialSeasonBtn && initialSeasonBtn.dataset.season) || 'weekday';
    var n = parseInt(countEl.textContent, 10);
    if (isNaN(n)) { n = SEASONS[season].minPeople; }
    var counts = {
      elem: parseInt(countEls.elem && countEls.elem.textContent, 10) || 0,
      pre: parseInt(countEls.pre && countEls.pre.textContent, 10) || 0
    };

    var meal = setupMealSlots(render);
    var slots = meal.slots;
    var choice = meal.choice;
    var plan = setupPlanToggle(render);
    var capacityNotice = setupCapacityNotice();
    var seasonHint = setupSeasonHint();

    function render(animate) {
      if (n < SEASONS[season].minPeople) { n = SEASONS[season].minPeople; }
      var totalPeople = n + counts.elem + counts.pre;
      var compactEligible = totalPeople <= COMPACT_HARD_MAX;
      plan.setEligibility(compactEligible);
      var cfg = getRates(season, plan.isCompact() && compactEligible);
      var holidayCfg = getRates('holiday', plan.isCompact() && compactEligible);

      var mealCost = { adult: 0, elem: 0, pre: 0 };
      var bdParts = ['宿泊 ' + fmt(cfg.adult)];
      var anyPaid = false;
      Object.keys(slots).forEach(function (slot) {
        var mealKey = choice[slot];
        if (mealKey !== 'byo') {
          anyPaid = true;
          var m = MEALS[mealKey];
          mealCost.adult += m.adult;
          mealCost.elem += m.elem;
          mealCost.pre += m.pre;
          bdParts.push((MEAL_LABELS[mealKey] || mealKey) + ' ' + fmt(m.adult));
        }
      });

      var adultUnit = cfg.adult + mealCost.adult;
      var elemUnit = cfg.elem + mealCost.elem;
      var preUnit = cfg.pre + mealCost.pre;
      var kidsCount = counts.elem + counts.pre;
      // おとな最小人数ルールでn*adultUnitがcfg.floor（=minPeople×cfg.adult。
      // 通常・少人数プランどちらも一致するよう定数を設計済み）を自動的に
      // 上回るため、家族ボードのようなfloor補正は不要。
      var total = n * adultUnit + counts.elem * elemUnit + counts.pre * preUnit;

      countEl.textContent = n + '人';
      minus.disabled = n <= cfg.minPeople;
      plus.disabled = totalPeople >= MAX;

      ['elem', 'pre'].forEach(function (key) {
        if (countEls[key]) { countEls[key].textContent = counts[key]; }
        if (minusBtns[key]) { minusBtns[key].disabled = counts[key] <= KID_MINIMUMS[key]; }
        if (plusBtns[key]) { plusBtns[key].disabled = totalPeople >= MAX; }
      });
      if (kidsStateEl) {
        kidsStateEl.textContent = kidsCount > 0 ? '（' + kidsCount + '人）' : '（なし）';
      }

      var animateTargets;
      if (kidsCount === 0) {
        // 子ども0人: initGroupBoardと1文字も変わらない表示（式は×＝、こたえは割り勘）
        formulaEl.innerHTML = '<span id="chalk-unit">' + fmt(adultUnit) + '</span> <span class="top-v2-chalk-op">×</span> <span id="chalk-n">' + n + '人</span> <span class="top-v2-chalk-op">=</span> <span id="chalk-total">' + fmt(total) + '</span>';
        answerEl.innerHTML = answerPrefix + ' <strong id="chalk-per">' + fmt(adultUnit) + '</strong>〜';
        breakdownEl.textContent = '1人あたり: ' + bdParts.join(' ＋ ');
        animateTargets = [document.getElementById('chalk-unit'), document.getElementById('chalk-n'), document.getElementById('chalk-total')];
      } else {
        // お子さま1人以上: 家族ボード相当の内訳表示に切替
        var formulaParts = ['おとな' + n + '人'];
        if (counts.elem > 0) { formulaParts.push('＋ 小学生' + counts.elem + '人'); }
        if (counts.pre > 0) { formulaParts.push('（＋ 3〜5歳' + counts.pre + '人）'); }
        setFormulaParts(formulaEl, formulaParts);
        answerEl.innerHTML = 'こたえ：みんなで <strong>' + fmt(total) + '</strong>〜';
        breakdownEl.textContent = '1人あたり: おとな ' + fmt(adultUnit) + '・小学生 ' + fmt(elemUnit) + '・3〜5歳 ' + fmt(preUnit) + (anyPaid ? '（お食事込み）' : '');
        animateTargets = [formulaEl, answerEl];
      }
      // 黒板の中の「ハイシーズンの平日」の1行：子ども0人なら1人あたり、1人以上ならみんなでの合計で
      // （土日祝・ハイシーズンは最低人数が7人なので、宿泊は最低利用金額を下回らないようにする）
      var holidayAdultUnit = holidayCfg.adult + mealCost.adult;
      if (kidsCount === 0) {
        updateSeasonHint(seasonHint, season, '1人 ' + fmt(holidayAdultUnit) + '〜', holidayMinSuffix(n));
      } else {
        // このボードは土日祝に切り替えると、おとなを最低人数（7人）まで自動で増やす。
        // 切り替えたときに出る金額と同じになるよう、ここでも同じ人数で計算する。
        var holidayAdults = Math.max(n, holidayCfg.minPeople);
        var holidayTotal = holidayAdults * holidayAdultUnit + counts.elem * (holidayCfg.elem + mealCost.elem) + counts.pre * (holidayCfg.pre + mealCost.pre);
        updateSeasonHint(seasonHint, season, 'みんなで ' + fmt(holidayTotal) + '〜', holidayMinSuffix(n));
      }
      updateDetailLink(season, choice);
      updateCapacityNotice(capacityNotice, plan.isCompact(), totalPeople);
      if (animate) { animateRewrite(animateTargets); }
    }

    minus.addEventListener('click', function () { if (n > SEASONS[season].minPeople) { n -= 1; render(true); } });
    plus.addEventListener('click', function () { if (n + counts.elem + counts.pre < MAX) { n += 1; render(true); } });
    ['elem', 'pre'].forEach(function (key) {
      if (!minusBtns[key] || !plusBtns[key]) { return; }
      minusBtns[key].addEventListener('click', function () {
        if (counts[key] > KID_MINIMUMS[key]) { counts[key] -= 1; render(true); }
      });
      plusBtns[key].addEventListener('click', function () {
        if (n + counts.elem + counts.pre < MAX) { counts[key] += 1; render(true); }
      });
    });
    seasonBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        season = btn.dataset.season;
        seasonBtns.forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render(true);
      });
    });

    render(false);
  }

  // ---- ボードタイプ自動判別 ------------------------------------------------
  if (document.getElementById('fam-adult')) {
    initFamilyBoard();
  } else if (document.getElementById('chalk-count') && document.getElementById('fam-elem')) {
    initHybridBoard();
  } else if (document.getElementById('chalk-count')) {
    initGroupBoard();
  }
})();
