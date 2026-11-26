// トップ「時間割は、ぜんぶ遊び。」のカードを押すと、遊びのページと同じ詳しい窓を開く（2026-11-26）。
// 説明・場所・時間・雨・道具・注意は、遊びのページ（/play/ の #catalog のカード）を正として読み込む。
// トップに文を写さないので、遊びのページを直せばトップも自動でそろう。
// - 読み込みは、カードの列が画面に近づいたときに先に済ませる（押したらすぐ開く）
// - 帯を指でずらしたとき（8px以上動いたとき）は開かない。軽く押したときだけ開く
// - 読み込みに失敗したときは、遊びのページへ移動するだけ
(function () {
  'use strict';

  var TAP_SLOP = 8;
  var CHIP_FIELDS = [
    { key: 'place', label: '場所' },
    { key: 'night', label: '時間' },
    { key: 'rain', label: '雨' },
    { key: 'gear', label: '道具' }
  ];
  var catalog = null;      // 遊びの名前 → カードの中身
  var loading = null;

  function nameOf(el, selector) {
    var nameEl = el.querySelector(selector);
    if (!nameEl) { return ''; }
    var text = '';
    nameEl.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; }
    });
    return text.trim();
  }

  function loadCatalog() {
    if (catalog) { return Promise.resolve(catalog); }
    if (loading) { return loading; }
    loading = fetch('/play/', { credentials: 'same-origin' })
      .then(function (res) { if (!res.ok) { throw new Error('status ' + res.status); } return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var map = {};
        doc.querySelectorAll('.top-v2-catalog-item[data-desc]').forEach(function (item) {
          var name = nameOf(item, '.top-v2-catalog-name');
          if (!name) { return; }
          var img = item.querySelector('.top-v2-catalog-photo img');
          map[name] = { data: item.dataset, img: img ? img.getAttribute('src') : '' };
        });
        catalog = map;
        return map;
      })
      .catch(function (err) { loading = null; throw err; });
    return loading;
  }

  function fillChips(dialog, data) {
    var list = dialog.querySelector('.top-v2-playdialog-chips');
    list.textContent = '';
    CHIP_FIELDS.forEach(function (field) {
      var value = data[field.key];
      if (!value) { return; }
      var chip = document.createElement('li');
      chip.className = 'top-v2-playdialog-chip';
      var label = document.createElement('span');
      label.className = 'top-v2-playdialog-chip-label';
      label.textContent = field.label;
      var val = document.createElement('span');
      val.className = 'top-v2-playdialog-chip-value';
      val.textContent = value;
      chip.appendChild(label);
      chip.appendChild(val);
      list.appendChild(chip);
    });
  }

  function open(dialog, name, entry) {
    var data = entry.data;
    var photo = dialog.querySelector('.top-v2-playdialog-photo');
    if (entry.img) {
      photo.src = entry.img;
      photo.alt = '';
      photo.hidden = false;
    } else {
      photo.removeAttribute('src');
      photo.hidden = true;
    }
    dialog.querySelector('.top-v2-playdialog-title').textContent = name;
    dialog.querySelector('.top-v2-playdialog-desc').textContent = data.desc || '';
    fillChips(dialog, data);

    // 注意の文は、遊びのページ（play-catalog.js）と同じ組み立て方
    var noteEl = dialog.querySelector('.top-v2-playdialog-note');
    var noteText = data.note || '';
    if (data.place === '特大部屋') {
      var compactRoomNote = data.compactNote || '「場所：特大部屋」の遊びはスタンダードプランでご利用いただけます。少人数プランの宴会・食事は1階の食堂をご利用ください。';
      noteText = noteText ? noteText + ' ' + compactRoomNote : compactRoomNote;
    }
    noteEl.textContent = noteText;
    noteEl.hidden = !noteText;

    var linkEl = dialog.querySelector('.top-v2-playdialog-link');
    if (data.linkHref && data.linkLabel) {
      linkEl.href = data.linkHref;
      linkEl.textContent = data.linkLabel;
      linkEl.hidden = false;
    } else {
      linkEl.removeAttribute('href');
      linkEl.textContent = '';
      linkEl.hidden = true;
    }

    document.body.classList.add('top-v2-playdialog-lock');
    dialog.showModal();
  }

  function boot() {
    var dialog = document.querySelector('.top-v2-playdialog--top');
    var roll = document.querySelector('.top-v2-playroll');
    if (!dialog || !roll || typeof dialog.showModal !== 'function') { return; }

    // 列が画面に近づいたら、先に読み込んでおく
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          io.disconnect();
          loadCatalog().catch(function () { /* 押したときにもう一度試す */ });
        }
      }, { rootMargin: '600px 0px' });
      io.observe(roll);
    }

    // 押した位置を覚えておき、指が8px以上動いていたら（帯をずらしたら）開かない
    var downX = null, downY = null;
    roll.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; }, true);

    roll.addEventListener('click', function (e) {
      var card = e.target.closest('.top-v2-playcard');
      if (!card) { return; }
      if (downX !== null && (Math.abs(e.clientX - downX) > TAP_SLOP || Math.abs(e.clientY - downY) > TAP_SLOP)) { return; }
      var nameEl = card.querySelector('.top-v2-playcard-name');
      var name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) { return; }
      loadCatalog().then(function (map) {
        var entry = map[name];
        if (!entry) { window.location.href = '/play/#catalog'; return; }
        open(dialog, name, entry);
      }).catch(function () {
        window.location.href = '/play/#catalog';
      });
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) { dialog.close(); }
    });
    var closeBtn = dialog.querySelector('[data-dialog-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dialog.close(); });
    }
    dialog.addEventListener('close', function () {
      document.body.classList.remove('top-v2-playdialog-lock');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
