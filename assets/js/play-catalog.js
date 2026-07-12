// /play/ #catalog カードポップアップ（48種）。
// カード48枚(li.top-v2-catalog-item)のdata-desc等をHTML側の正データとし、
// クリック/Enter/Spaceで唯一の<dialog>へ差し込んで開く。追加/削除・並び替えは
// HTML側（データ）を直すだけで済むよう、ここでは表示の配線のみ行う。
//
// 開閉アニメーションは実装しない（prefers-reduced-motion「開閉アニメなし」の
// 要件は、そもそもアニメを足さないことでどのユーザーにも一律に満たす）。
(function () {
  'use strict';

  var CHIP_FIELDS = [
    { key: 'place', label: '場所' },
    { key: 'night', label: '夜' },
    { key: 'rain', label: '雨' },
    { key: 'gear', label: '道具' }
  ];

  function fillChips(dialog, item) {
    var list = dialog.querySelector('.top-v2-playdialog-chips');
    list.textContent = '';
    CHIP_FIELDS.forEach(function (field) {
      var value = item.dataset[field.key];
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

  // .top-v2-catalog-name には「飲み放題」のように有料バッジ
  // (.top-v2-catalog-paidtag)が入れ子で入っているカードがあるため、
  // textContentをそのまま使うと「飲み放題有料」と連結してしまう。
  // 直下のテキストノードだけを拾い、バッジ文字列を除いた遊び名にする
  function catalogItemName(item) {
    var nameEl = item.querySelector('.top-v2-catalog-name');
    if (!nameEl) { return ''; }
    var text = '';
    nameEl.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; }
    });
    return text.trim();
  }

  function openFor(item, dialog) {
    // 写真カードは同じ画像をダイアログにも表示(番号カードは非表示)。
    // 画像の正データはカード側のimgなので、data属性は増やさず流用する
    var photoEl = dialog.querySelector('.top-v2-playdialog-photo');
    var cardImg = item.querySelector('.top-v2-catalog-photo img');
    if (photoEl) {
      if (cardImg) {
        photoEl.src = cardImg.currentSrc || cardImg.src;
        photoEl.alt = cardImg.alt || '';
        photoEl.hidden = false;
      } else {
        photoEl.removeAttribute('src');
        photoEl.hidden = true;
      }
    }
    dialog.querySelector('.top-v2-playdialog-title').textContent = catalogItemName(item);
    dialog.querySelector('.top-v2-playdialog-desc').textContent = item.dataset.desc || '';
    fillChips(dialog, item);

    var noteEl = dialog.querySelector('.top-v2-playdialog-note');
    var noteText = item.dataset.note || '';
    if (item.dataset.place === '大部屋') {
      var compactRoomNote = '「場所：大部屋」の遊びは通常プランでご利用いただけます。コンパクトプランの宴会・食事は併設の調理室をご利用ください。';
      noteText = noteText ? noteText + ' ' + compactRoomNote : compactRoomNote;
    }
    if (noteText) {
      noteEl.textContent = noteText;
      noteEl.hidden = false;
    } else {
      noteEl.textContent = '';
      noteEl.hidden = true;
    }

    // 詳細リンクがあるカードのみ: 献立・料金・延長案内などへのリンクを表示
    var linkEl = dialog.querySelector('.top-v2-playdialog-link');
    if (item.dataset.linkHref && item.dataset.linkLabel) {
      linkEl.href = item.dataset.linkHref;
      linkEl.textContent = item.dataset.linkLabel;
      linkEl.hidden = false;
    } else {
      linkEl.removeAttribute('href');
      linkEl.textContent = '';
      linkEl.hidden = true;
    }

    // 計測未配線(GTM)だが将来の配線に備え、開いたカードの通し番号を
    // ダイアログ側にも反映しておく（カード側は静的data-eventが正）
    if (item.dataset.event) {
      dialog.setAttribute('data-event', item.dataset.event);
    } else {
      dialog.removeAttribute('data-event');
    }

    document.body.classList.add('top-v2-playdialog-lock');
    dialog.showModal();
  }

  function boot() {
    var dialog = document.querySelector('.top-v2-playdialog');
    if (!dialog || typeof dialog.showModal !== 'function') { return; }

    var items = Array.prototype.slice.call(document.querySelectorAll('.top-v2-catalog-item[data-desc]'));
    if (!items.length) { return; }

    items.forEach(function (item) {
      item.addEventListener('click', function () {
        openFor(item, dialog);
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFor(item, dialog);
        }
      });
    });

    // backdropクリックで閉じる: クリックがdialog要素自身をターゲットにした時
    // （＝中身の.top-v2-playdialog-sheetの外側=backdrop）だけ閉じる
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) { dialog.close(); }
    });

    var closeBtn = dialog.querySelector('[data-dialog-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dialog.close(); });
    }

    // ESC/backdrop/とじるボタン、どの経路で閉じてもcloseイベントに集約される。
    // フォーカスは開いた時に効力があったカードへdialog標準挙動で自動的に戻る
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
