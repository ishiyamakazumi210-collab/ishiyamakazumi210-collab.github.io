// /map/ 部屋タップ→詳細ポップアップ。
// floormap-hotspots.js(gen-floormaps.mjsの自動生成、roomIdごとの%座標)を読み、
// 各フロアの.top-v2-maproom-stage内にホットスポットボタンを絶対配置する。
// 開閉・backdrop・ESC・bodyスクロールロックの流儀はplay-catalog.jsを踏襲。
//
// ROOM_DATAの文言はオーナー提供のバッチ指示文をそのまま保持している。
// 価格数字・絵文字は含めない。「定員」ラベル等の見出し語はUI側の装飾で、
// 部屋データそのものではない。
//
// TODO(要確認): 教室の机の数 / 会議室の定員・机・ホワイトボード・プロジェクター /
// シャワー室ドライヤー設置後に追記 / 音楽室の音出し時間 / 調理室②の設備 / 食堂の席数
(function () {
  'use strict';

  // 画像パス・alt・文言は site.json → (ビルド時) dist/assets/js/site-data.js の
  // window.KATASHO_DATA を単一データソースとする。このファイルより先に
  // site-data.js を読み込むこと(map/index.html の<script>順を参照)。
  var STAY_PHOTO = window.KATASHO_DATA.images.stayRoom.src;
  var STAY_PHOTO_ALT = window.KATASHO_DATA.images.stayRoom.alt;
  var CLASSROOM_PHOTO = window.KATASHO_DATA.images.classroomStory.src;
  var CLASSROOM_PHOTO_ALT = window.KATASHO_DATA.images.classroomStory.alt;
  var KAIGI_PHOTO = window.KATASHO_DATA.images.kaigiRoom.src;
  var KAIGI_ALT = window.KATASHO_DATA.images.kaigiRoom.alt;
  var KAIGI_BODY = window.KATASHO_DATA.text.kaigiRoom.body;
  var BBQ_PHOTO = window.KATASHO_DATA.images.bbqArea.src;
  var BBQ_ALT = window.KATASHO_DATA.images.bbqArea.alt;

  var STANDARD_STAY_NOTE = '通常プランの宿泊棟・お部屋は施設側で決定し、宿泊日の10日前を目安にご案内します。';
  var COMPACT_STAY_NOTE = '調理室併設コンパクトプランで使用する寝室です。';
  var COMMON_BEDDING = ['寝具5点（マットレス・敷布団・掛け布団・枕・シーツ）', 'エアコン', 'ドライヤー'];
  var CLASSROOM_BODY = '机も黒板も、当時のまま残っています。集まりや宴会にも使えます。';
  var BBQ_BODY = 'ビニール屋根つきなので、雨の日でもBBQができます。①②は調理室の前、③は南棟側です。';
  var BBQ_LINK = { href: '/play/option/#food', label: 'BBQメニューは品書きへ →' };

  function stayChips(bedChip) {
    return [bedChip].concat(COMMON_BEDDING);
  }

  var ROOM_DATA = {
    // --- 1F ---
    shokudo: {
      name: '食堂',
      sub: '給食室・調理設備つき',
      body: 'コンパクトプランの専有スペース内にある、調理設備つきの食堂です。コンパクトプランの宴会・食事は、ここで行います。',
      photo: '/assets/img/rooms/room-shokudo.jpg',
      alt: '長机とテレビ、給湯コーナーが並ぶ食堂スペース'
    },
    kitchen1: {
      name: '調理室①',
      sub: '家庭科室',
      chips: ['IH', '調理器具', '食器', '大型冷蔵庫', 'ウッドデッキつき'],
      body: '持ち込み食材の調理はこちらで。',
      note: '利用グループごとに割り振ってご案内します。',
      photo: '/assets/img/rooms/room-kitchen1.jpg',
      alt: '冷蔵庫と長机が並ぶ調理室'
    },
    kitchen2: {
      name: '調理室②',
      sub: '理科室',
      chips: ['ウッドデッキつき'],
      note: '利用グループごとに割り振ってご案内します。',
      photo: '/assets/img/rooms/room-kitchen2.jpg',
      alt: 'コンロを据えた実験机が並ぶ、黒板の残る調理室'
    },
    shower: {
      name: 'シャワー室',
      sub: '保健室',
      chips: ['個室ブース3', '脱衣所共有ブース4', 'リンスインシャンプー', 'ボディーソープ'],
      body: 'バスタオル1人1枚と歯ブラシ付き。',
      note: '団体ごとに優先時間を設けています。',
      photo: '/assets/img/rooms/room-shower.jpg',
      alt: 'カーテンで仕切った個室が並ぶ脱衣スペース'
    },
    s1f1: {
      name: '南棟一階宿泊部屋①',
      sub: 'コンパクトプランの中部屋',
      capacity: '目安16名（手狭でよければ最大18名）',
      chips: stayChips('二段ベッド8台'),
      note: COMPACT_STAY_NOTE,
      photo: STAY_PHOTO
    },
    s1f2: {
      name: '南棟一階宿泊部屋②',
      sub: 'コンパクトプランの小部屋',
      capacity: '目安8名（手狭でよければ最大10名）',
      chips: stayChips('二段ベッド4台'),
      note: COMPACT_STAY_NOTE,
      photo: STAY_PHOTO
    },
    bbq1: { name: 'BBQ場①', body: BBQ_BODY, link: BBQ_LINK, photo: BBQ_PHOTO, alt: BBQ_ALT },
    bbq2: { name: 'BBQ場②', body: BBQ_BODY, link: BBQ_LINK, photo: BBQ_PHOTO, alt: BBQ_ALT },
    bbq3: { name: 'BBQ場③', body: BBQ_BODY, link: BBQ_LINK, photo: BBQ_PHOTO, alt: BBQ_ALT },

    // --- 2F ---
    kaigi3: { name: '会議室③',
      sub: 'もとから会議室', chips: ['Wi-Fi'], body: KAIGI_BODY, photo: KAIGI_PHOTO, alt: KAIGI_ALT },
    kaigi2: { name: '会議室②',
      sub: '相談室', chips: ['Wi-Fi'], body: KAIGI_BODY, photo: KAIGI_PHOTO, alt: KAIGI_ALT },
    kaigi1: { name: '会議室①',
      sub: '1年教室', chips: ['Wi-Fi'], body: KAIGI_BODY, photo: KAIGI_PHOTO, alt: KAIGI_ALT },
    cowork: { name: 'コワークスペース',
      sub: '2年教室', chips: ['Wi-Fi'], photo: '/assets/img/rooms/room-cowork.jpg', alt: '木製フレームのデスクが並ぶコワークスペース' },
    kyoshitsu2: { name: '教室②',
      sub: '5年教室', body: CLASSROOM_BODY, photo: CLASSROOM_PHOTO },
    n2f3: {
      name: '北棟宿泊部屋③',
      sub: '児童会室',
      capacity: '目安12名（手狭でよければ最大14名）',
      chips: stayChips('二段ベッド6台'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    },

    // --- 3F ---
    s3f1: {
      name: '南棟宿泊部屋①',
      sub: '多目的室',
      capacity: '目安25名（手狭でよければ最大40名）',
      chips: stayChips('布団で就寝'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    },
    s3f3: {
      name: '南棟宿泊部屋③',
      sub: '放送室',
      capacity: '目安4名（手狭でよければ最大6名）',
      chips: stayChips('布団で就寝'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    },
    s3f2: {
      name: '南棟宿泊部屋②',
      sub: '3年教室',
      capacity: '目安10名（手狭でよければ最大16名）',
      chips: stayChips('二段ベッド5台'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    },
    kyoshitsu1: { name: '教室①',
      sub: '4年教室', body: CLASSROOM_BODY, photo: CLASSROOM_PHOTO },
    ongaku: { name: '音楽室', chips: ['グランドピアノ'], body: '合唱やバンド練習はこちらで。', photo: '/assets/img/rooms/room-ongaku.jpg', alt: '板張りの広い部屋にグランドピアノを置いた音楽室' },
    n3f2: {
      name: '北棟宿泊部屋②',
      sub: '前室つき・音楽準備室',
      capacity: '8名（手狭でも8名まで）',
      chips: stayChips('二段ベッド4台'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    },
    n3f1: {
      name: '北棟宿泊部屋①',
      sub: 'パソコン室',
      capacity: '目安25名（手狭でよければ最大40名）',
      chips: stayChips('布団で就寝'),
      note: STANDARD_STAY_NOTE,
      photo: STAY_PHOTO
    }
  };

  // .top-v2-floormap-scroll img の padding(px)と同期させること(top-v2.css)。
  // stageはimgと同じwidth/min-width規則をミラーしているので、stageの実寸から
  // このpaddingぶんを差し引いた範囲がimgの実際の絵柄(コンテンツボックス)になる
  var STAGE_PAD = 14;

  function calcOffset(fraction) {
    return 'calc(' + STAGE_PAD + 'px + (100% - ' + (STAGE_PAD * 2) + 'px) * ' + fraction + ')';
  }
  function calcSize(fraction) {
    return 'calc((100% - ' + (STAGE_PAD * 2) + 'px) * ' + fraction + ')';
  }

  function fillChips(dialog, chips) {
    var list = dialog.querySelector('.top-v2-maproom-dialog-chips');
    list.textContent = '';
    var items = chips || [];
    items.forEach(function (label) {
      var chip = document.createElement('li');
      chip.className = 'top-v2-maproom-dialog-chip';
      chip.textContent = label;
      list.appendChild(chip);
    });
    list.hidden = items.length === 0;
  }

  function openRoom(id, dialog) {
    var data = ROOM_DATA[id];
    if (!data) { return; }

    var photoEl = dialog.querySelector('.top-v2-maproom-dialog-photo');
    if (data.photo) {
      photoEl.src = data.photo;
      photoEl.alt = data.alt || (data.photo === STAY_PHOTO ? STAY_PHOTO_ALT : CLASSROOM_PHOTO_ALT);
      photoEl.hidden = false;
    } else {
      photoEl.removeAttribute('src');
      photoEl.hidden = true;
    }

    dialog.querySelector('.top-v2-maproom-dialog-title').textContent =
      data.sub ? data.name + '（' + data.sub + '）' : data.name;

    var capacityEl = dialog.querySelector('.top-v2-maproom-dialog-capacity');
    if (data.capacity) {
      capacityEl.textContent = '';
      var label = document.createElement('span');
      label.className = 'top-v2-maproom-dialog-capacity-label';
      label.textContent = '定員';
      capacityEl.appendChild(label);
      capacityEl.appendChild(document.createTextNode(data.capacity));
      capacityEl.hidden = false;
    } else {
      capacityEl.textContent = '';
      capacityEl.hidden = true;
    }

    fillChips(dialog, data.chips);

    var descEl = dialog.querySelector('.top-v2-maproom-dialog-desc');
    if (data.body) {
      descEl.textContent = data.body;
      descEl.hidden = false;
    } else {
      descEl.textContent = '';
      descEl.hidden = true;
    }

    var noteEl = dialog.querySelector('.top-v2-maproom-dialog-note');
    if (data.note) {
      noteEl.textContent = data.note;
      noteEl.hidden = false;
    } else {
      noteEl.textContent = '';
      noteEl.hidden = true;
    }

    var linkEl = dialog.querySelector('.top-v2-maproom-dialog-link');
    if (data.link) {
      linkEl.href = data.link.href;
      linkEl.textContent = data.link.label;
      linkEl.hidden = false;
    } else {
      linkEl.removeAttribute('href');
      linkEl.textContent = '';
      linkEl.hidden = true;
    }

    dialog.setAttribute('data-event', 'map_room_' + id);

    document.body.classList.add('top-v2-maproom-dialog-lock');
    dialog.showModal();
  }

  function placeHotspots(stage, list, dialog) {
    list.forEach(function (spot) {
      var data = ROOM_DATA[spot.id];
      if (!data) { return; }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'top-v2-maproom-hotspot';
      btn.dataset.room = spot.id;
      btn.setAttribute('aria-label', data.name + 'の詳細');
      btn.style.left = calcOffset(spot.left / 100);
      btn.style.top = calcOffset(spot.top / 100);
      btn.style.width = calcSize(spot.width / 100);
      btn.style.height = calcSize(spot.height / 100);

      var chip = document.createElement('span');
      chip.className = 'top-v2-maproom-chip';
      chip.setAttribute('aria-hidden', 'true');
      // ＋は「押せる」に読めないとの指摘(2026-07-16)→カメラの描き起こしSVGに
      // (全22室に実写が入ったので「カメラ=この部屋の写真が見られる」が全部屋で真)
      chip.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#2f7890" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 8.5h4l1.6-2.3h6.8L17 8.5h4v11H3z"/><circle cx="12" cy="13.7" r="3.4"/></svg>';
      btn.appendChild(chip);

      btn.addEventListener('click', function () {
        openRoom(spot.id, dialog);
      });

      stage.appendChild(btn);
    });
  }

  function boot() {
    initSwipeCues();
    var hotspots = window.FLOORMAP_HOTSPOTS;
    var dialog = document.querySelector('.top-v2-maproom-dialog');
    if (!hotspots || !dialog || typeof dialog.showModal !== 'function') { return; }

    var stages = Array.prototype.slice.call(document.querySelectorAll('.top-v2-maproom-stage[data-floor]'));
    if (!stages.length) { return; }

    stages.forEach(function (stage) {
      var list = hotspots[stage.dataset.floor];
      if (list && list.length) { placeHotspots(stage, list, dialog); }
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) { dialog.close(); }
    });

    var closeBtn = dialog.querySelector('[data-dialog-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dialog.close(); });
    }

    dialog.addEventListener('close', function () {
      document.body.classList.remove('top-v2-maproom-dialog-lock');
    });
  }

  // スワイプ方向キュー: テキスト注記の代替(オーナー判断2026-07-17)。
  // SPのみCSS表示、最初のスワイプでフェードアウト
  function initSwipeCues() {
    document.querySelectorAll('.top-v2-floormap-scroll').forEach(function (sc) {
      var wrap = document.createElement('div');
      wrap.className = 'top-v2-floormap-scrollwrap';
      sc.parentNode.insertBefore(wrap, sc);
      wrap.appendChild(sc);
      var cue = document.createElement('span');
      cue.className = 'top-v2-floormap-swipecue';
      cue.setAttribute('aria-hidden', 'true');
      cue.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2f7890" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l7 7-7 7"/><path d="M13 5l7 7-7 7"/></svg>';
      wrap.appendChild(cue);
      var hide = function () { if (sc.scrollLeft > 12) { cue.classList.add('is-done'); } };
      sc.addEventListener('scroll', hide, { passive: true });
      // scrollイベントを取りこぼす環境の保険: 指を触れた時点で用済みにする
      sc.addEventListener('pointerdown', function () { cue.classList.add('is-done'); }, { passive: true });
      sc.addEventListener('touchstart', function () { cue.classList.add('is-done'); }, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
