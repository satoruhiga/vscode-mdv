(function () {
  // Initialize Mermaid
  if (typeof mermaid !== "undefined") {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#e5e7eb",
        primaryTextColor: "#1f2937",
        primaryBorderColor: "#9ca3af",
        lineColor: "#6b7280",
        secondaryColor: "#f3f4f6",
        tertiaryColor: "#e5e7eb",
        noteBkgColor: "#fef9c3",
        noteTextColor: "#1f2937",
        noteBorderColor: "#ca8a04",
      },
    });

    renderMermaidDiagrams();
  }

  /**
   * Find all mermaid code blocks and render them as diagrams.
   */
  async function renderMermaidDiagrams() {
    const codeBlocks = document.querySelectorAll("code.language-mermaid");

    for (let i = 0; i < codeBlocks.length; i++) {
      const codeEl = codeBlocks[i];
      const preEl = codeEl.parentElement;
      if (!preEl || preEl.tagName !== "PRE") continue;

      const rawCode = codeEl.textContent || "";
      const diagramId = "mermaid-diagram-" + i;

      try {
        const { svg } = await mermaid.render(diagramId, rawCode);

        // Build interactive container with zoom controls
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-interactive";

        const viewport = document.createElement("div");
        viewport.className = "mermaid-viewport";

        const container = document.createElement("div");
        container.className = "mermaid-container";
        container.innerHTML = svg;

        const svgEl = container.querySelector("svg");
        if (svgEl) {
          svgEl.removeAttribute("height");
          svgEl.style.width = "100%";
          svgEl.style.height = "auto";
        }

        viewport.appendChild(container);
        wrapper.appendChild(viewport);
        wrapper.appendChild(createZoomControls(viewport, container));

        preEl.replaceWith(wrapper);
      } catch (err) {
        const errorContainer = document.createElement("div");
        errorContainer.className = "mermaid-error";
        errorContainer.innerHTML =
          '<div class="mermaid-error-message">' + escapeHtml(err.message || "Mermaid syntax error") + "</div>" +
          '<pre class="mermaid-error-code">' + escapeHtml(rawCode) + "</pre>";
        preEl.replaceWith(errorContainer);

        const errEl = document.getElementById("d" + diagramId);
        if (errEl) errEl.remove();
      }
    }
  }

  /**
   * Create zoom/pan controls for a mermaid diagram.
   */
  function createZoomControls(viewport, container) {
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    function applyTransform() {
      container.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + scale + ")";
      label.textContent = Math.round(scale * 100) + "%";
    }

    // Mouse wheel zoom
    viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      var oldScale = scale;
      var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      scale = Math.min(Math.max(scale * factor, 0.1), 10);

      // Zoom toward mouse position
      panX = mouseX - (mouseX - panX) * (scale / oldScale);
      panY = mouseY - (mouseY - panY) * (scale / oldScale);
      applyTransform();
    }, { passive: false });

    // Mouse drag to pan
    viewport.addEventListener("mousedown", function (e) {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", function (e) {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });

    document.addEventListener("mouseup", function () {
      if (isPanning) {
        isPanning = false;
        viewport.style.cursor = "grab";
      }
    });

    // Controls bar
    var controls = document.createElement("div");
    controls.className = "mermaid-controls";

    var btnOut = document.createElement("button");
    btnOut.className = "mermaid-zoom-btn";
    btnOut.textContent = "\u2212";
    btnOut.title = "Zoom out";
    btnOut.onclick = function () {
      scale = Math.max(scale / 1.25, 0.1);
      applyTransform();
    };

    var label = document.createElement("span");
    label.className = "mermaid-zoom-level";
    label.textContent = "100%";

    var btnIn = document.createElement("button");
    btnIn.className = "mermaid-zoom-btn";
    btnIn.textContent = "+";
    btnIn.title = "Zoom in";
    btnIn.onclick = function () {
      scale = Math.min(scale * 1.25, 10);
      applyTransform();
    };

    var btnReset = document.createElement("button");
    btnReset.className = "mermaid-zoom-btn";
    btnReset.textContent = "=";
    btnReset.title = "Reset zoom";
    btnReset.onclick = function () {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    };

    controls.appendChild(btnOut);
    controls.appendChild(label);
    controls.appendChild(btnIn);
    controls.appendChild(btnReset);
    return controls;
  }

  /**
   * Wrap images in zoomable containers.
   */
  function wrapImages() {
    var images = document.querySelectorAll(".prose img");
    images.forEach(function (img) {
      // Skip if already wrapped
      if (img.parentElement && img.parentElement.classList.contains("image-container")) return;

      var wrapper = document.createElement("div");
      wrapper.className = "mermaid-interactive image-interactive";

      var viewport = document.createElement("div");
      viewport.className = "mermaid-viewport";

      var container = document.createElement("div");
      container.className = "image-container";

      img.parentElement.insertBefore(wrapper, img);
      container.appendChild(img);
      viewport.appendChild(container);
      wrapper.appendChild(viewport);
      wrapper.appendChild(createZoomControls(viewport, container));
    });
  }

  wrapImages();

  // --- Extension messaging ---
  var vscodeApi = acquireVsCodeApi();

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg) return;

    if (msg.type === "scrollToLine") {
      scrollToLine(msg.line);
    }

    if (msg.type === "requestSelection") {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        vscodeApi.postMessage({ type: "selectionResult", selection: null });
        return;
      }
      var exact = sel.toString();
      var lineRange = getLineRangeFromSelection(sel);
      // Include mouse position for comment input placement
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      vscodeApi.postMessage({
        type: "selectionResult",
        selection: lineRange ? {
          exact: exact,
          lineRange: lineRange,
          x: Math.round(rect.left),
          y: Math.round(rect.bottom + 4),
        } : null,
      });
    }

    if (msg.type === "showCommentInput") {
      showCommentInput(msg.x, msg.y);
    }

    if (msg.type === "updateAnnotationHighlights") {
      updateAnnotationHighlights(msg.lineRanges);
    }
  });

  // Track visible line on scroll and report to extension
  var scrollTimer = null;
  window.addEventListener("scroll", function () {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var line = getVisibleLine();
      if (line !== null) {
        vscodeApi.postMessage({ type: "visibleLine", line: line });
      }
    }, 100);
  });

  function getVisibleLine() {
    var elements = document.querySelectorAll("[data-line]");
    for (var i = 0; i < elements.length; i++) {
      var rect = elements[i].getBoundingClientRect();
      if (rect.top >= 0) {
        return parseInt(elements[i].getAttribute("data-line"), 10);
      }
    }
    // All elements above viewport — return last one
    if (elements.length > 0) {
      return parseInt(elements[elements.length - 1].getAttribute("data-line"), 10);
    }
    return null;
  }

  function scrollToLine(line) {
    var target = findClosestElement(line);
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }

  function findClosestElement(line) {
    var elements = document.querySelectorAll("[data-line]");
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var elLine = parseInt(el.getAttribute("data-line"), 10);
      var dist = Math.abs(elLine - line);
      if (elLine <= line && dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }
    return best;
  }

  function getLineRangeFromSelection(sel) {
    if (sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0);
    var startLine = findDataLine(range.startContainer);
    var endLine = findDataLine(range.endContainer);
    if (startLine === null) return null;
    if (endLine === null) endLine = startLine;
    if (range.endOffset === 0 && endLine !== startLine) {
      endLine = startLine;
    }
    var min = Math.min(startLine, endLine);
    var max = Math.max(startLine, endLine);
    return [min, max];
  }

  function findDataLine(node) {
    var current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (current && current !== document.body) {
      var line = current.getAttribute && current.getAttribute("data-line");
      if (line) return parseInt(line, 10);
      current = current.parentElement;
    }
    return null;
  }

  function updateAnnotationHighlights(lineRanges) {
    var existing = document.querySelectorAll(".mdv-annotation-highlight");
    existing.forEach(function (el) {
      el.classList.remove("mdv-annotation-highlight");
    });
    if (!lineRanges || lineRanges.length === 0) return;
    var annotatedLines = new Set();
    lineRanges.forEach(function (range) {
      for (var l = range[0]; l <= range[1]; l++) {
        annotatedLines.add(l);
      }
    });
    // Only highlight leaf-level elements (skip containers that have child data-line elements)
    var elements = document.querySelectorAll("[data-line]");
    elements.forEach(function (el) {
      var line = parseInt(el.getAttribute("data-line"), 10);
      if (annotatedLines.has(line) && !el.querySelector("[data-line]")) {
        el.classList.add("mdv-annotation-highlight");
      }
    });
  }

  function showCommentInput(x, y) {
    dismissCommentInput();
    var overlay = document.createElement("div");
    overlay.className = "mdv-comment-overlay";
    var box = document.createElement("div");
    box.className = "mdv-comment-input";
    // Keep within viewport
    var left = Math.min(x, window.innerWidth - 280);
    var top = Math.min(y, window.innerHeight - 120);
    box.style.left = Math.max(0, left) + "px";
    box.style.top = Math.max(0, top) + "px";

    var textarea = document.createElement("textarea");
    textarea.placeholder = "Enter your comment...";
    textarea.rows = 3;

    var hint = document.createElement("div");
    hint.className = "mdv-comment-hint";
    hint.textContent = "Enter to save, Shift+Enter for newline, Esc to cancel";

    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        var body = textarea.value;
        dismissCommentInput();
        vscodeApi.postMessage({ type: "commentSubmit", body: body });
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissCommentInput();
        vscodeApi.postMessage({ type: "commentCancel" });
      }
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        dismissCommentInput();
        vscodeApi.postMessage({ type: "commentCancel" });
      }
    });

    box.appendChild(textarea);
    box.appendChild(hint);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    textarea.focus();
  }

  function dismissCommentInput() {
    var existing = document.querySelector(".mdv-comment-overlay");
    if (existing) existing.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
})();
