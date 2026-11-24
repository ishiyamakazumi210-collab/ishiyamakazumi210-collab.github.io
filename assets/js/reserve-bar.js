// スマホの予約バー（2026-11-21）。見た目は top-v2.css 末尾、置き場所は partials/footer.html。
// 1) 最初の画面を過ぎたら下から出し、ページの上の方へ戻ったら隠す（PCではCSSで出さない）
// 2) ふだんは「1人 7,900円〜 ※平日・少人数プラン」（一番安い値段を大きく、条件は小さく。2026-11-21 オーナー案）。
//    料金計算のあるページで人数などを一度でもさわったら、「いまの計算」の金額に替える
(function () {
  'use strict';

  var bar = document.getElementById('reserveBar');
  if (!bar) { return; }
  var labelEl = document.getElementById('reserveBarLabel');
  var mainEl = document.getElementById('reserveBarMain');
  var condEl = document.getElementById('reserveBarCond');

  // ---- 出し入れ ----------------------------------------------------------
  var queued = false;
  function updateVisible() {
    queued = false;
    bar.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6);
  }
  function queueVisible() {
    if (queued) { return; }
    queued = true;
    (window.requestAnimationFrame || window.setTimeout)(updateVisible);
  }
  window.addEventListener('scroll', queueVisible, { passive: true });
  window.addEventListener('resize', queueVisible);
  updateVisible();

  // ---- いまの計算 --------------------------------------------------------
  function byId(id) { return document.getElementById(id); }
  function countOf(el) {
    if (!el) { return 0; }
    var m = String(el.textContent || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  var adultEl = byId('fam-adult') || byId('chalk-count');
  if (!adultEl) { return; }

  function estimate() {
    var people = countOf(adultEl) + countOf(byId('fam-elem')) + countOf(byId('fam-pre'));
    if (!people) { return null; }
    var famTotal = byId('fam-total');
    var answer = document.querySelector('.top-v2-chalk-answer');
    var text;
    if (famTotal && famTotal.textContent.trim()) {
      text = people + '人で ' + famTotal.textContent.trim() + '〜';
    } else if (answer) {
      var t = answer.textContent.replace(/\s+/g, '');
      var per = t.match(/1人([\d,]+円)/);
      var total = t.match(/みんなで([\d,]+円)/);
      if (per) { text = people + '人で 1人' + per[1] + '〜'; } else if (total) { text = people + '人で ' + total[1] + '〜'; }
    }
    if (!text) { return null; }
    var on = document.querySelector('.top-v2-chalk-season .top-v2-chalk-tab.is-on');
    var season = on ? (on.dataset.season === 'holiday' ? '土日祝' : '平日') : '';
    return { main: text, label: 'いまの計算' + (season ? '（' + season + '）' : '') };
  }

  var touched = false;
  function render() {
    if (!touched) { return; }
    var e = estimate();
    if (!e) { return; }
    mainEl.textContent = e.main;
    labelEl.textContent = e.label;
    labelEl.hidden = false;
    if (condEl) { condEl.hidden = true; }
    bar.classList.add('is-estimate');
  }
  // 料金計算の部品（人数の＋−・平日/土日祝・食事やプランの切り替え）をさわったら
  var BOARD_PARTS = '.top-v2-chalk-step, .top-v2-chalk-tab, .top-v2-chalk-menu, .top-v2-chalk-stepper, .top-v2-chalk-family';
  function onBoard(e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest(BOARD_PARTS)) { return; }
    touched = true;
    setTimeout(render, 0);
  }
  document.addEventListener('click', onBoard, true);
  document.addEventListener('change', onBoard, true);
})();
