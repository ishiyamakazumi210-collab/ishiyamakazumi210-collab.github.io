document.addEventListener("submit", function(event) {
  if (event.target.matches("[data-static-disabled=true]")) {
    event.preventDefault();
    alert("ローカルプレビューではフォーム送信を無効化しています。");
  }
});
document.querySelectorAll("[data-static-disabled=true]").forEach(function(form) {
  if (!form.querySelector(".katasho-static-form-note")) {
    var note = document.createElement("p");
    note.className = "katasho-static-form-note";
    note.textContent = "ローカルプレビューのため、フォーム送信は無効です。";
    form.prepend(note);
  }
});