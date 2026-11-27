// トップの動画ヒーロー（index.html だけが読み込む）。見本D（/sample/d/）から本番へ移した（2026-11-20）。
(function () {
  'use strict';

  // ---- トップ: 動画は画面に出ている側（PC/スマホ）の1本だけを読み込んで再生 ----
  // .u-pc / .u-tab の2本とも data-src にしておき（以前は2本とも src+autoplay で、非表示側も読み込まれていた）、
  // 既存CSSの切替幅（max-width: 991px で .u-tab）と同じ条件で表示側だけ src を入れる。
  // 画面幅が変わって表示側が入れ替わったら、その時点で読み込む。動画は再圧縮した軽量版（約5.7MB→約4.1MB）。
  var lazyVideos = document.querySelectorAll('video.top-hero-video');
  if (lazyVideos.length && window.matchMedia) {
    var tabMq = window.matchMedia('(max-width: 991px) and (orientation: portrait)'); // 2026-11-27 横向きはPCの横長の動画（top-hero.css と同じ条件）
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

  // ---- トップ: 校章のオープニング ----
  // <head>のスクリプトが html に .top-hero-opening-on を付けている時だけ動く（動きを減らす設定の人には付かない）。
  // 1) 動画が実際に動き出したら（＋校章の画像が読み込めたら）校章をフェードイン（.top-hero-opening-in）。
  //    動画が2.5秒たっても始まらない時は、ポスターの上でフェードインする。
  // 2) 動画の再生位置で 4.3秒に消し始め、5.6秒（教室の場面）で左下の校章と矢印を出す。
  //    動画が始まらないままなら校章を4.3秒見せて、動画が遅れて始まった時も最長9秒で、同じ流れに進める。
  // 先に大きくスクロールした人には、すぐ最後の状態を見せる。
  var openRoot = document.documentElement;
  if (openRoot.classList.contains('top-hero-opening-on') && document.querySelector('.top-hero-opening')) {
    var OUT_AT = 4.3, DONE_AT = 5.6, IN_FALLBACK_MS = 2500, OUT_NO_VIDEO_MS = 4300, OUT_CAP_MS = 9000, OUT_TO_DONE_MS = 1300;
    var openStart = Date.now(), openPhase = 0, openInAt = 0, openOutAt = 0, openVideoStarted = false;
    var openLogo = document.querySelector('.top-hero-opening-logo');
    var logoReady = function () { return !openLogo || (openLogo.complete && openLogo.naturalWidth > 0); };
    var openIn = function () {
      if (openInAt) { return; }
      openInAt = Date.now(); openRoot.classList.add('top-hero-opening-in');
    };
    var openOut = function () {
      if (openPhase >= 1) { return; }
      openPhase = 1; openOutAt = Date.now(); openRoot.classList.add('top-hero-opening-out');
    };
    var openFinish = function () {
      if (openPhase >= 2) { return; }
      openPhase = 2;
      openRoot.classList.add('top-hero-opening-out');
      openRoot.classList.remove('top-hero-opening-on');
      openRoot.classList.add('top-hero-opening-done');
    };
    var shownVideo = function () {
      var vs = document.querySelectorAll('video.top-hero-video');
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
    var openCard = document.querySelector('.top-hero-opening-card');
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
