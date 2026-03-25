(function () {
  var vscodeApi = acquireVsCodeApi();
  var annotations = window.__annotations || [];

  function render() {
    var root = document.getElementById("root");
    if (annotations.length === 0) {
      root.innerHTML = '<div class="empty">No annotations yet.<br>Select text in a preview and right-click to add a comment.</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < annotations.length; i++) {
      var a = annotations[i];
      var loc = a.target.filePath + ":" +
        (a.target.lineRange[0] === a.target.lineRange[1]
          ? "L" + a.target.lineRange[0]
          : "L" + a.target.lineRange[0] + "-L" + a.target.lineRange[1]);
      var quote = a.target.exact.length > 100
        ? a.target.exact.slice(0, 97) + "..."
        : a.target.exact;

      html += '<div class="annotation" data-id="' + a.id + '">' +
        '<div class="annotation-header">' +
          '<span class="annotation-location">' + escapeHtml(loc) + '</span>' +
          '<span class="annotation-actions">' +
            '<button class="btn-delete" title="Delete">\u2715</button>' +
          '</span>' +
        '</div>' +
        '<div class="annotation-quote">' + escapeHtml(quote) + '</div>' +
        '<div class="annotation-body">' + escapeHtml(a.body) + '</div>' +
      '</div>';
    }
    root.innerHTML = html;

    var deleteButtons = root.querySelectorAll(".btn-delete");
    deleteButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.closest(".annotation").getAttribute("data-id");
        vscodeApi.postMessage({ type: "delete", id: id });
      });
    });
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  render();
})();
