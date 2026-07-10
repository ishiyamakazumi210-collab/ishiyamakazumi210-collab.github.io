// 料金黒板（TOP / friends / gasshuku / family 共通）
// DOMを見てボードタイプを自動判別し、季節トグル・食事引き出し・人数ステッパーを結線する。
(function () {
  'use strict';

  // ---- 料金定数（唯一の定義元。数値を変更しないこと） -------------------
  var SEASONS = {
    weekday: { adult: 8400, elem: 5880, pre: 4200, minPeople: 5, floor: 42000 },
    holiday: { adult: 9900, elem: 6930, pre: 4950, minPeople: 7, floor: 69300 }
  };
  var MEALS = {
    byo: { adult: 0, elem: 0, pre: 0 },
    kyushoku: { adult: 1250, elem: 1250, pre: 1250 },
    bbq: { adult: 3500, elem: 2450, pre: 1750 },
    sando: { adult: 1000, elem: 1000, pre: 1000 }
  };
  var MEAL_LABELS = { kyushoku: '給食', bbq: '提供型BBQ', sando: 'サンド' };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmt(v) { return v.toLocaleString('ja-JP') + '円'; }

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
      var anyPaid = false;
      Object.keys(choice).forEach(function (slot) {
        if (choice[slot] !== 'byo') { anyPaid = true; }
      });
      mealStateEl.textContent = anyPaid ? '（有）' : '（無）';
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

  // ---- グループボード（TOP / friends / gasshuku） ------------------------
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

    var MAX = (stepperEl && parseInt(stepperEl.dataset.max, 10)) || 30;
    var initialSeasonBtn = Array.prototype.filter.call(seasonBtns, function (b) { return b.classList.contains('is-on'); })[0];
    var season = (initialSeasonBtn && initialSeasonBtn.dataset.season) || 'weekday';
    var n = parseInt(countEl.textContent, 10);
    if (isNaN(n)) { n = SEASONS[season].minPeople; }

    var meal = setupMealSlots(render);
    var slots = meal.slots;
    var choice = meal.choice;

    function render(animate) {
      var cfg = SEASONS[season];
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

  // ---- 家族ボード（family） ----------------------------------------------
  function initFamilyBoard() {
    var LIMITS = { adult: { min: 1, max: Infinity }, elem: { min: 0, max: 12 }, pre: { min: 0, max: 8 } };
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

    function render(animate) {
      var cfg = SEASONS[season];
      var sum = counts.adult * cfg.adult + counts.elem * cfg.elem + counts.pre * cfg.pre;
      var lodging = Math.max(sum, cfg.floor);
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
      if (totalLabelEl) { totalLabelEl.textContent = anyPaid ? '宿泊＋お食事で' : '宿泊料金'; }
      var parts = ['おとな' + counts.adult + '人'];
      if (counts.elem > 0) { parts.push('小学生' + counts.elem + '人'); }
      if (counts.pre > 0) { parts.push('3〜5歳' + counts.pre + '人'); }
      lineEl.textContent = parts.join(' ＋ ');
      totalEl.textContent = fmt(total);
      unitsEl.textContent = 'おとな ' + cfg.adult.toLocaleString('ja-JP') + '円・小学生 ' + cfg.elem.toLocaleString('ja-JP') + '円・3〜5歳 ' + cfg.pre.toLocaleString('ja-JP') + '円（1人あたり）';
      minEl.hidden = !(sum < cfg.floor);
      if (kidsStateEl) {
        var kidsCount = counts.elem + counts.pre;
        kidsStateEl.textContent = kidsCount > 0 ? '（' + kidsCount + '人）' : '（なし）';
      }
      Object.keys(counts).forEach(function (key) {
        if (countEls[key]) { countEls[key].textContent = counts[key]; }
        if (minusBtns[key]) { minusBtns[key].disabled = counts[key] <= LIMITS[key].min; }
        if (plusBtns[key]) { plusBtns[key].disabled = counts[key] >= LIMITS[key].max; }
      });
      if (animate) { animateRewrite([lineEl, totalEl]); }
    }

    Object.keys(counts).forEach(function (key) {
      if (!minusBtns[key] || !plusBtns[key]) { return; }
      minusBtns[key].addEventListener('click', function () {
        if (counts[key] > LIMITS[key].min) { counts[key] -= 1; render(true); }
      });
      plusBtns[key].addEventListener('click', function () {
        if (counts[key] < LIMITS[key].max) { counts[key] += 1; render(true); }
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
  } else if (document.getElementById('chalk-count')) {
    initGroupBoard();
  }
})();
