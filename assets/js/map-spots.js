// /map/ 全体マップの番号ドット(①〜⑥とP1・P2・P3・4)→詳細ポップアップ。凡例のボタン([data-spot])からも開く。
// 開閉・backdrop・ESC・bodyスクロールロックの流儀はmap-rooms.js/play-catalog.jsを踏襲した
// 独立実装（.top-v2-mapspot-*で新規スコープ、既存の部屋ポップアップ側は無変更）。
// ドット本体は既存の<button class="top-v2-map-dot">(座標・見た目は既存CSSを流用)。
//
// SPOT_DATAの文言はオーナー提供のバッチ指示文をそのまま保持している。
// 価格数字・絵文字は含めない。
(function () {
  'use strict';

  // ①北棟・②南棟の「各階の部屋を見る」リンクは共通: #floorsへ。
  // クリック時にダイアログを閉じてから既定のアンカー遷移に任せる(下のboot内で配線)
  var FLOORS_LINK = { href: '#floors', label: '各階の部屋を見る ↓' };

  var SPOT_DATA = {
    kita: {
      name: '北棟',
      body: '宿泊部屋・調理室・シャワー室・音楽室などがあります。',
      link: FLOORS_LINK,
      photo: '/assets/img/spots-2026/kita.jpg',
      alt: '「カタショー・ワンラボ」の垂れ幕がかかる北棟の外観'
    },
    minami: {
      name: '南棟',
      body: '宿泊部屋・食堂・会議室・教室・職員室などがあります。',
      link: FLOORS_LINK,
      photo: '/assets/img/spots-2026/minami.jpg',
      alt: '3階建ての南棟の外観'
    },
    gym: {
      name: '体育館',
      photo: '/assets/img/spots/spot-gym.jpg',
      alt: 'バスケットゴールと磨かれた木床が広がる体育館の内観',
      body: 'バスケ・バレー・ドッジボールなどができます。',
      note: window.KATASHO_DATA.gym.noteMid,
      link: { href: '/play/option/#play', label: '延長の料金はオプションへ →' }
    },
    grounds: {
      name: 'グラウンド',
      photo: '/assets/img/spots-2026/grounds.jpg',
      alt: '広い芝生のグラウンド',
      body: 'すべり台・ブランコ・うんてい・登り棒・鉄棒があります。'
    },
    // 駐車場は3つのピンに分け、それぞれの写真と説明（2026-11-21、全部同じ写真だとオーナー指摘）。
    // 写真・文は交通アクセスページの「駐車場」と同じ。地図のどのピンがどの駐車場かはオーナー確認
    parking1: {
      name: '第1駐車場（校舎側）',
      body: 'ワンラボ入居者・体育館利用の方が優先です。満車のときは第3・第4へ。',
      photo: '/assets/img/parking/parking-1.jpg',
      alt: '「カタショー第1駐車場」の赤い看板と、校舎側の駐車スペース',
      link: { href: '/access/#parking', label: '駐車場の案内（交通アクセス）→' }
    },
    parking2: {
      name: '第2駐車場（体育館前）',
      body: '体育館の前の駐車場です。大型バスでお越しの場合は、ここを予約できます。ご予約のときに、大型バスで来ることをお伝えください。',
      photo: '/assets/img/parking/parking-2.jpg',
      alt: '体育館と校舎の前に広がる、第2駐車場のスペース',
      link: { href: '/access/#parking', label: '駐車場の案内（交通アクセス）→' }
    },
    parking34: {
      name: '第3・第4駐車場（グラウンド側）',
      body: 'グラウンド駐車場です。第1が満車のときはこちらへどうぞ。大型バスも停められます。',
      photo: '/assets/img/parking/parking-3-4.jpg',
      alt: 'グラウンド側の砂利の駐車場。広いスペースに車が停まっている',
      link: { href: '/access/#parking', label: '駐車場の案内（交通アクセス）→' }
    },
    // 番号は⑤、海(sea)は⑥（2026-11-21に駐車場をPにして繰り上げ）
    // photo/altは site.json → window.KATASHO_DATA (site-data.js) の単一データソース
    // (茶畑写真はTOP playroll・play カタログとも共有。海写真はplay カタログと共有)
    tea: {
      name: '茶畑',
      photo: window.KATASHO_DATA.images.teaField.src,
      alt: window.KATASHO_DATA.images.teaField.alt,
      body: '学校のまわりは一面の茶畑。牧之原ならではの景色です。'
    },
    sea: {
      name: '海',
      photo: window.KATASHO_DATA.images.beach.src,
      alt: window.KATASHO_DATA.images.beach.alt,
      body: '歩いてすぐに海。散歩や海水浴にどうぞ。'
    }
  };

  function openSpot(id, dialog) {
    var data = SPOT_DATA[id];
    if (!data) { return; }

    var photoEl = dialog.querySelector('.top-v2-mapspot-dialog-photo');
    if (data.photo) {
      photoEl.src = data.photo;
      photoEl.alt = data.alt || '';
      photoEl.hidden = false;
    } else {
      photoEl.removeAttribute('src');
      photoEl.hidden = true;
    }

    dialog.querySelector('.top-v2-mapspot-dialog-title').textContent = data.name;

    var descEl = dialog.querySelector('.top-v2-mapspot-dialog-desc');
    if (data.body) {
      descEl.textContent = data.body;
      descEl.hidden = false;
    } else {
      descEl.textContent = '';
      descEl.hidden = true;
    }

    var noteEl = dialog.querySelector('.top-v2-mapspot-dialog-note');
    if (data.note) {
      noteEl.textContent = data.note;
      noteEl.hidden = false;
    } else {
      noteEl.textContent = '';
      noteEl.hidden = true;
    }

    var linkEl = dialog.querySelector('.top-v2-mapspot-dialog-link');
    if (data.link) {
      linkEl.href = data.link.href;
      linkEl.textContent = data.link.label;
      linkEl.hidden = false;
    } else {
      linkEl.removeAttribute('href');
      linkEl.textContent = '';
      linkEl.hidden = true;
    }

    dialog.setAttribute('data-event', 'map_spot_' + id);

    document.body.classList.add('top-v2-mapspot-dialog-lock');
    dialog.showModal();
  }

  function boot() {
    var dialog = document.querySelector('.top-v2-mapspot-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') { return; }

    var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-spot]'));
    if (!triggers.length) { return; }

    // 既存<button>要素なのでclick一本でOK(Enter/Spaceはbuttonのネイティブ挙動が
    // 自動でclickに変換する。map-rooms.jsのホットスポットと同じ考え方)
    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        openSpot(btn.dataset.spot, dialog);
      });
      // 写真のあるスポットだけカメラバッジ(フロア図の部屋バッジと同じ約束=
      // 「押すと写真が見られる」。写真なしスポットに付けると嘘になるため
      // データ駆動で自動判定。2026-07-17オーナー要望)
      var data = SPOT_DATA[btn.dataset.spot];
      // カメラの印は地図のピンだけ（凡例のボタンには付けない）
      if (data && data.photo && btn.classList.contains('top-v2-map-dot')) {
        var cam = document.createElement('span');
        cam.className = 'top-v2-mapspot-camchip';
        cam.setAttribute('aria-hidden', 'true');
        cam.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#2f7890" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 8.5h4l1.6-2.3h6.8L17 8.5h4v11H3z"/><circle cx="12" cy="13.7" r="3.4"/></svg>';
        btn.appendChild(cam);
      }
    });

    // backdropクリックで閉じる: クリックがdialog要素自身をターゲットにした時だけ
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) { dialog.close(); }
    });

    var closeBtn = dialog.querySelector('[data-dialog-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dialog.close(); });
    }

    // 北棟/南棟の「各階の部屋を見る↓」等、本文内リンクを押したら
    // ダイアログを閉じてから既定のアンカー/ページ遷移に任せる
    // (閉じた状態でスクロール・遷移が見える。preventDefaultはしない)
    var linkEl = dialog.querySelector('.top-v2-mapspot-dialog-link');
    if (linkEl) {
      linkEl.addEventListener('click', function () { dialog.close(); });
    }

    // ESC/backdrop/とじるボタン、どの経路で閉じてもcloseイベントに集約される
    dialog.addEventListener('close', function () {
      document.body.classList.remove('top-v2-mapspot-dialog-lock');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
