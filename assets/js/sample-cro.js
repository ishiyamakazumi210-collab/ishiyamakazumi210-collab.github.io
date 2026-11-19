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

  // ---- トップ見本A・B: ヒーロー写真の2・3枚目は、ページの読み込みが終わってから読む ----
  // 切り替え(クロスフェード)自体はCSSだけ。動きを減らす設定の人には1枚目だけで静止するので読まない。
  function loadDeferredSlides() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { return; }
    var els = document.querySelectorAll('.sample-fun [data-src], .sample-fun [data-srcset]');
    Array.prototype.forEach.call(els, function (el) {
      if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
      if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute('data-src'); }
    });
  }
  if (document.querySelector('.sample-fun')) {
    if (document.readyState === 'complete') { loadDeferredSlides(); } else { window.addEventListener('load', loadDeferredSlides); }
  }

  // ---- トップ見本D: 動画は画面に出ている側（PC/スマホ）の1本だけを読み込んで再生 ----
  // 現行トップは .u-pc / .u-tab の2本に src+autoplay があり、非表示側も読み込まれる。
  // 見本では両方 data-src にしておき、既存CSSの切替幅（max-width: 991px で .u-tab）と
  // 同じ条件で表示側だけ src を入れる。画面幅が変わって表示側が入れ替わったら、その時点で読み込む。
  var lazyVideos = document.querySelectorAll('video.sample-lazy-video');
  if (lazyVideos.length && window.matchMedia) {
    var tabMq = window.matchMedia('(max-width: 991px)');
    var activateVideo = function () {
      var want = tabMq.matches ? 'tab' : 'pc';
      Array.prototype.forEach.call(lazyVideos, function (v) {
        if (v.dataset.side !== want) {
          if (!v.paused) { v.pause(); }
          return;
        }
        if (!v.getAttribute('src') && v.dataset.src) {
          v.setAttribute('autoplay', '');
          v.src = v.dataset.src;
        }
        var p = v.play();
        if (p && p.catch) { p.catch(function () {}); }
      });
    };
    activateVideo();
    if (tabMq.addEventListener) { tabMq.addEventListener('change', activateVideo); } else if (tabMq.addListener) { tabMq.addListener(activateVideo); }
  }

  // ---- トップ見本D: スマホの固定バーは、ヒーローを過ぎてから出す ----
  // ヒーロー(#mv)の下端が画面の上から3分の1より上に来たら表示、戻ったら隠す。
  // PC(992px以上)ではバー自体をCSSで出さないので、ここでは判定だけ行う。
  var revealBar = document.querySelector('.sample-cro--var-d #sampleBar');
  var revealHero = document.getElementById('mv');
  if (revealBar && revealHero) {
    var barQueued = false;
    var updateBar = function () {
      barQueued = false;
      var show = revealHero.getBoundingClientRect().bottom < window.innerHeight / 3;
      revealBar.classList.toggle('is-visible', show);
    };
    var queueBar = function () {
      if (barQueued) { return; }
      barQueued = true;
      (window.requestAnimationFrame || window.setTimeout)(updateBar);
    };
    updateBar();
    window.addEventListener('scroll', queueBar, { passive: true });
    window.addEventListener('resize', queueBar);
  }

  // ---- トップ見本D: 校章のオープニング ----
  // <head>のスクリプトが html に .sample-opening-on を付けている時だけ動く（動きを減らす設定の人には付かない）。
  // 1) 動画が実際に動き出したら（＋校章の画像が読み込めたら）校章をフェードイン（.sample-opening-in）。
  //    動画が2.5秒たっても始まらない時は、ポスターの上でフェードインする。
  // 2) 動画の再生位置で 4.3秒に消し始め、5.6秒（教室の場面）で左下の校章と矢印を出す。
  //    動画が始まらないままなら校章を4.3秒見せて、動画が遅れて始まった時も最長9秒で、同じ流れに進める。
  // 先に大きくスクロールした人には、すぐ最後の状態を見せる。
  var openRoot = document.documentElement;
  if (openRoot.classList.contains('sample-opening-on') && document.querySelector('.sample-opening')) {
    var OUT_AT = 4.3, DONE_AT = 5.6, IN_FALLBACK_MS = 2500, OUT_NO_VIDEO_MS = 4300, OUT_CAP_MS = 9000, OUT_TO_DONE_MS = 1300;
    var openStart = Date.now(), openPhase = 0, openInAt = 0, openOutAt = 0, openVideoStarted = false;
    var openLogo = document.querySelector('.sample-opening-logo');
    var logoReady = function () { return !openLogo || (openLogo.complete && openLogo.naturalWidth > 0); };
    var openIn = function () {
      if (openInAt) { return; }
      openInAt = Date.now(); openRoot.classList.add('sample-opening-in');
    };
    var openOut = function () {
      if (openPhase >= 1) { return; }
      openPhase = 1; openOutAt = Date.now(); openRoot.classList.add('sample-opening-out');
    };
    var openFinish = function () {
      if (openPhase >= 2) { return; }
      openPhase = 2;
      openRoot.classList.add('sample-opening-out');
      openRoot.classList.remove('sample-opening-on');
      openRoot.classList.add('sample-opening-done');
    };
    var shownVideo = function () {
      var vs = document.querySelectorAll('video.sample-lazy-video');
      for (var i = 0; i < vs.length; i++) {
        if (vs[i].offsetParent !== null && vs[i].getAttribute('src')) { return vs[i]; }
      }
      return null;
    };
    var openTick = function () {
      if (openPhase >= 2) { return; }
      var v = shownVideo();
      var t = v && !v.paused ? v.currentTime : -1;
      var now = Date.now();
      if (!openInAt) {
        var waited = now - openStart;
        // 校章の画像がどうしても読めない時は、オープニングをやめて最後の状態にする
        if (waited > 10000 && !logoReady()) { openFinish(); return; }
        if (logoReady() && (t > 0.05 || waited > IN_FALLBACK_MS)) { openIn(); }
        (window.requestAnimationFrame || window.setTimeout)(openTick);
        return;
      }
      var sinceIn = now - openInAt;
      if (t > 0.05) { openVideoStarted = true; }
      if (t >= DONE_AT || (openOutAt && now - openOutAt >= OUT_TO_DONE_MS)) { openFinish(); return; }
      if (t >= OUT_AT || sinceIn >= OUT_CAP_MS || (!openVideoStarted && sinceIn >= OUT_NO_VIDEO_MS)) { openOut(); }
      (window.requestAnimationFrame || window.setTimeout)(openTick);
    };
    // 校章の置き場所: 見出しの下端から、動画の下端（PC）／下の矢印の上（スマホ）まで。
    // スマホは今の大きさ（動画の高さの44%）まで、PCは空いている高さいっぱいに大きく
    var openCard = document.querySelector('.sample-opening-card');
    var layoutOpening = function () {
      var box = document.querySelector('#mv .l-mv_video');
      var stack = document.querySelector('#mv .top-v2-mv-stack');
      var cue = document.querySelector('#mv .top-v2-mv-scrollcue');
      if (!box || !stack || !openCard) { return; }
      var b = box.getBoundingClientRect(), k = stack.getBoundingClientRect();
      var isPc = window.matchMedia && window.matchMedia('(min-width: 992px)').matches;
      var top = k.bottom - b.top + (isPc ? 18 : 14);
      var bottomEdge = isPc ? b.height - 30 : (cue ? cue.getBoundingClientRect().top - b.top - 4 : b.height - 20);
      var avail = Math.max(0, bottomEdge - top);
      var logoH = isPc ? avail : Math.min(avail, b.height * 0.44);
      openCard.style.setProperty('--open-top', Math.round(top) + 'px');
      openCard.style.setProperty('--open-bottom', Math.round(b.height - bottomEdge) + 'px');
      openCard.style.setProperty('--open-logo-h', Math.round(logoH) + 'px');
    };
    layoutOpening();
    window.addEventListener('resize', layoutOpening);
    var keyImg = document.querySelector('#mv .top-v2-mv-key img');
    if (keyImg && !keyImg.complete) { keyImg.addEventListener('load', layoutOpening); }
    openTick();
    // 動画がほとんど画面の外に出るまでスクロールした人には、すぐ最後の状態を見せる
    // （ノートPCで動画を画面の上端に合わせる程度のスクロールでは飛ばさない）
    var openHero = document.getElementById('mv');
    var openOnScroll = function () {
      if (openHero && openHero.getBoundingClientRect().bottom < window.innerHeight * 0.35) {
        openFinish(); window.removeEventListener('scroll', openOnScroll);
      }
    };
    window.addEventListener('scroll', openOnScroll, { passive: true });
  }
})();
