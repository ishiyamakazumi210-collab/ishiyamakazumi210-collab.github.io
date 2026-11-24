// ⓘ（details.top-v2-info）の共通の動き。2026-11-24 トップのクチコミⓘのインライン script から共通化。
// 見た目は top-v2.css の .top-v2-info。開け閉めそのものは details の標準の動き（JSなしでも開く）。
// 1) 外を押すか Esc で閉じる。1つ開いたら、ほかのⓘは閉じる
// 2) 吹き出しが画面の左右からはみ出すときは --info-shift で横にずらす（360〜390px幅で端に置いたⓘ向け）
// 3) 上に余白がないときは下に開く（is-below）。ただし下に開くと親の overflow で切れるときは上のまま
// あとからJSで足されるⓘ（くわしい料金計算のサーフィン教室など）にも効くよう、document で受ける。
(function () {
  'use strict';

  var EDGE = 12; // 画面の端から空けるすき間(px)

  function openInfos() {
    return Array.prototype.slice.call(document.querySelectorAll('details.top-v2-info[open]'));
  }

  // 画面上端に固定のヘッダーがあれば、その下端までを「上の余白なし」とみなす
  function topLimit() {
    var limit = EDGE;
    var nodes = document.querySelectorAll('header, .l-header');
    Array.prototype.forEach.call(nodes, function (el) {
      var pos = window.getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') { return; }
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.top <= 0 && r.bottom > 0) { limit = Math.max(limit, r.bottom + EDGE); }
    });
    return limit;
  }

  // 親のどれかが overflow で切っていて、吹き出しがその上下にはみ出すか（左右は下の --info-shift で直す）
  function clippedY(pop) {
    var r = pop.getBoundingClientRect();
    for (var a = pop.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      var cs = window.getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') { continue; }
      var ar = a.getBoundingClientRect();
      if (r.top < ar.top - 1 || r.bottom > ar.bottom + 1) { return true; }
    }
    return false;
  }

  function place(d) {
    var pop = d.querySelector('.top-v2-info-pop');
    if (!pop) { return; }
    pop.style.removeProperty('--info-shift');
    d.classList.remove('is-below');

    var vw = document.documentElement.clientWidth || window.innerWidth;
    var r = pop.getBoundingClientRect();
    if (r.top < topLimit()) {
      // 下に開いて切れるなら、上のまま（少しスクロールすれば読める）
      d.classList.add('is-below');
      if (clippedY(pop)) { d.classList.remove('is-below'); }
      r = pop.getBoundingClientRect();
    }
    var shift = 0;
    if (r.left < EDGE) {
      shift = EDGE - r.left;
    } else if (r.right > vw - EDGE) {
      shift = (vw - EDGE) - r.right;
    }
    if (shift) { pop.style.setProperty('--info-shift', Math.round(shift) + 'px'); }
  }

  // toggle は泡立たないので capture で受ける
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || !d.classList || !d.classList.contains('top-v2-info') || !d.open) { return; }
    openInfos().forEach(function (o) { if (o !== d) { o.open = false; } });
    place(d);
  }, true);

  document.addEventListener('click', function (e) {
    openInfos().forEach(function (d) {
      if (!d.contains(e.target)) { d.open = false; }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') { return; }
    openInfos().forEach(function (d) {
      d.open = false;
      var s = d.querySelector('summary');
      if (s) { s.focus(); }
    });
  });

  var queued = false;
  window.addEventListener('resize', function () {
    if (queued) { return; }
    queued = true;
    (window.requestAnimationFrame || window.setTimeout)(function () {
      queued = false;
      openInfos().forEach(place);
    });
  });
})();
