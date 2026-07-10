// TOP「時間割は、ぜんぶ遊び。」のカード列を充填する。
// HTMLが編成の正（どの遊びがどの時間目か・カードの並び順）であり、
// ここでは複製充填のみを行う: 各行のユニーク1サイクルを読み取り、
// 重複除去（保険）した上で、マーキーが必要とする幅までサイクル単位で
// 複製する。行の組み替え・追加はもう行わない（HTMLを直接編集する）。
//
// 駆動方式（タスク: スクロール連動ハイブリッド駆動化で追加）:
// CSSの@keyframesループはJS無効環境向けのフォールバックとしてそのまま残す
// （このファイル以外は一切変更しない）。JSが動く環境ではinitMarqueeDriverが
// 各トラックに animation:none を当て、rAFで毎フレーム transform:translateX()
// を計算・適用する自前ドライバに切り替える。常時の自走速度に、ページの
// スクロール量に比例した追加速度（減衰する慣性）を足し込むことで
// 「スクロールすると加速する」体感を作る。
(function () {
  'use strict';

  function uniqueCards(track) {
    var seen = {};
    return Array.prototype.filter.call(track.children, function (card) {
      var name = card.querySelector('.top-v2-playcard-name');
      var key = name ? name.textContent.trim() : '';
      if (!key || seen[key]) { return false; }
      seen[key] = true;
      return true;
    });
  }

  // --- タスク7(2026-07-10 PC密度化)で追加 ---
  // PCでカードを110pxに縮小した結果、ユニーク1サイクルのトラック幅
  // (6枚行で約738px)がビューポート幅(最大1920px)を下回り、
  // translateX(-100%)の2本ループに空白が出るようになった。
  // ユニーク構成はそのままに、トラックが必要幅（ビューポート+余裕、
  // PCは2100pxを下限の目安）を満たすまでサイクル単位で複製して埋める。
  // SPは1サイクルで既に必要幅を満たすため増えず、従来の見た目・速度のまま。
  // directionはCSSのまま。durationは充填後の実幅から速度基準で算出する
  // （2026-07-10 オーナー指摘: PC密度化でトラックが伸び実速度が約78px/秒
  //   =SPの1.6倍に。固定秒をやめ「幅÷目標速度」で常に読める速さを保つ）。
  function requiredTrackWidth(track) {
    var viewport = track.parentElement;
    var base = viewport ? viewport.clientWidth : 0;
    var pcFloor = window.matchMedia('(min-width: 992px)').matches ? 2100 : 0;
    return Math.max(base + 120, pcFloor);
  }

  // 行ごとの目標速度(px/秒)。行で微差をつけて機械的な同期を避ける。
  // rAFドライバの自走速度としてもそのまま使う（CSSフォールバックのduration
  // 算出と共通の基準値なので、JSあり/なしで体感速度がズレない）。
  var ROW_SPEEDS = [26, 22, 25, 20];

  // --- タスク(スクロール連動ハイブリッド駆動)で追加: 調整用定数 ---
  var SCROLL_BOOST_COEF = 0.35;   // スクロール1pxあたりに加算する追加速度(px/秒)。体感調整はここ。
  var SCROLL_BOOST_DECAY = 0.9;   // 追加速度の毎フレーム減衰率(0-1)。小さいほど早く収まる
  var MAX_DELTA_TIME = 0.25;      // タブ復帰直後などの異常dtを丸める上限(秒)。ワープ防止

  function rowIndexOf(track) {
    var rows = document.querySelectorAll('.top-v2-playroll-row');
    var row = track.closest('.top-v2-playroll-row');
    return Array.prototype.indexOf.call(rows, row);
  }

  function applyDuration(track) {
    // rAFドライバがanimation:noneを当てた後（animation-name===none）は
    // CSSアニメを使わないためdurationの再計算は無意味。resize時の
    // refillAllTracksから呼ばれても無駄な書き込み・紛らわしいinline styleの
    // 残留を避けるためスキップする。
    if (track.style.animationName === 'none') { return; }
    var idx = rowIndexOf(track);
    var speed = ROW_SPEEDS[idx] || 42;
    var width = track.offsetWidth;
    if (width > 0) {
      track.style.animationDuration = Math.round(width / speed) + 's';
    }
  }

  function fillTrack(track, cycleCards) {
    if (!cycleCards.length || track.offsetWidth === 0) { return; }
    var guard = 0;
    while (track.offsetWidth < requiredTrackWidth(track) && guard < 8) {
      cycleCards.forEach(function (card) {
        track.appendChild(card.cloneNode(true));
      });
      guard += 1;
    }
    applyDuration(track);
  }

  // 回転などでビューポート幅が広がった時に不足分だけ追い足す（伸ばす一方
  // 向きの冪等処理。縮んだ場合は余るだけで害がないため取り除かない）
  function refillAllTracks() {
    document.querySelectorAll('.top-v2-playroll-track').forEach(function (track) {
      fillTrack(track, uniqueCards(track).map(function (card) {
        return card.cloneNode(true);
      }));
    });
  }

  function normalizePlayroll() {
    var rows = document.querySelectorAll('.top-v2-playroll-row');
    if (rows.length !== 4) { return; }

    // 各行のユニーク1サイクルはHTMLの並び順がそのまま正。取得元は各行の
    // 最初のトラックで、重複除去は将来のHTML編集ミスに対する保険。
    var lists = Array.prototype.map.call(rows, function (row) {
      var firstTrack = row.querySelector('.top-v2-playroll-track');
      return firstTrack ? uniqueCards(firstTrack) : [];
    });

    Array.prototype.forEach.call(rows, function (row, rowIndex) {
      Array.prototype.forEach.call(row.querySelectorAll('.top-v2-playroll-track'), function (track) {
        track.replaceChildren.apply(track, lists[rowIndex].map(function (card) {
          return card.cloneNode(true);
        }));
        fillTrack(track, lists[rowIndex]);
      });
    });
  }

  var refillTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(refillTimer);
    refillTimer = setTimeout(function () {
      refillAllTracks();
    }, 200);
  });

  // --- タスク(スクロール連動ハイブリッド駆動)で追加 ---
  // 常時自走+スクロール加速のrAFドライバ。
  //
  // prefers-reduced-motionでは起動せず、既存CSSのフォールバック
  // （overflow-x:autoの手動スクロール・アニメ無効・複製トラック非表示）を
  // そのまま活かす。「ユーザー操作起点の動きは許容」の要件は、この既存の
  // 手動横スクロール導線がそのまま満たす（JSで別途スクロール連動のtransformを
  // 足すと、ネイティブのoverflow-x:autoドラッグと二重に動いて競合するため、
  // 意図的にドライバ自体を起動しない）。
  function initMarqueeDriver() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (!('requestAnimationFrame' in window)) { return; }

    var rows = Array.prototype.slice.call(document.querySelectorAll('.top-v2-playroll-row'));
    var states = [];

    rows.forEach(function (row, idx) {
      var tracks = Array.prototype.slice.call(row.querySelectorAll('.top-v2-playroll-track'));
      if (!tracks.length) { return; }

      // directionはCSSの現行値を読み取って踏襲する（reverse行を二重管理しない）
      var dir = 1;
      var computedDirection = window.getComputedStyle(tracks[0]).animationDirection;
      if (computedDirection && computedDirection.indexOf('reverse') !== -1) {
        dir = -1;
      }

      // CSSアニメーションを止め、以後はtransformで駆動する
      tracks.forEach(function (t) { t.style.animation = 'none'; });

      var state = {
        row: row,
        tracks: tracks,
        dir: dir,
        baseSpeed: ROW_SPEEDS[idx] || 42,
        offset: 0,
        scrollBoost: 0,
        hovered: false
      };
      states.push(state);

      // ホバー/タッチ長押しで自走を止める（スクロール連動は生かす。
      // 従来CSSの:hover/:active一時停止と同仕様）
      row.addEventListener('pointerenter', function () { state.hovered = true; });
      row.addEventListener('pointerleave', function () { state.hovered = false; });
      row.addEventListener('pointerdown', function () { state.hovered = true; });
      row.addEventListener('pointerup', function () { state.hovered = false; });
      row.addEventListener('pointercancel', function () { state.hovered = false; });
    });

    if (!states.length) { return; }

    var sectionVisible = true; // IntersectionObserver未対応環境ではtrueのまま=常時稼働
    var playrollSection = document.getElementById('playroll');
    if (playrollSection && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          sectionVisible = entry.isIntersecting;
        });
        if (sectionVisible) { ensureLoop(); }
      });
      io.observe(playrollSection);
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { ensureLoop(); }
    });

    var lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var delta = Math.abs(y - lastScrollY);
      lastScrollY = y;
      if (!delta) { return; }
      var boost = delta * SCROLL_BOOST_COEF;
      states.forEach(function (state) {
        state.scrollBoost += boost;
      });
      ensureLoop();
    }, { passive: true });

    function cycleWidthOf(state) {
      var w = state.tracks[0].offsetWidth;
      return w > 0 ? w : 1;
    }

    function applyTransform(state) {
      var cw = cycleWidthOf(state);
      var pos = state.offset % cw;
      if (pos < 0) { pos += cw; }
      var transform = 'translateX(' + (-pos) + 'px)';
      state.tracks.forEach(function (t) { t.style.transform = transform; });
    }

    var rafId = null;
    var lastFrameTime = null;

    function loopActive() {
      return sectionVisible && !document.hidden;
    }

    function tick(now) {
      rafId = null;
      if (!loopActive()) { return; }
      if (lastFrameTime === null) { lastFrameTime = now; }
      var dt = (now - lastFrameTime) / 1000;
      if (dt > MAX_DELTA_TIME) { dt = MAX_DELTA_TIME; }
      lastFrameTime = now;

      states.forEach(function (state) {
        var speed = state.scrollBoost;
        if (!state.hovered) { speed += state.baseSpeed; }
        state.offset += state.dir * speed * dt;
        // 慣性減衰: スクロール由来の追加速度だけを毎フレーム減衰させる
        state.scrollBoost *= SCROLL_BOOST_DECAY;
        if (state.scrollBoost < 0.02) { state.scrollBoost = 0; }
        applyTransform(state);
      });

      rafId = window.requestAnimationFrame(tick);
    }

    function ensureLoop() {
      if (rafId !== null || !loopActive()) { return; }
      lastFrameTime = null;
      rafId = window.requestAnimationFrame(tick);
    }

    ensureLoop();
  }

  function boot() {
    normalizePlayroll();
    initMarqueeDriver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
