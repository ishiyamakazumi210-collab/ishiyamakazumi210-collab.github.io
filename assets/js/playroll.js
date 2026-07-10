// TOP「時間割は、ぜんぶ遊び。」のカード列を正規化する。
// 静的HTML内の重複カードは無限スクロール用の旧構成。ここで各遊びを
// 1列につき1枚へ戻してから、同じユニーク列を2本だけ並べる。
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

  function cardName(card) {
    var name = card.querySelector('.top-v2-playcard-name');
    return name ? name.textContent.trim() : '';
  }

  function makePhotoCard(src, name, width, height) {
    var card = document.createElement('li');
    card.className = 'top-v2-playcard';

    var photo = document.createElement('span');
    photo.className = 'top-v2-playcard-photo';
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.width = width;
    img.height = height;
    photo.appendChild(img);

    var label = document.createElement('span');
    label.className = 'top-v2-playcard-name';
    label.textContent = name;
    card.appendChild(photo);
    card.appendChild(label);
    return card;
  }

  function normalizePlayroll() {
    var rows = document.querySelectorAll('.top-v2-playroll-row');
    if (rows.length !== 4) { return; }

    var lists = Array.prototype.map.call(rows, function (row) {
      var firstTrack = row.querySelector('.top-v2-playroll-track');
      return firstTrack ? uniqueCards(firstTrack) : [];
    });

    // 1時間目はインパクト優先。「学校探検」は懐かしさのある2時間目へ。
    var schoolExplore = lists[0].filter(function (card) {
      return cardName(card) === '学校探検（謎解き）';
    })[0];
    lists[0] = lists[0].filter(function (card) { return card !== schoolExplore; });
    if (schoolExplore) { lists[1].push(schoolExplore); }

    // 大縄跳びは「あの頃の続き」へ。4時間目には写真のある綱引きを補充。
    var longRope = lists[3].filter(function (card) {
      return cardName(card) === '大縄跳び';
    })[0];
    lists[3] = lists[3].filter(function (card) { return card !== longRope; });
    if (longRope) { lists[1].push(longRope); }
    lists[3].push(makePhotoCard('/assets/img/play-cards/tug-of-war.jpg', '全力で綱引き', 480, 320));

    Array.prototype.forEach.call(rows, function (row, rowIndex) {
      var names = lists[rowIndex].map(cardName);
      var heading = row.querySelector('.top-v2-playroll-tab');
      row.setAttribute('aria-label', (heading ? heading.textContent.trim() + ': ' : '') + names.join('、'));
      Array.prototype.forEach.call(row.querySelectorAll('.top-v2-playroll-track'), function (track) {
        track.replaceChildren.apply(track, lists[rowIndex].map(function (card) {
          return card.cloneNode(true);
        }));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizePlayroll);
  } else {
    normalizePlayroll();
  }
})();
