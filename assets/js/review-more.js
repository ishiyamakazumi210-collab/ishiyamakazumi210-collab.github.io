document.addEventListener('DOMContentLoaded', function () {
  var cards = document.querySelectorAll('.top-v2-review-card--g');
  Array.prototype.forEach.call(cards, function (card) {
    var text = card.querySelector('.top-v2-review-text');
    var btn = card.querySelector('.top-v2-review-more');
    if (!text || !btn) return;
    if (text.scrollHeight > text.clientHeight + 2) {
      btn.hidden = false;
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function () {
      var open = card.classList.toggle('is-open');
      btn.textContent = open ? '閉じる' : 'もっと見る';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
});
