// /faq/ よくある質問（2026-11-21）
// 1) 「言葉でさがす」：入れた言葉を含む質問だけを出す（カタカナ・ひらがな、全角・半角の違いは気にしない）。
//    見つかった数が5件以下なら開いて答えまで見せる。0件ならお問い合わせへの案内。
// 2) /faq/#faq-cancel のように質問のidで来たら、その質問を開く（トップ・問い合わせページの「ベスト5」から）
(function () {
  'use strict';

  var root = document.getElementById('faq');
  if (!root) { return; }
  var items = Array.prototype.slice.call(root.querySelectorAll('details.faq'));
  var sections = Array.prototype.slice.call(root.querySelectorAll('section'));

  function norm(t) {
    var s = String(t || '');
    if (s.normalize) { s = s.normalize('NFKC'); }
    s = s.toLowerCase().replace(/\s+/g, '');
    // カタカナ → ひらがな
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  var texts = items.map(function (d) { return norm(d.textContent); });

  var input = document.getElementById('faq-search');
  var result = document.getElementById('faq-search-result');
  var OPEN_MAX = 5;

  function apply() {
    var q = norm(input.value);
    var hits = [];
    items.forEach(function (d, i) {
      var hit = !q || texts[i].indexOf(q) !== -1;
      d.hidden = !hit;
      if (hit && q) { hits.push(d); }
      // 検索で開いたものは、検索が変わったら閉じ直す
      if (d.dataset.searchOpened && (!hit || !q)) { d.open = false; delete d.dataset.searchOpened; }
    });
    if (q && hits.length <= OPEN_MAX) {
      hits.forEach(function (d) { if (!d.open) { d.open = true; d.dataset.searchOpened = '1'; } });
    }
    sections.forEach(function (s) { s.hidden = !!q && !s.querySelector('details.faq:not([hidden])'); });
    if (!result) { return; }
    if (!q) {
      result.hidden = true;
      result.textContent = '';
    } else if (hits.length) {
      result.hidden = false;
      result.textContent = hits.length + '件の質問が見つかりました';
    } else {
      result.hidden = false;
      result.innerHTML = '見つかりませんでした。<a href="/contact/">お問い合わせ</a>ください。';
    }
  }
  if (input) {
    input.addEventListener('input', apply);
    // 検索欄でEnterを押してもページは送らない
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) { return; }
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
