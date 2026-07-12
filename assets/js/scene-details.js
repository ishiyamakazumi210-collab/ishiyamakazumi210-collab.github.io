// /play/「食べる」「泊まる」の補足ポップアップ。
// カード面は比較に必要な要点だけに絞り、設備・運用・部屋割りの詳細は
// 静的な<dialog>へ分ける。リンク遷移する「頼むこともできる」と、表だけで
// 完結する「トイレ」は対象外。
(function () {
  'use strict';

  function boot() {
    var openers = Array.prototype.slice.call(document.querySelectorAll('[data-scene-dialog-open]'));
    var dialogs = Array.prototype.slice.call(document.querySelectorAll('.top-v2-scenedialog'));
    if (!openers.length || !dialogs.length) { return; }

    openers.forEach(function (opener) {
      function openDialog() {
        var dialog = document.getElementById(opener.getAttribute('data-scene-dialog-open'));
        if (!dialog || typeof dialog.showModal !== 'function') { return; }
        document.body.classList.add('top-v2-playdialog-lock');
        dialog.showModal();
      }

      opener.addEventListener('click', openDialog);
    });

    dialogs.forEach(function (dialog) {
      var closeBtn = dialog.querySelector('[data-scene-dialog-close]');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () { dialog.close(); });
      }

      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) { dialog.close(); }
      });

      dialog.addEventListener('close', function () {
        document.body.classList.remove('top-v2-playdialog-lock');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
