// 改良案の見本ページ（/sample/ と /sample/gasshuku/）専用。
// pricing-board.js は変更せず、その描画結果（DOM）を読んで追随する。
//  1. 予約リンク（489pro-x.com 宛て）に、料金計算の「おとな人数」を ?num= で付ける
//  2. 合宿見本: 下部固定バーの金額と「この内容をLINEで送る」の本文を料金計算に合わせる
(function () {
  'use strict';

  var RESERVE_HOST = '489pro-x.com';
  var SHARE_PAGE_URL = 'https://katasho.jp/gasshuku/';

  function numOf(el) {
    if (!el) { return null; }
    var m = String(el.textContent || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // TOP=おとな人数ステッパー(#fam-adult)、合宿=人数ステッパー(#chalk-count)
  var adultEl = document.getElementById('fam-adult') || document.getElementById('chalk-count');

  function applyReserveNum() {
    var n = numOf(adultEl);
    var links = document.querySelectorAll('a[href*="' + RESERVE_HOST + '"]');
    Array.prototype.forEach.call(links, function (a) {
      var url;
      try { url = new URL(a.href); } catch (e) { return; }
      if (n) { url.searchParams.set('num', String(n)); } else { url.searchParams.delete('num'); }
      var next = url.toString();
      if (a.href !== next) { a.href = next; }
    });
  }

  // ---- 合宿見本: 固定バーとLINE本文 --------------------------------------
  var perEl = document.getElementById('chalk-per');
  var nEl = document.getElementById('chalk-n');
  var breakdownEl = document.getElementById('chalk-breakdown');
  var barN = document.getElementById('sampleBarN');
  var barPer = document.getElementById('sampleBarPer');
  var barLabel = document.getElementById('sampleBarLabel');
  var lineShare = document.getElementById('sampleLineShare');

  // 料金計算の内訳行（例「1人あたり: 宿泊 8,900円 ＋ 給食 1,250円 ＋ …」）から含まれる食事を拾う
  function planParts() {
    var t = breakdownEl ? breakdownEl.textContent : '';
    var parts = ['宿泊'];
    if (t.indexOf('給食') !== -1) { parts.push('給食'); }
    if (t.indexOf('BBQ') !== -1) { parts.push('BBQ'); }
    if (t.indexOf('サンド') !== -1) { parts.push('朝食'); }
    return parts;
  }

  function seasonLabel() {
    var on = document.querySelector('.top-v2-chalk-season .top-v2-chalk-tab.is-on');
    var label = on && on.dataset.season === 'holiday' ? '土日祝' : '平日';
    var compact = document.getElementById('plan-compact');
    var planState = compact && compact.closest('details') && compact.closest('details').querySelector('.top-v2-chalk-menu-state');
    if (compact && compact.checked && planState && planState.textContent.indexOf('適用中') !== -1) {
      label += '・コンパクトプラン';
    }
    return label;
  }

  function applyGroupSummary() {
    if (!perEl || !nEl) { return; }
    var n = nEl.textContent.trim();
    var per = perEl.textContent.trim();
    var parts = planParts();
    var season = seasonLabel();
    if (barN) { barN.textContent = n; }
    if (barPer) { barPer.textContent = per; }
    if (barLabel) { barLabel.textContent = parts.join('＋') + '・' + season; }
    if (lineShare) {
      var plan = parts.length > 1 ? parts.join('＋') + 'つき' : '宿泊のみ';
      var text = 'カタショー合宿案：' + n + 'で1人' + per + '〜（' + plan + '・' + season + '）\n' + SHARE_PAGE_URL;
      lineShare.href = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(SHARE_PAGE_URL) +
        '&text=' + encodeURIComponent(text);
    }
  }

  var queued = false;
  function update() {
    queued = false;
    applyReserveNum();
    applyGroupSummary();
  }
  function schedule() {
    if (queued) { return; }
    queued = true;
    (window.requestAnimationFrame || window.setTimeout)(update);
  }

  update();

  // 料金計算の表示が書き換わったら追随（ボタン操作・季節・食事・プランの切替すべて）
  var board = (adultEl && adultEl.closest('#price')) || document.getElementById('price');
  if (board && 'MutationObserver' in window) {
    new MutationObserver(schedule).observe(board, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'hidden']
    });
  }
  var compactInput = document.getElementById('plan-compact');
  if (compactInput) { compactInput.addEventListener('change', schedule); }
})();
