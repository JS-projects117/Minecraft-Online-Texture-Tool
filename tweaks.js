// Tweaks panel — vanilla JS. Implements the host protocol so the toolbar's
// Tweaks toggle activates this panel. Lives inside its own floating window
// rather than mounting on top of the main UI.

(function () {
  // ---- DEFAULTS ----
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent":          "#FF6A3D",
    "accentName":      "ember",
    "rotateSpeed":     1,
    "bgPattern":       "dots",
    "lighting":        0.85,
    "editorSide":      "right",
    "compactUi":       false,
    "showFps":         false
  }/*EDITMODE-END*/;

  // ---- STATE ----
  let tweaks = { ...TWEAK_DEFAULTS };
  let panelOpen = false;
  let panelEl = null;

  // ---- HOST PROTOCOL ----
  // Register listeners FIRST, then announce availability.
  window.addEventListener("message", (e) => {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "__activate_edit_mode") openPanel();
    else if (e.data.type === "__deactivate_edit_mode") closePanel();
  });
  function announceAvailable() {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  }

  function persist(key, value) {
    tweaks[key] = value;
    window.parent.postMessage({
      type: "__edit_mode_set_keys",
      edits: { [key]: value },
    }, "*");
    applyTweak(key, value);
  }

  function persistMany(edits) {
    Object.assign(tweaks, edits);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
    Object.entries(edits).forEach(([k, v]) => applyTweak(k, v));
  }

  // ---- APPLY each tweak to the live DOM / ModelViewer ----
  function applyAll() { Object.entries(tweaks).forEach(([k, v]) => applyTweak(k, v)); }

  function applyTweak(key, value) {
    if (key === "accent") {
      // Override the ember accent variable. The whole UI re-skins via CSS vars.
      document.documentElement.style.setProperty("--ember-500", value);
    } else if (key === "rotateSpeed") {
      window._rotateSpeedMul = value;
    } else if (key === "bgPattern") {
      document.body.dataset.bg = value;
    } else if (key === "lighting") {
      window._lightingMul = value;
      if (window.ModelViewer && window.ModelViewer._debug) {
        const dbg = window.ModelViewer._debug();
        if (dbg.scene) {
          dbg.scene.traverse((o) => {
            if (o.isAmbientLight) o.intensity = 0.85 * value;
            if (o.isDirectionalLight) o.intensity = (o === dbg.scene.children[2] ? 0.35 : 0.12) * value;
          });
        }
      }
    } else if (key === "editorSide") {
      document.body.dataset.editorSide = value;
    } else if (key === "compactUi") {
      document.body.dataset.compact = value ? "on" : "off";
    } else if (key === "showFps") {
      const el = document.querySelector("#fps-meter");
      if (el) el.style.display = value ? "inline-flex" : "none";
    }
  }

  // ---- UI ----
  function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement("div");
    panelEl.className = "tweaks-panel";
    panelEl.innerHTML = `
      <div class="tw-head">
        <div class="tw-title">
          <span class="tw-glyph">✦</span>
          Tweaks
        </div>
        <button class="tw-close" aria-label="close tweaks">×</button>
      </div>
      <div class="tw-body">

        <div class="tw-section">
          <div class="tw-section-label">accent color</div>
          <div class="tw-swatches">
            <button class="tw-swatch" data-accent="#FF6A3D" data-name="ember"   style="background:#FF6A3D" title="ember"></button>
            <button class="tw-swatch" data-accent="#FF4F70" data-name="coral"   style="background:#FF4F70" title="coral"></button>
            <button class="tw-swatch" data-accent="#FFC857" data-name="gold"    style="background:#FFC857" title="gold"></button>
            <button class="tw-swatch" data-accent="#E94BD6" data-name="magenta" style="background:#E94BD6" title="magenta"></button>
            <button class="tw-swatch" data-accent="#7FE0A8" data-name="mint"    style="background:#7FE0A8" title="mint"></button>
            <button class="tw-swatch" data-accent="#5AB6FF" data-name="sky"     style="background:#5AB6FF" title="sky"></button>
          </div>
        </div>

        <div class="tw-section">
          <div class="tw-section-label">3d viewer</div>
          <label class="tw-control">
            <span class="tw-control-label">rotate speed</span>
            <input type="range" data-tweak="rotateSpeed" min="0" max="3" step="0.05" value="${tweaks.rotateSpeed}">
            <span class="tw-control-val" data-val="rotateSpeed">${tweaks.rotateSpeed.toFixed(2)}×</span>
          </label>
          <label class="tw-control">
            <span class="tw-control-label">lighting</span>
            <input type="range" data-tweak="lighting" min="0.2" max="2" step="0.05" value="${tweaks.lighting}">
            <span class="tw-control-val" data-val="lighting">${tweaks.lighting.toFixed(2)}×</span>
          </label>
        </div>

        <div class="tw-section">
          <div class="tw-section-label">background</div>
          <div class="tw-radio" data-tweak="bgPattern">
            <button data-val="dots">dots</button>
            <button data-val="solid">solid</button>
            <button data-val="scanlines">scanlines</button>
          </div>
        </div>

        <div class="tw-section">
          <div class="tw-section-label">layout</div>
          <div class="tw-radio" data-tweak="editorSide">
            <button data-val="left">left panel</button>
            <button data-val="right">right panel</button>
          </div>
          <label class="tw-toggle">
            <input type="checkbox" data-tweak="compactUi" ${tweaks.compactUi ? "checked" : ""}>
            <span>compact ui</span>
          </label>
          <label class="tw-toggle">
            <input type="checkbox" data-tweak="showFps" ${tweaks.showFps ? "checked" : ""}>
            <span>show fps meter</span>
          </label>
        </div>

        <div class="tw-section">
          <button class="tw-reset">reset tweaks</button>
        </div>
      </div>
    `;
    document.body.appendChild(panelEl);
    wireControls();
    syncControlsToState();
    // Drag to move
    enableDrag(panelEl, panelEl.querySelector(".tw-head"));
  }

  function wireControls() {
    panelEl.querySelector(".tw-close").addEventListener("click", () => {
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
      closePanel();
    });
    panelEl.querySelectorAll('input[type="range"]').forEach(el => {
      el.addEventListener("input", () => {
        const key = el.dataset.tweak;
        const val = parseFloat(el.value);
        persist(key, val);
        const span = panelEl.querySelector(`[data-val="${key}"]`);
        if (span) span.textContent = val.toFixed(2) + "×";
      });
    });
    panelEl.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.addEventListener("change", () => persist(el.dataset.tweak, el.checked));
    });
    panelEl.querySelectorAll(".tw-radio").forEach(group => {
      const key = group.dataset.tweak;
      group.querySelectorAll("button").forEach(b => {
        b.addEventListener("click", () => {
          group.querySelectorAll("button").forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          persist(key, b.dataset.val);
        });
      });
    });
    panelEl.querySelectorAll(".tw-swatch").forEach(s => {
      s.addEventListener("click", () => {
        panelEl.querySelectorAll(".tw-swatch").forEach(x => x.classList.remove("active"));
        s.classList.add("active");
        persistMany({ accent: s.dataset.accent, accentName: s.dataset.name });
      });
    });
    panelEl.querySelector(".tw-reset").addEventListener("click", () => {
      persistMany({ ...TWEAK_DEFAULTS });
      syncControlsToState();
    });
  }

  function syncControlsToState() {
    // Range
    panelEl.querySelectorAll('input[type="range"]').forEach(el => {
      const key = el.dataset.tweak;
      el.value = tweaks[key];
      const span = panelEl.querySelector(`[data-val="${key}"]`);
      if (span) span.textContent = (+tweaks[key]).toFixed(2) + "×";
    });
    // Checkbox
    panelEl.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.checked = !!tweaks[el.dataset.tweak];
    });
    // Radio groups
    panelEl.querySelectorAll(".tw-radio").forEach(group => {
      const key = group.dataset.tweak;
      group.querySelectorAll("button").forEach(b => {
        b.classList.toggle("active", b.dataset.val === tweaks[key]);
      });
    });
    // Swatches
    panelEl.querySelectorAll(".tw-swatch").forEach(s => {
      s.classList.toggle("active", s.dataset.accent.toLowerCase() === (tweaks.accent || "").toLowerCase());
    });
  }

  function enableDrag(panel, handle) {
    let dragging = false, ox = 0, oy = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      panel.style.left = (e.clientX - ox) + "px";
      panel.style.top  = (e.clientY - oy) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    handle.addEventListener("pointerup", (e) => {
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  }

  function openPanel() {
    buildPanel();
    panelOpen = true;
    panelEl.classList.add("open");
  }
  function closePanel() {
    panelOpen = false;
    if (panelEl) panelEl.classList.remove("open");
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    applyAll();
    announceAvailable();
  });
})();
