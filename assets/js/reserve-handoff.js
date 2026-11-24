// 料金計算で選んでいる人数（と日付）を、次に開くページへ引き継ぐ（2026-11-21）。
// 1) 「空き状況を見る」などの予約リンク（ProX）。何も付けないとProXは「大人10名」で開く。
//    付けられるもの（2026-11-21にProXを実際に開いて確認）:
//    num=大人  num_1=小学生  num_2=3〜5歳  num_3=0〜2歳  dt=YYYYMMDD（泊まる日）  nights=泊数
//    プランの選択は渡さない（ProXのプランIDが不明なため）。
// 2) 各ページの簡易な料金計算から「くわしい料金シミュレーター」へのリンク。
//    adult=おとな  elem=小学生  pre=3〜5歳  plan=compact（少人数プランを適用中のとき）。price-simulator.js が読む
// 料金計算のないページでは何もしない。読み込みは pricing-board.js / price-simulator.js の後。人数の表示を読むだけで、料金計算には手を出さない。
(function () {
  'use strict';

  var PROX_PATH = '/ja/s/katasho/search/';

  function byId(id) { return document.getElementById(id); }

  // 数字の表示（例「20人」）か入力欄の値から、整数を取り出す。読めなければ null
  function countOf(el) {
    if (!el) { return null; }
    var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
    var m = String(raw || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // ページにある料金計算から、ProXに渡す値を集める
  function collect() {
    var p = {};
    // くわしい料金シミュレーター（/price-simulator/）
    if (byId('sim-adult')) {
      p.num = countOf(byId('sim-adult'));
      p.num_1 = countOf(byId('sim-elem'));
      p.num_2 = countOf(byId('sim-pre'));
      p.num_3 = countOf(byId('sim-infant'));
      var day = byId('sim-checkin');
      var m = day && /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.value || '');
      if (m) {
        p.dt = m[1] + m[2] + m[3];
        var night = document.querySelector('input[name="sim-nights"]:checked');
        p.nights = night ? countOf(night) : null;
      }
      return p;
    }
    // トップ・家族などの料金ボード（おとな・小学生・3〜5歳）、友達・合宿・研修の人数ボード
    var adult = byId('fam-adult') || byId('chalk-count');
    if (!adult) { return null; }
    p.num = countOf(adult);
    p.num_1 = countOf(byId('fam-elem'));
    p.num_2 = countOf(byId('fam-pre'));
    // 少人数プランは、チェックが入っていて人数も対象内（表示が「適用中」）のときだけ
    var compact = byId('plan-compact');
    var menu = compact && compact.closest ? compact.closest('details') : null;
    var state = menu ? menu.querySelector('.top-v2-chalk-menu-state') : null;
    p.compact = !!(compact && compact.checked && state && state.textContent.indexOf('適用中') !== -1);
    p.simple = true;
    return p;
  }

  function isProxSearch(a) {
    try {
      var u = new URL(a.href);
      return /(^|\.)489pro-x\.com$/.test(u.hostname) && u.pathname.indexOf(PROX_PATH) === 0;
    } catch (e) { return false; }
  }

  function apply() {
    var p = collect();
    if (!p) { return; }
    var links = document.querySelectorAll('a[href*="489pro-x.com"]');
    Array.prototype.forEach.call(links, function (a) {
      if (!isProxSearch(a)) { return; }
      var url = new URL(a.href);
      ['num', 'num_1', 'num_2', 'num_3', 'dt', 'nights'].forEach(function (k) {
        var v = p[k];
        // 大人は1人以上、子どもと泊数は1以上のときだけ付ける（0や読めない値は付けない＝ProXの既定に任せる）
        if (k === 'dt') {
          if (v) { url.searchParams.set(k, v); } else { url.searchParams.delete(k); }
        } else if (typeof v === 'number' && v > 0) {
          url.searchParams.set(k, String(v));
        } else {
          url.searchParams.delete(k);
        }
      });
      var next = url.toString();
      if (a.href !== next) { a.href = next; }
    });
    if (!p.simple) { return; }
    // 簡易な料金計算 → くわしい料金シミュレーター
    var simLinks = document.querySelectorAll('a[href*="/price-simulator/"]');
    Array.prototype.forEach.call(simLinks, function (a) {
      var url;
      try { url = new URL(a.href); } catch (e) { return; }
      if (url.origin !== window.location.origin || url.pathname !== '/price-simulator/') { return; }
      var map = { adult: p.num, elem: p.num_1, pre: p.num_2 };
      Object.keys(map).forEach(function (k) {
        var v = map[k];
        if (typeof v === 'number' && v > 0) { url.searchParams.set(k, String(v)); } else { url.searchParams.delete(k); }
      });
      if (p.compact) { url.searchParams.set('plan', 'compact'); } else { url.searchParams.delete('plan'); }
      var next = url.pathname + url.search + url.hash;
      if (a.getAttribute('href') !== next) { a.setAttribute('href', next); }
    });
  }

  // 人数・日付が変わったら付け直す。ボタンの表示が書き換わった後に読むため、少し遅らせる
  var queued = false;
  function schedule() {
    if (queued) { return; }
    queued = true;
    setTimeout(function () { queued = false; apply(); }, 0);
  }
  ['click', 'input', 'change'].forEach(function (type) {
    document.addEventListener(type, schedule, true);
  });
  // 押した瞬間にも最新の値で付け直す（新しいタブで開く場合も含めて）
  ['pointerdown', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="489pro-x.com"], a[href*="/price-simulator/"]') : null;
      if (a) { apply(); }
    }, true);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
  window.addEventListener('load', apply);
})();
