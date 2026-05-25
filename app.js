// Minecraft Texture Maker — app logic.
// Drives the homepage, model picker, and texture editor. Reads MODELS for the
// active model definition; all UV math, default skin painting, and export logic
// lives in models.js so this file stays generic.

(function () {

  // ---------------- state ----------------
  const state = {
    currentModelId: null,
    currentModel: null,      // MODELS[currentModelId]
    tool: "pencil",
    color: "#FF6A3D",
    alpha: 255,
    brushSize: 1,
    mirror: false,
    showOverlay: false,
    showBase: true,
    showGuides: true,
    history: [],
    historyIdx: -1,
    isPainting: false,
    lastPx: null,
    cursor: null,
  };

  // Texture canvas — recreated each time the user enters the editor with a
  // model whose size differs. window.textureCanvas is the live source for the
  // 3D viewer's CanvasTexture.
  let textureCanvas = null;
  let textureCtx = null;

  // ---------------- DOM ----------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const homeScreen   = () => $("#home-screen");
  const selectScreen = () => $("#select-screen");
  const editorScreen = () => $("#editor-screen");

  // ---------------- helpers ----------------
  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n>>16)&0xff},${(n>>8)&0xff},${n&0xff},${alpha/255})`;
  }
  function hexToHSL(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return { h: 0, s: 0, l: 50 };
    const n = parseInt(m[1], 16);
    const r = ((n>>16)&0xff)/255, g = ((n>>8)&0xff)/255, b = (n&0xff)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0; const l = (max+min)/2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch (max) {
        case r: h = ((g-b)/d + (g<b?6:0)); break;
        case g: h = ((b-r)/d + 2); break;
        case b: h = ((r-g)/d + 4); break;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) };
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const c = (1-Math.abs(2*l-1))*s;
    const hp = ((h%360)+360)%360 / 60;
    const x = c*(1-Math.abs((hp%2)-1));
    let r=0,g=0,b=0;
    if (hp<1){r=c;g=x;} else if (hp<2){r=x;g=c;}
    else if (hp<3){g=c;b=x;} else if (hp<4){g=x;b=c;}
    else if (hp<5){r=x;b=c;} else {r=c;b=x;}
    const m = l-c/2;
    const toHex = (v) => Math.round((v+m)*255).toString(16).padStart(2,"0");
    return ("#"+toHex(r)+toHex(g)+toHex(b)).toUpperCase();
  }

  // ---------------- texture canvas lifecycle ----------------
  function ensureTextureCanvas(model) {
    if (!textureCanvas) {
      textureCanvas = document.createElement("canvas");
      window.textureCanvas = textureCanvas;
    }
    if (textureCanvas.width !== model.textureWidth || textureCanvas.height !== model.textureHeight) {
      textureCanvas.width  = model.textureWidth;
      textureCanvas.height = model.textureHeight;
    }
    textureCtx = textureCanvas.getContext("2d", { willReadFrequently: true });
    textureCtx.imageSmoothingEnabled = false;
    return textureCanvas;
  }

  // ---------------- editor display canvas ----------------
  let displayScale = 12;
  function getDisplayCanvas() { return $("#tex-canvas"); }
  function getOverlayCanvas() { return $("#tex-overlay"); }

  function fitDisplay() {
    const wrap = $(".tex-canvas-wrap");
    if (!wrap || !state.currentModel) return;
    const pad = 16;
    const m = state.currentModel;
    const availW = wrap.clientWidth - pad;
    const availH = wrap.clientHeight - pad;
    const scaleX = Math.floor(availW / m.textureWidth);
    const scaleY = Math.floor(availH / m.textureHeight);
    const newScale = Math.max(2, Math.min(scaleX, scaleY));
    displayScale = newScale;
    const c = getDisplayCanvas();
    const o = getOverlayCanvas();
    c.width = m.textureWidth;
    c.height = m.textureHeight;
    c.style.width = (m.textureWidth * displayScale) + "px";
    c.style.height = (m.textureHeight * displayScale) + "px";
    o.style.width = (m.textureWidth * displayScale) + "px";
    o.style.height = (m.textureHeight * displayScale) + "px";
    o.width = m.textureWidth * displayScale;
    o.height = m.textureHeight * displayScale;
    redraw();
    drawOverlayGuides();
  }

  function redraw() {
    const c = getDisplayCanvas();
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(textureCanvas, 0, 0);
    if (window._textureObj) window._textureObj.needsUpdate = true;
  }

  function drawOverlayGuides() {
    const o = getOverlayCanvas();
    const ctx = o.getContext("2d");
    const W = o.width, H = o.height;
    ctx.clearRect(0, 0, W, H);
    if (!state.showGuides || !state.currentModel) return;
    ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = "rgba(255, 200, 87, 0.18)";
    ctx.lineWidth = 1;
    const drawRect = (x, y, w, h) =>
      ctx.strokeRect(x * displayScale + 0.5, y * displayScale + 0.5, w * displayScale, h * displayScale);
    state.currentModel.parts.forEach((part) => {
      Object.values(part.faces).forEach(([x, y, w, h]) => drawRect(x, y, w, h));
      if (part.overlay) Object.values(part.overlay).forEach(([x, y, w, h]) => drawRect(x, y, w, h));
    });
    // cursor highlight
    if (state.cursor) {
      const { x, y } = state.cursor;
      ctx.fillStyle = "rgba(255, 106, 61, 0.35)";
      const b = state.brushSize;
      const off = Math.floor(b / 2);
      ctx.fillRect((x - off) * displayScale, (y - off) * displayScale, b * displayScale, b * displayScale);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.strokeRect((x - off) * displayScale + 0.5, (y - off) * displayScale + 0.5, b * displayScale - 1, b * displayScale - 1);
    }
  }

  // ---------------- painting ops ----------------
  function snapshot() {
    return textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
  }
  function pushUndo() {
    state.history.length = state.historyIdx + 1;
    state.history.push(snapshot());
    if (state.history.length > 50) state.history.shift();
    state.historyIdx = state.history.length - 1;
    updateUndoButtons();
  }
  function undo() {
    if (state.historyIdx <= 0) return;
    state.historyIdx--;
    textureCtx.putImageData(state.history[state.historyIdx], 0, 0);
    redraw(); updateUndoButtons();
  }
  function redo() {
    if (state.historyIdx >= state.history.length - 1) return;
    state.historyIdx++;
    textureCtx.putImageData(state.history[state.historyIdx], 0, 0);
    redraw(); updateUndoButtons();
  }
  function updateUndoButtons() {
    $("#btn-undo").disabled = state.historyIdx <= 0;
    $("#btn-redo").disabled = state.historyIdx >= state.history.length - 1;
  }

  function eventToTex(e) {
    const c = getDisplayCanvas();
    const r = c.getBoundingClientRect();
    const m = state.currentModel;
    const x = Math.floor((e.clientX - r.left) / displayScale);
    const y = Math.floor((e.clientY - r.top) / displayScale);
    if (x < 0 || y < 0 || x >= m.textureWidth || y >= m.textureHeight) return null;
    return { x, y };
  }

  function paintPixel(x, y, color, alpha) {
    const m = state.currentModel;
    if (x < 0 || y < 0 || x >= m.textureWidth || y >= m.textureHeight) return;
    if (color === null) {
      textureCtx.clearRect(x, y, 1, 1);
    } else {
      textureCtx.fillStyle = hexToRgba(color, alpha);
      textureCtx.fillRect(x, y, 1, 1);
    }
  }

  function paintBrush(x, y, color, alpha) {
    const b = state.brushSize;
    const off = Math.floor(b / 2);
    for (let j = 0; j < b; j++) {
      for (let i = 0; i < b; i++) {
        paintPixel(x - off + i, y - off + j, color, alpha);
      }
    }
    if (state.mirror) {
      const mx = mirrorX(x);
      if (mx !== null) {
        for (let j = 0; j < b; j++) {
          for (let i = 0; i < b; i++) {
            paintPixel(mx - off + i, y - off + j, color, alpha);
          }
        }
      }
    }
  }

  function mirrorX(x) {
    for (const part of state.currentModel.parts) {
      const layers = part.overlay ? [part.faces, part.overlay] : [part.faces];
      for (const facesObj of layers) {
        const f = facesObj.front;
        if (!f) continue;
        const [rx, , rw] = f;
        if (x >= rx && x < rx + rw) return rx + (rw - 1 - (x - rx));
      }
    }
    return null;
  }

  function regionAt(x, y) {
    for (const part of state.currentModel.parts) {
      const layers = part.overlay ? [part.faces, part.overlay] : [part.faces];
      for (const facesObj of layers) {
        for (const rect of Object.values(facesObj)) {
          const [rx, ry, rw, rh] = rect;
          if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return rect;
        }
      }
    }
    return null;
  }

  function bucketFill(sx, sy, color, alpha) {
    const m = state.currentModel;
    const img = textureCtx.getImageData(0, 0, m.textureWidth, m.textureHeight);
    const data = img.data;
    const idx = (x, y) => (y * m.textureWidth + x) * 4;
    const start = idx(sx, sy);
    const target = [data[start], data[start+1], data[start+2], data[start+3]];

    let fr = 0, fg = 0, fb = 0, fa = 0;
    if (color !== null) {
      const mm = /^#?([0-9a-f]{6})$/i.exec(color);
      if (mm) {
        const n = parseInt(mm[1], 16);
        fr = (n>>16)&0xff; fg = (n>>8)&0xff; fb = n&0xff; fa = alpha;
      }
    }
    if (fr === target[0] && fg === target[1] && fb === target[2] && fa === target[3]) return;

    const region = regionAt(sx, sy);
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= m.textureWidth || y >= m.textureHeight) continue;
      if (region && (x < region[0] || x >= region[0]+region[2] || y < region[1] || y >= region[1]+region[3])) continue;
      const i = idx(x, y);
      if (data[i]!==target[0] || data[i+1]!==target[1] || data[i+2]!==target[2] || data[i+3]!==target[3]) continue;
      data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = fa;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    textureCtx.putImageData(img, 0, 0);
  }

  function pickColorAt(x, y) {
    const d = textureCtx.getImageData(x, y, 1, 1).data;
    if (d[3] < 8) return;
    const hex = "#" + [d[0],d[1],d[2]].map(n => n.toString(16).padStart(2,"0")).join("").toUpperCase();
    setColor(hex, d[3]);
  }

  function applyTool(p) {
    if (state.tool === "pencil") paintBrush(p.x, p.y, state.color, state.alpha);
    else if (state.tool === "eraser") paintBrush(p.x, p.y, null, 0);
    else if (state.tool === "bucket") bucketFill(p.x, p.y, state.color, state.alpha);
    else if (state.tool === "picker") pickColorAt(p.x, p.y);
  }

  function drawLineBetween(a, b, fn) {
    let x0=a.x, y0=a.y, x1=b.x, y1=b.y;
    const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
    const sx = x0<x1 ? 1 : -1, sy = y0<y1 ? 1 : -1;
    let err = dx-dy;
    while (true) {
      fn({x:x0, y:y0});
      if (x0===x1 && y0===y1) break;
      const e2 = 2*err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 <  dx) { err += dx; y0 += sy; }
    }
  }

  function updateCoord(p) {
    const el = $("#coord");
    if (!el) return;
    el.textContent = p ? `${p.x},${p.y}` : "—,—";
  }

  // ---------------- 2D paint events ----------------
  let strokeStart = null;
  function bindCanvas() {
    const tc = getDisplayCanvas();
    tc.onpointerdown = (e) => {
      e.preventDefault();
      const p = eventToTex(e);
      if (!p) return;
      try { tc.setPointerCapture(e.pointerId); } catch (_) {}
      pushUndo();
      state.isPainting = true;
      strokeStart = p;
      if (state.tool !== "line") applyTool(p);
      state.lastPx = p;
      redraw();
    };
    tc.onpointermove = (e) => {
      const p = eventToTex(e);
      state.cursor = p;
      drawOverlayGuides();
      updateCoord(p);
      if (!state.isPainting || !p) return;
      if (state.tool === "line") return;
      if (state.lastPx) drawLineBetween(state.lastPx, p, applyTool);
      else applyTool(p);
      state.lastPx = p;
      redraw();
    };
    const endStroke = (e) => {
      if (!state.isPainting) return;
      state.isPainting = false;
      const p = eventToTex(e) || state.lastPx;
      if (state.tool === "line" && strokeStart && p) {
        drawLineBetween(strokeStart, p, (q) => paintBrush(q.x, q.y, state.color, state.alpha));
        redraw();
      }
      strokeStart = null;
      state.lastPx = null;
      try { tc.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    tc.onpointerup = endStroke;
    tc.onpointercancel = endStroke;
    tc.onpointerleave = () => { state.cursor = null; drawOverlayGuides(); };
  }

  // ---------------- 3D paint bridge ----------------
  let painting3D = false;
  let last3DPx = null;
  window.PaintAPI = {
    begin() { pushUndo(); painting3D = true; last3DPx = null; },
    stroke(p) {
      if (!painting3D || !p) return;
      if (state.tool === "line") return;
      const sameRegion = last3DPx && (() => {
        const a = regionAt(last3DPx.x, last3DPx.y);
        const b = regionAt(p.x, p.y);
        return a && b && a === b;
      })();
      const close = last3DPx && Math.max(Math.abs(p.x-last3DPx.x), Math.abs(p.y-last3DPx.y)) <= 4;
      if (sameRegion && close) drawLineBetween(last3DPx, p, applyTool);
      else applyTool(p);
      last3DPx = p;
      redraw();
    },
    end() { painting3D = false; last3DPx = null; },
    isToolPaintable() {
      return state.tool === "pencil" || state.tool === "eraser" || state.tool === "bucket" || state.tool === "picker";
    },
  };

  // ---------------- tool/color UI ----------------
  function setTool(tool) {
    state.tool = tool;
    $$(".tool-btn").forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
    getDisplayCanvas().style.cursor =
      tool === "picker" ? "copy" : (tool === "bucket" ? "pointer" : "crosshair");
  }
  function setColor(hex, alpha = state.alpha, fromSliders = false) {
    state.color = hex.toUpperCase();
    if (alpha !== undefined) state.alpha = alpha;
    $("#color-swatch").style.background = state.color;
    $("#hex-input").value = state.color;
    $("#color-picker-native").value = state.color;
    $("#alpha-slider").value = state.alpha;
    $("#alpha-val").textContent = state.alpha;
    $$(".swatch[data-color]").forEach(s => s.classList.toggle("active", s.dataset.color === state.color));
    if (!fromSliders) syncHSLFromHex(state.color);
    updateHSLBackgrounds();
  }
  function setBrushSize(n) {
    state.brushSize = n;
    $$(".brush-btn").forEach(b => b.classList.toggle("active", +b.dataset.size === n));
  }
  function syncHSLFromHex(hex) {
    const { h, s, l } = hexToHSL(hex);
    $("#hue-slider").value = h;
    $("#sat-slider").value = s;
    $("#lit-slider").value = l;
    $("#hue-val").textContent = h + "°";
    $("#sat-val").textContent = s + "%";
    $("#lit-val").textContent = l + "%";
  }
  function updateHSLBackgrounds() {
    const h = +$("#hue-slider").value;
    const l = +$("#lit-slider").value;
    const sV = $("#sat-slider").value;
    $("#sat-slider").style.background = `linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`;
    $("#lit-slider").style.background = `linear-gradient(to right, #000, hsl(${h},${sV}%,50%), #fff)`;
  }

  // ---------------- export / import ----------------
  async function exportTexture() {
    const model = state.currentModel;
    const exportBtn = $("#btn-export");
    const original = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "preparing…";
    try {
      const result = await model.export(textureCanvas);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      // If the model export includes multiple files (block), show a summary
      if (result.files && result.files.length > 0) {
        showExportSummary(result);
      }
    } catch (err) {
      console.error("export failed", err);
      alert("Export failed: " + err.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = original;
    }
  }

  function showExportSummary(result) {
    const lines = result.files.map(f => `${f.name} (${f.faces.join(", ")})`).join("\n");
    openConfirm({
      tag: "exported",
      title: "block exported ✓",
      body: `Saved as ${result.filename}.\n\nUnique faces (${result.files.length}):\n${lines}`,
      okLabel: "ok",
      hideCancel: true,
      onOk() {},
    });
  }

  function loadFromFile(file) {
    const img = new Image();
    img.onload = () => {
      const m = state.currentModel;
      pushUndo();
      textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
      textureCtx.imageSmoothingEnabled = false;
      if (img.width === m.textureWidth && img.height === m.textureHeight) {
        textureCtx.drawImage(img, 0, 0);
      } else if (m.id === "player" && img.width === 64 && img.height === 32) {
        textureCtx.drawImage(img, 0, 0);
      } else {
        textureCtx.drawImage(img, 0, 0, m.textureWidth, m.textureHeight);
      }
      redraw();
    };
    img.onerror = () => alert("Couldn't read that image.");
    img.src = URL.createObjectURL(file);
  }

  // ---------------- confirm modal ----------------
  let _confirmOk = null;
  function openConfirm(opts) {
    $("#confirm-tag").textContent = opts.tag || "confirm";
    $("#confirm-title").textContent = opts.title || "are you sure?";
    $("#confirm-body").textContent = opts.body || "";
    $("#confirm-ok").textContent = opts.okLabel || "confirm";
    $("#confirm-cancel").style.display = opts.hideCancel ? "none" : "";
    const preview = $("#confirm-preview");
    if (opts.showPreview) {
      preview.style.display = "flex";
      const swatch = $("#confirm-preview-color");
      swatch.style.background = opts.previewColor || "transparent";
      swatch.style.opacity = (opts.previewAlpha != null) ? (opts.previewAlpha / 255) : 1;
      $("#confirm-preview-text").textContent = opts.previewText || "";
    } else {
      preview.style.display = "none";
    }
    _confirmOk = opts.onOk || null;
    $("#confirm-modal").classList.add("open");
  }
  function closeConfirm() {
    $("#confirm-modal").classList.remove("open");
    _confirmOk = null;
  }

  // ---------------- screens ----------------
  function show(screen) {
    [homeScreen(), selectScreen(), editorScreen()].forEach(s => s && s.classList.remove("active"));
    screen.classList.add("active");
  }

  function goToHome() { show(homeScreen()); }
  function goToSelect(filter) {
    show(selectScreen());
    if (filter) $$(".cat-tab").forEach(b => b.classList.toggle("active", b.dataset.cat === filter));
    renderModelGrid(filter);
  }

  function goToEditor(modelId) {
    const model = window.MODELS[modelId];
    if (!model) return;
    state.currentModelId = modelId;
    state.currentModel = model;
    ensureTextureCanvas(model);
    // Paint default texture if empty (first time entering this model)
    if (!modelHasTexture(modelId)) {
      model.drawDefault(textureCtx);
      saveModelTexture(modelId);
    } else {
      loadModelTexture(modelId);
    }
    show(editorScreen());
    // Initialize three.js viewer (init once; switch model afterwards)
    if (!window._threeInitted) {
      window._threeInitted = true;
      requestAnimationFrame(() => {
        window.ModelViewer.init($("#three-canvas"), textureCanvas, model);
        fitDisplay();
        updateEditorChrome();
      });
    } else {
      window.ModelViewer.setModel(model, textureCanvas);
      requestAnimationFrame(() => { fitDisplay(); updateEditorChrome(); });
    }
    // Reset history for the new model
    state.history = [snapshot()];
    state.historyIdx = 0;
    updateUndoButtons();
  }

  // Stored textures keyed by model id (per-session, in-memory only)
  const _modelTextures = {};
  function saveModelTexture(id) {
    const c = document.createElement("canvas");
    c.width = textureCanvas.width;
    c.height = textureCanvas.height;
    c.getContext("2d").drawImage(textureCanvas, 0, 0);
    _modelTextures[id] = c;
  }
  function loadModelTexture(id) {
    const stored = _modelTextures[id];
    if (!stored) return;
    textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
    textureCtx.drawImage(stored, 0, 0);
  }
  function modelHasTexture(id) { return !!_modelTextures[id]; }

  // Push latest texture to in-memory storage whenever we leave the editor or undo
  function persistTexture() {
    if (state.currentModelId) saveModelTexture(state.currentModelId);
  }

  // ---------------- editor chrome update (per-model) ----------------
  function updateEditorChrome() {
    const m = state.currentModel;
    if (!m) return;
    // Crumb
    $("#crumb-model").textContent = m.label + " • untitled" + (m.id === "block" ? ".zip" : ".png");
    // Texture size chip
    $("#tex-size-chip").textContent = m.textureWidth + "×" + m.textureHeight + " " + (m.id === "block" ? "atlas" : "rgba");
    // Show parts row only for player (only player has multiple parts)
    $("#parts-row").style.display = (m.id === "player") ? "flex" : "none";
    // Show overlay toggle only for player
    $("#layer-overlay").style.display = m.parts.some(p => p.overlay) ? "" : "none";
    // Show pose controls only for player
    $("#pose-controls").style.display = (m.id === "player") ? "" : "none";
    // Reset part-chip active states
    $$(".part-chip[data-part]").forEach(c => c.classList.add("active"));
    // Reset layer-toggle states
    $("#layer-base").classList.add("active");
    $("#layer-overlay").classList.toggle("active", false);
    state.showBase = true;
    state.showOverlay = false;
    window.ModelViewer.setOverlay(false);
    window.ModelViewer.setBase(true);
    // Export button label
    $("#btn-export-label").textContent = m.id === "block" ? "export zip ↓" : "export png ↓";
    // Header subtitle
    $("#brand-sub").textContent = "// " + m.category + " · " + m.info;
  }

  // ---------------- model gallery ----------------
  function modelCards() {
    return [
      // players
      { id: "player",   label: "player",       info: "64×64 skin",        desc: "humanoid",      ready: true,  cat: "players" },
      { id: "alex",     label: "player (slim)", info: "64×64 skin",       desc: "3-px arms",     ready: false, cat: "players" },
      // blocks
      { id: "block",    label: "block (cube)", info: "16×16 per face",    desc: "6 faces",       ready: true,  cat: "blocks" },
      { id: "slab",     label: "slab",         info: "16×16 partial",     desc: "half height",   ready: false, cat: "blocks" },
      { id: "stairs",   label: "stairs",       info: "16×16 stepped",     desc: "L-shape",       ready: false, cat: "blocks" },
      // mobs
      { id: "zombie",   label: "zombie",       info: "64×64 mob",         desc: "humanoid",      ready: false, cat: "mobs" },
      { id: "creeper",  label: "creeper",      info: "64×32 mob",         desc: "boom",          ready: false, cat: "mobs" },
      { id: "pig",      label: "pig",          info: "64×32 mob",         desc: "quadruped",     ready: false, cat: "mobs" },
      // items
      { id: "sword",    label: "iron sword",   info: "16×16 item",        desc: "weapon",        ready: false, cat: "items" },
      { id: "pickaxe",  label: "pickaxe",      info: "16×16 item",        desc: "tool",          ready: false, cat: "items" },
    ];
  }

  function renderHomeCatArt() {
    // Replace the static CSS sprites for players + blocks with live spinning
    // 3D thumbs. Mobs and items stay empty until those models are real.
    const playerArt = $(".home-cat-card[data-cat='players'] .cat-art");
    const blockArt  = $(".home-cat-card[data-cat='blocks']  .cat-art");
    [["players", playerArt, window.MODELS.player],
     ["blocks",  blockArt,  window.MODELS.block]].forEach(([id, slot, model]) => {
      attachSpinnerTo(slot, id, model, 128);
    });
    // Also fill the home hero tiles
    $$(".hero-tile[data-hero-slot]").forEach(tile => {
      const id = tile.dataset.heroSlot;
      const model = window.MODELS[id];
      if (model) attachSpinnerTo(tile, id, model, 220);
    });
  }
  function attachSpinnerTo(slot, id, model, size) {
    if (!slot || !model) return;
    const tex = document.createElement("canvas");
    tex.width = model.textureWidth;
    tex.height = model.textureHeight;
    if (_modelTextures[id]) tex.getContext("2d").drawImage(_modelTextures[id], 0, 0);
    else model.drawDefault(tex.getContext("2d"));
    try {
      const spinner = window.ModelViewer.spinningThumbnail(model, tex, size);
      _homeSpinners.push(spinner);
      slot.innerHTML = "";
      slot.style.padding = "0";
      spinner.canvas.style.width = "100%";
      spinner.canvas.style.height = "100%";
      spinner.canvas.style.imageRendering = "pixelated";
      slot.appendChild(spinner.canvas);
    } catch (err) { console.warn("spinner attach err", id, err); }
  }
  const _homeSpinners = [];
  // Active spinning thumbnails — disposed when the grid re-renders so we don't
  // leak running render loops across category-tab switches.
  const _spinners = [];
  function disposeSpinners() {
    while (_spinners.length) {
      const s = _spinners.pop();
      try { s.dispose(); } catch (_) {}
    }
  }

  function renderModelGrid(filter) {
    const grid = $("#model-grid");
    if (!grid) return;
    disposeSpinners();
    grid.innerHTML = "";
    const cards = modelCards().filter(c => !filter || filter === "all" || c.cat === filter);
    cards.forEach((m) => {
      const card = document.createElement("button");
      card.className = "model-card" + (m.ready ? "" : " locked");
      card.innerHTML = `
        <div class="model-preview" data-preview="${m.id}"></div>
        <span class="tag ${m.ready ? "ready" : "soon"}">${m.ready ? "ready" : "soon"}</span>
        <div class="model-meta">
          <div class="name">${m.label}</div>
          <div class="info"><span>${m.info}</span><span class="sep">•</span><span>${m.desc}</span></div>
        </div>
      `;
      if (m.ready) card.addEventListener("click", () => goToEditor(m.id));
      grid.appendChild(card);
    });

    // Render live spinning thumbnails for ready models
    requestAnimationFrame(() => {
      cards.forEach((m) => {
        const slot = grid.querySelector(`[data-preview="${m.id}"]`);
        if (!slot) return;
        if (m.ready && window.MODELS[m.id]) {
          const model = window.MODELS[m.id];
          const tex = document.createElement("canvas");
          tex.width = model.textureWidth;
          tex.height = model.textureHeight;
          if (_modelTextures[m.id]) {
            tex.getContext("2d").drawImage(_modelTextures[m.id], 0, 0);
          } else {
            model.drawDefault(tex.getContext("2d"));
          }
          try {
            const spinner = window.ModelViewer.spinningThumbnail(model, tex, 256);
            _spinners.push(spinner);
            slot.innerHTML = "";
            spinner.canvas.style.width = "100%";
            spinner.canvas.style.height = "100%";
            spinner.canvas.style.imageRendering = "pixelated";
            slot.appendChild(spinner.canvas);
          } catch (err) { console.warn("spinner err", err); }
        } else {
          slot.innerHTML = `
            <div style="font-family:var(--font-pixel); font-size:42px; color:var(--ink-500); letter-spacing:0.05em; user-select:none;">
              ?soon
            </div>`;
        }
      });
    });
  }

  // ---------------- wiring ----------------
  function wire() {
    // Home → start
    $("#btn-start").addEventListener("click", () => goToSelect("all"));
    $$(".home-cat-card").forEach(c => c.addEventListener("click", () => goToSelect(c.dataset.cat)));
    $$(".brand-home").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); goToHome(); }));

    // Select → home
    $("#btn-select-home").addEventListener("click", () => goToHome());
    // Category tabs
    $$(".cat-tab").forEach(b => b.addEventListener("click", () => {
      $$(".cat-tab").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderModelGrid(b.dataset.cat);
    }));

    // Editor back nav
    $("#btn-back").addEventListener("click", () => { persistTexture(); goToSelect("all"); });
    $("#crumb-back").addEventListener("click", () => { persistTexture(); goToSelect("all"); });
    $("#crumb-home").addEventListener("click", (e) => { e.preventDefault(); persistTexture(); goToHome(); });

    // Tools
    $$(".tool-btn").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));
    $$(".brush-btn").forEach(b => b.addEventListener("click", () => setBrushSize(+b.dataset.size)));
    $$(".swatch[data-color]").forEach(b => b.addEventListener("click", () => setColor(b.dataset.color)));

    // Color inputs
    $("#color-picker-native").addEventListener("input", (e) => setColor(e.target.value));
    $("#hex-input").addEventListener("change", (e) => {
      let v = e.target.value.trim().toUpperCase();
      if (!v.startsWith("#")) v = "#" + v;
      if (/^#[0-9A-F]{6}$/.test(v)) setColor(v);
      else setColor(state.color);
    });
    $("#alpha-slider").addEventListener("input", (e) => {
      state.alpha = +e.target.value;
      $("#alpha-val").textContent = state.alpha;
    });
    const onHSL = () => {
      const h = +$("#hue-slider").value, s = +$("#sat-slider").value, l = +$("#lit-slider").value;
      $("#hue-val").textContent = h + "°";
      $("#sat-val").textContent = s + "%";
      $("#lit-val").textContent = l + "%";
      setColor(hslToHex(h, s, l), state.alpha, true);
    };
    $("#hue-slider").addEventListener("input", onHSL);
    $("#sat-slider").addEventListener("input", onHSL);
    $("#lit-slider").addEventListener("input", onHSL);

    // Layer toggles
    $("#layer-base").addEventListener("click", (e) => {
      state.showBase = !state.showBase;
      e.currentTarget.classList.toggle("active", state.showBase);
      window.ModelViewer.setBase(state.showBase);
    });
    $("#layer-overlay").addEventListener("click", (e) => {
      state.showOverlay = !state.showOverlay;
      e.currentTarget.classList.toggle("active", state.showOverlay);
      window.ModelViewer.setOverlay(state.showOverlay);
    });
    $("#toggle-guides").addEventListener("click", (e) => {
      state.showGuides = !state.showGuides;
      e.currentTarget.classList.toggle("active", state.showGuides);
      drawOverlayGuides();
    });
    $("#toggle-mirror").addEventListener("click", (e) => {
      state.mirror = !state.mirror;
      e.currentTarget.classList.toggle("active", state.mirror);
    });

    // Limb chips
    $$(".part-chip[data-part]").forEach(b => b.addEventListener("click", () => {
      const on = !b.classList.contains("active");
      b.classList.toggle("active", on);
      window.ModelViewer.setPartVisible(b.dataset.part, on);
    }));

    // Fill all (with confirm)
    $("#btn-fill-all").addEventListener("click", () => {
      openConfirm({
        tag: "fill all",
        title: "paint over everything?",
        body: "Every pixel of the texture will be replaced with the current color. This can be undone.",
        showPreview: true,
        previewColor: state.color,
        previewAlpha: state.alpha,
        previewText: `fill ${textureCanvas.width * textureCanvas.height} pixels with ${state.color}`,
        okLabel: "fill all",
        onOk() {
          pushUndo();
          textureCtx.fillStyle = hexToRgba(state.color, state.alpha);
          textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
          redraw();
        },
      });
    });

    // Confirm modal
    $("#confirm-cancel").addEventListener("click", closeConfirm);
    $("#confirm-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeConfirm(); });
    $("#confirm-ok").addEventListener("click", () => {
      const fn = _confirmOk; closeConfirm(); if (fn) fn();
    });
    window.addEventListener("keydown", (e) => {
      if (!$("#confirm-modal").classList.contains("open")) return;
      if (e.key === "Escape") closeConfirm();
      if (e.key === "Enter") $("#confirm-ok").click();
    });

    // Undo / redo / export / import / clear / reset
    $("#btn-undo").addEventListener("click", undo);
    $("#btn-redo").addEventListener("click", redo);
    $("#btn-export").addEventListener("click", exportTexture);
    $("#btn-clear").addEventListener("click", () => {
      openConfirm({
        tag: "clear texture",
        title: "clear the entire texture?",
        body: "Every pixel will be erased to transparent. Undo will bring it back.",
        okLabel: "clear",
        onOk() { pushUndo(); textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height); redraw(); },
      });
    });
    $("#btn-reset-skin").addEventListener("click", () => {
      openConfirm({
        tag: "reset to default",
        title: "reset to default?",
        body: "Replaces the current texture with the model's default. Undo will bring back what you had.",
        okLabel: "reset",
        onOk() { pushUndo(); state.currentModel.drawDefault(textureCtx); redraw(); },
      });
    });
    $("#btn-import").addEventListener("click", () => $("#file-import").click());
    $("#file-import").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) loadFromFile(f);
      e.target.value = "";
    });

    // 3D viewer chrome
    $("#btn-autorotate").addEventListener("click", (e) => {
      const on = !window.ModelViewer.isAutoRotate();
      window.ModelViewer.setAutoRotate(on);
      e.currentTarget.classList.toggle("active", on);
    });
    $("#btn-reset-view").addEventListener("click", () => window.ModelViewer.resetView());
    $$(".pose-btn").forEach(b => b.addEventListener("click", () => {
      window.ModelViewer.setPose(b.dataset.pose);
      $$(".pose-btn").forEach(x => x.classList.toggle("active", x === b));
    }));

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (!editorScreen().classList.contains("active")) return;
      const k = e.key.toLowerCase();
      if (k === "b") setTool("pencil");
      else if (k === "e") setTool("eraser");
      else if (k === "g") setTool("bucket");
      else if (k === "i") setTool("picker");
      else if (k === "l") setTool("line");
      else if (k === "m") $("#toggle-mirror").click();
      else if (k === "z" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (k === "y" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); redo(); }
    });

    // Resize listener for display canvas
    const wrap = $(".tex-canvas-wrap");
    if (wrap) new ResizeObserver(() => fitDisplay()).observe(wrap);

    bindCanvas();
  }

  // ---------------- init ----------------
  document.addEventListener("DOMContentLoaded", () => {
    wire();
    setTool("pencil");
    setColor(state.color);
    setBrushSize(1);
    // Render home + select previews early so they're warm
    renderModelGrid("all");
    renderHomeCatArt();
  });
})();
