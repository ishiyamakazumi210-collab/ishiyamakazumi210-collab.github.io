// TOP「時間割は、ぜんぶ遊び。」のカード列を充填する。
// HTMLが編成の正（どの遊びがどの時間目か・カードの並び順）であり、
// ここでは複製充填のみを行う: 各行のユニーク1サイクルを読み取り、
// 重複除去（保険）した上で、マーキーが必要とする幅までサイクル単位で
// 複製する。行の組み替え・追加はもう行わない（HTMLを直接編集する）。
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
  // アニメーションのduration/directionはCSSのまま一切変更しない。
  function requiredTrackWidth(track) {
    var viewport = track.parentElement;
    var base = viewport ? viewport.clientWidth : 0;
    var pcFloor = window.matchMedia('(min-width: 992px)').matches ? 2100 : 0;
    return Math.max(base + 120, pcFloor);
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
    refillTimer = setTimeout(refillAllTracks, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizePlayroll);
  } else {
    normalizePlayroll();
  }
})();
