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

    var btnFullscreen = document.createElement("button");
    btnFullscreen.className = "mermaid-zoom-btn";
    btnFullscreen.textContent = "⛶";
    btnFullscreen.title = "Toggle fullscreen";
    btnFullscreen.onclick = function () {
      var wrapper = viewport.parentElement;
      if (!wrapper) return;
      wrapper.classList.toggle("mdv-fullscreen");
      btnFullscreen.textContent = wrapper.classList.contains("mdv-fullscreen") ? "✕" : "⛶";
      btnFullscreen.title = wrapper.classList.contains("mdv-fullscreen") ? "Exit fullscreen" : "Toggle fullscreen";
    };

    controls.appendChild(btnOut);
    controls.appendChild(label);
    controls.appendChild(btnIn);
    controls.appendChild(btnReset);
    controls.appendChild(btnFullscreen);
    return controls;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var fs = document.querySelector(".mermaid-interactive.mdv-fullscreen");
      if (fs) {
        fs.classList.remove("mdv-fullscreen");
        var btn = fs.querySelector(".mermaid-controls .mermaid-zoom-btn:last-child");
        if (btn) {
          btn.textContent = "⛶";
          btn.title = "Toggle fullscreen";
        }
      }
    }
  });

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

  // --- On-demand translation ---
  var SKIP_TRANSLATE_TAGS = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, SVG: 1, MATH: 1 };
  var SKIP_TRANSLATE_CLASSES = ["katex", "mermaid-interactive", "image-interactive", "mermaid-error"];
  var PROTECT_SELECTOR = "code, pre, script, style, svg, math, .katex, .mermaid-interactive, .image-interactive, .mermaid-error";
  var BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd, figcaption, summary";
  var PROTECT_OPEN = "";
  var PROTECT_CLOSE = "";
  var PROTECT_RE = /\s*(\d+)\s*/g;
  var translateState = {
    enabled: document.body.dataset.translate === "1",
    nextRequestId: 1,
    pendingRequests: {}, // requestId -> { block, fragments }
    observer: null,
    translatedBlocks: new WeakSet(),
    originalHtml: new WeakMap(), // block -> original innerHTML
  };

  function isSkippedAncestor(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      if (SKIP_TRANSLATE_TAGS[cur.tagName]) return true;
      if (cur.classList) {
        for (var i = 0; i < SKIP_TRANSLATE_CLASSES.length; i++) {
          if (cur.classList.contains(SKIP_TRANSLATE_CLASSES[i])) return true;
        }
      }
      cur = cur.parentElement;
    }
    return false;
  }

  function protectInlineFragments(block) {
    var clone = block.cloneNode(true);
    var fragments = [];
    var nodes = clone.querySelectorAll(PROTECT_SELECTOR);
    nodes.forEach(function (el) {
      if (!clone.contains(el)) return; // ancestor was already replaced
      var idx = fragments.length;
      fragments.push(el.outerHTML);
      var marker = document.createTextNode(PROTECT_OPEN + idx + PROTECT_CLOSE);
      el.parentNode.replaceChild(marker, el);
    });
    return { html: clone.innerHTML, fragments: fragments };
  }

  function restoreProtectedFragments(html, fragments) {
    if (!fragments.length) return html;
    return html.replace(PROTECT_RE, function (_, i) {
      var idx = Number(i);
      return idx >= 0 && idx < fragments.length ? fragments[idx] : "";
    });
  }

  function translateBlock(block) {
    if (translateState.translatedBlocks.has(block)) return;
    translateState.translatedBlocks.add(block);

    if (!translateState.originalHtml.has(block)) {
      translateState.originalHtml.set(block, block.innerHTML);
    }

    var protectedResult = protectInlineFragments(block);
    var stripped = protectedResult.html.replace(PROTECT_RE, "").replace(/<[^>]+>/g, "");
    if (!stripped.trim()) return;

    var requestId = translateState.nextRequestId++;
    translateState.pendingRequests[requestId] = {
      block: block,
      fragments: protectedResult.fragments,
    };
    vscodeApi.postMessage({
      type: "translate",
      requestId: requestId,
      texts: [protectedResult.html],
    });
  }

  function applyTranslation(requestId, translated) {
    var pending = translateState.pendingRequests[requestId];
    if (!pending) return;
    delete translateState.pendingRequests[requestId];
    if (!translateState.enabled) return;
    if (!translated || translated.length === 0) return;
    var translatedHtml = translated[0];
    if (translatedHtml == null) return;
    pending.block.innerHTML = restoreProtectedFragments(translatedHtml, pending.fragments);
  }

  function restoreOriginals() {
    document.querySelectorAll(BLOCK_SELECTOR).forEach(function (block) {
      var orig = translateState.originalHtml.get(block);
      if (orig != null) {
        block.innerHTML = orig;
      }
    });
  }

  function startTranslateObserver() {
    if (translateState.observer) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          translateBlock(entry.target);
        }
      });
    }, { rootMargin: "200px 0px", threshold: 0 });
    document.querySelectorAll(BLOCK_SELECTOR).forEach(function (el) {
      if (isSkippedAncestor(el.parentElement)) return;
      obs.observe(el);
    });
    translateState.observer = obs;
  }

  function stopTranslateObserver() {
    if (translateState.observer) {
      translateState.observer.disconnect();
      translateState.observer = null;
    }
    translateState.translatedBlocks = new WeakSet();
    translateState.pendingRequests = {};
  }

  function setTranslateBannerVisible(visible, to) {
    var banner = document.querySelector(".mdv-translate-banner");
    if (banner) {
      banner.style.display = visible ? "block" : "none";
      if (to) {
        var target = banner.querySelector(".mdv-translate-target");
        if (target) target.textContent = to;
      }
    }
  }

  if (translateState.enabled) {
    startTranslateObserver();
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg) return;

    if (msg.type === "setTranslateMode") {
      translateState.enabled = !!msg.enabled;
      if (translateState.enabled) {
        setTranslateBannerVisible(true, msg.to);
        startTranslateObserver();
      } else {
        stopTranslateObserver();
        restoreOriginals();
        setTranslateBannerVisible(false);
      }
      return;
    }

    if (msg.type === "translateResult") {
      applyTranslation(msg.requestId, msg.translated);
      return;
    }

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

    if (msg.type === "updateAnnotationHighlights") {
      updateAnnotationHighlights(msg.lineRanges);
    }
  });

  // --- Link click interception ---
  document.addEventListener("click", function (e) {
    // Walk up from the event target to find the closest <a> element
    var target = e.target;
    while (target && target.tagName !== "A") {
      target = target.parentElement;
    }
    if (!target || target.tagName !== "A") return;

    var href = target.getAttribute("href");
    if (!href) return;

    // Fragment-only links are same-page anchors — skip
    if (href.startsWith("#")) return;

    // External URLs and mailto: let the default behavior handle them
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !/^[a-zA-Z]:[\\/]/.test(href)) return;

    // Wiki-link (has .wiki-link class) or relative .md link
    var isWikiLink = target.classList.contains("wiki-link");
    var isMdLink = /\.md(#.*)?$/.test(href);

    if (isWikiLink || isMdLink) {
      e.preventDefault();
      e.stopPropagation();
      vscodeApi.postMessage({ type: "openFile", href: href });
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

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
})();
