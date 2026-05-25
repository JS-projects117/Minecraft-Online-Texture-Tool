// 3D model viewer. Renders any model defined in MODELS with the live texture canvas
// as its surface map. Supports player (multi-part with overlay) and block (single cube).
// Provides UV-aware raycasting so left-click paints onto the underlying texture.

(function () {
  let scene, camera, renderer, textureObj;
  let modelRoot, baseMeshes = [], overlayMeshes = [];
  let modelDef;                            // the active MODELS entry
  let canvasEl;
  let rot = { x: 0.15, y: 0.5 };
  let target = { x: 0.15, y: 0.5 };
  let zoom = 1;
  let autoRotate = true;
  let showOverlay = false;
  let showBase = true;
  let pose = "stand";
  let walkPhase = 0;
  let raycaster, ndc;
  let resizeObserver;

  /**
   * Map a face rect on the texture atlas to the 4 UV coordinates of a BoxGeometry face.
   * Three.js BoxGeometry vertex layout per face: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right.
   * Top and bottom faces have their "front" edge at a different vertex than side faces, so they
   * need a flipped v assignment relative to side faces. We also swap +X/-X (Three) → Minecraft's
   * left/right convention.
   */
  function setBoxFaceUVs(geometry, faces, atlasW, atlasH) {
    const uv = geometry.attributes.uv;
    // Three +X → Minecraft "left"; Three -X → Minecraft "right"
    const order = ["left", "right", "top", "bottom", "front", "back"];
    order.forEach((face, faceIdx) => {
      const rect = faces[face];
      if (!rect) return;
      const [x, y, w, h] = rect;
      const u0 = x / atlasW;
      const u1 = (x + w) / atlasW;
      const v0 = 1 - (y + h) / atlasH;
      const v1 = 1 - y / atlasH;
      let coords;
      if (face === "top" || face === "bottom") {
        coords = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      } else {
        coords = [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
      }
      coords.forEach(([u, v], i) => uv.setXY(faceIdx * 4 + i, u, v));
    });
    uv.needsUpdate = true;
  }

  function buildPart(part) {
    const [w, h, d] = part.size;
    const group = new THREE.Group();
    group.position.set(part.position[0], part.position[1], part.position[2]);
    group.userData.partName = part.name;
    group.userData.basePosition = [...part.position];

    // Base
    const baseGeo = new THREE.BoxGeometry(w, h, d);
    setBoxFaceUVs(baseGeo, part.faces, modelDef.textureWidth, modelDef.textureHeight);
    const baseMat = new THREE.MeshLambertMaterial({
      map: textureObj,
      transparent: false,
      side: THREE.FrontSide,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.userData.partName = part.name;
    baseMesh.userData.layer = "base";
    baseMeshes.push(baseMesh);
    group.add(baseMesh);

    // Overlay (optional, slightly inflated)
    if (part.overlay) {
      const s = part.overlayScale || 1.125;
      const overlayGeo = new THREE.BoxGeometry(w * s, h * s, d * s);
      setBoxFaceUVs(overlayGeo, part.overlay, modelDef.textureWidth, modelDef.textureHeight);
      const overlayMat = new THREE.MeshLambertMaterial({
        map: textureObj,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.01,
        depthWrite: false,
      });
      const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
      overlayMesh.userData.partName = part.name;
      overlayMesh.userData.layer = "overlay";
      overlayMesh.renderOrder = 1;
      overlayMeshes.push(overlayMesh);
      group.add(overlayMesh);
    }

    return group;
  }

  function build() {
    modelRoot = new THREE.Group();
    modelRoot.position.y = modelDef.cameraOffsetY;
    modelDef.parts.forEach((part) => modelRoot.add(buildPart(part)));
    scene.add(modelRoot);
  }

  function disposeModel() {
    if (modelRoot) {
      scene.remove(modelRoot);
      modelRoot.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }
    baseMeshes = [];
    overlayMeshes = [];
    modelRoot = null;
  }

  function setModel(newModelDef, textureCanvas) {
    disposeModel();
    modelDef = newModelDef;
    // Rebuild texture object (canvas may have different size now)
    if (textureObj) textureObj.dispose();
    textureObj = new THREE.CanvasTexture(textureCanvas);
    textureObj.magFilter = THREE.NearestFilter;
    textureObj.minFilter = THREE.NearestFilter;
    textureObj.generateMipmaps = false;
    textureObj.needsUpdate = true;
    window._textureObj = textureObj;
    build();
    // Reset view defaults
    rot = { x: 0.15, y: 0.5 };
    target = { x: 0.15, y: 0.5 };
    zoom = 1;
    autoRotate = true;
  }

  function init(canvas, textureCanvas, initialModelDef) {
    canvasEl = canvas;
    modelDef = initialModelDef;

    scene = new THREE.Scene();
    scene.background = null;

    textureObj = new THREE.CanvasTexture(textureCanvas);
    textureObj.magFilter = THREE.NearestFilter;
    textureObj.minFilter = THREE.NearestFilter;
    textureObj.generateMipmaps = false;
    textureObj.needsUpdate = true;
    window._textureObj = textureObj;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 400);
    camera.position.set(0, 0, modelDef.cameraDistance);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff0d6, 0.35);
    key.position.set(2, 3, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xff6a3d, 0.12);
    fill.position.set(-3, 1, -2); scene.add(fill);

    build();

    // -------- pointer handling --------
    raycaster = new THREE.Raycaster();
    ndc = new THREE.Vector2();
    let mode = null;
    let lastX = 0, lastY = 0;

    function pickTexel(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      // When the armor/overlay layer is visible, ALWAYS land paint strokes on
      // the overlay's texture coords — even if that texel is currently
      // transparent. This lets the user "build up" the armor by painting onto
      // an empty hat / jacket / leggings region. When overlay is hidden, paint
      // the base layer directly.
      const candidates = (showBase ? baseMeshes : []).concat(showOverlay ? overlayMeshes : []);
      const hits = raycaster.intersectObjects(candidates, false);
      if (!hits.length) return null;
      // Prefer an overlay hit if overlay is visible; otherwise take the first hit.
      let hit;
      if (showOverlay) {
        hit = hits.find(h => h.object.userData.layer === "overlay") || hits[0];
      } else {
        hit = hits[0];
      }
      const uv = hit.uv;
      if (!uv) return null;
      const tx = Math.floor(uv.x * modelDef.textureWidth);
      const ty = Math.floor((1 - uv.y) * modelDef.textureHeight);
      if (tx < 0 || ty < 0 || tx >= modelDef.textureWidth || ty >= modelDef.textureHeight) return null;
      return { x: tx, y: ty };
    }

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      lastX = e.clientX; lastY = e.clientY;
      if (e.button === 1) {
        mode = "orbit"; autoRotate = false; canvas.classList.add("orbiting");
      } else if (e.button === 0) {
        if (window.PaintAPI && window.PaintAPI.isToolPaintable()) {
          const p = pickTexel(e.clientX, e.clientY);
          if (p) {
            mode = "paint"; autoRotate = false;
            window.PaintAPI.begin();
            window.PaintAPI.stroke(p);
          } else {
            mode = "orbit"; autoRotate = false; canvas.classList.add("orbiting");
          }
        } else {
          mode = "orbit"; autoRotate = false; canvas.classList.add("orbiting");
        }
      } else if (e.button === 2) {
        mode = "orbit"; autoRotate = false; canvas.classList.add("orbiting");
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (mode === "orbit") {
        target.y += (e.clientX - lastX) * 0.01;
        target.x = Math.max(-1.1, Math.min(1.1, target.x + (e.clientY - lastY) * 0.01));
        lastX = e.clientX; lastY = e.clientY;
      } else if (mode === "paint") {
        const p = pickTexel(e.clientX, e.clientY);
        if (p) window.PaintAPI.stroke(p);
      }
    });
    const stop = (e) => {
      if (mode === "paint" && window.PaintAPI) window.PaintAPI.end();
      mode = null;
      canvas.classList.remove("orbiting");
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerleave", stop);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom = Math.max(0.5, Math.min(2.5, zoom * (1 - e.deltaY * 0.001)));
    }, { passive: false });

    // Resize observer
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(canvas);

    animate();
  }

  function setPose(p) { pose = p; if (p !== "walk") walkPhase = 0; }

  function applyPose() {
    if (!modelRoot || modelDef.id !== "player") return;
    const find = (name) => modelRoot.children.find(g => g.userData.partName === name);
    const reset = (g) => { g.rotation.set(0, 0, 0); g.position.set(...g.userData.basePosition); };

    const rArm = find("rightArm"), lArm = find("leftArm");
    const rLeg = find("rightLeg"), lLeg = find("leftLeg");
    if (!rArm) return;

    [rArm, lArm, rLeg, lLeg].forEach(reset);

    function rotateFromTop(grp, baseY, halfH, angleX, angleZ = 0) {
      grp.rotation.set(angleX, 0, angleZ);
      const top = new THREE.Vector3(0, halfH, 0).applyEuler(grp.rotation);
      grp.position.y = baseY + halfH - top.y;
      grp.position.x = grp.userData.basePosition[0] - top.x;
      grp.position.z = -top.z;
    }

    if (pose === "tpose") {
      rArm.rotation.z = Math.PI / 2;
      lArm.rotation.z = -Math.PI / 2;
      const halfH = 6;
      const topR = new THREE.Vector3(0, halfH, 0).applyEuler(rArm.rotation);
      rArm.position.set(rArm.userData.basePosition[0] - topR.x, rArm.userData.basePosition[1] + halfH - topR.y, -topR.z);
      const topL = new THREE.Vector3(0, halfH, 0).applyEuler(lArm.rotation);
      lArm.position.set(lArm.userData.basePosition[0] - topL.x, lArm.userData.basePosition[1] + halfH - topL.y, -topL.z);
    } else if (pose === "walk") {
      walkPhase += 0.06;
      const s = Math.sin(walkPhase) * 0.6;
      rotateFromTop(rArm, rArm.userData.basePosition[1], 6, -s);
      rotateFromTop(lArm, lArm.userData.basePosition[1], 6,  s);
      rotateFromTop(rLeg, rLeg.userData.basePosition[1], 6,  s);
      rotateFromTop(lLeg, lLeg.userData.basePosition[1], 6, -s);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    rot.x += (target.x - rot.x) * 0.15;
    rot.y += (target.y - rot.y) * 0.15;
    if (autoRotate) target.y += 0.004;
    if (modelRoot) {
      modelRoot.rotation.x = rot.x;
      modelRoot.rotation.y = rot.y;
    }
    camera.position.z = modelDef.cameraDistance / zoom;
    applyPose();
    if (textureObj) textureObj.needsUpdate = true;
    overlayMeshes.forEach((m) => m.visible = showOverlay);
    baseMeshes.forEach((m) => m.visible = showBase);
    renderer.render(scene, camera);
  }

  /**
   * One-shot offscreen render of a model with a given texture. Used for select-screen
   * thumbnails. Doesn't touch the main scene.
   */
  function snapshotThumbnail(modelDefArg, textureCanvas, width = 256) {
    const off = document.createElement("canvas");
    off.width = width; off.height = width;
    const tex = new THREE.CanvasTexture(textureCanvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;

    const tScene = new THREE.Scene();
    const tCam = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    tCam.position.set(0, 0, modelDefArg.cameraDistance);
    tScene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const k = new THREE.DirectionalLight(0xfff0d6, 0.3); k.position.set(2,3,4); tScene.add(k);

    const root = new THREE.Group();
    root.position.y = modelDefArg.cameraOffsetY;
    root.rotation.set(0.18, -0.5, 0);
    modelDefArg.parts.forEach((part) => {
      const [w, h, d] = part.size;
      const g = new THREE.Group();
      g.position.set(...part.position);
      const baseGeo = new THREE.BoxGeometry(w, h, d);
      setBoxFaceUVs(baseGeo, part.faces, modelDefArg.textureWidth, modelDefArg.textureHeight);
      g.add(new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ map: tex })));
      if (part.overlay) {
        const s = part.overlayScale || 1.125;
        const og = new THREE.BoxGeometry(w*s, h*s, d*s);
        setBoxFaceUVs(og, part.overlay, modelDefArg.textureWidth, modelDefArg.textureHeight);
        g.add(new THREE.Mesh(og, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.01, depthWrite: false })));
      }
      root.add(g);
    });
    tScene.add(root);

    const tRenderer = new THREE.WebGLRenderer({ canvas: off, antialias: false, alpha: true });
    tRenderer.setSize(width, width, false);
    tRenderer.render(tScene, tCam);
    tRenderer.dispose();
    return off;
  }

  /**
   * Continuous spinning render of a model — for gallery cards. Drives a small
   * three.js scene that renders into its own canvas every frame. Returns
   * { canvas, dispose } so the caller can drop it into the DOM and stop the
   * animation when the card unmounts.
   */
  function spinningThumbnail(modelDefArg, textureCanvas, size = 256) {
    const off = document.createElement("canvas");
    off.width = size; off.height = size;
    const tex = new THREE.CanvasTexture(textureCanvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;

    const tScene = new THREE.Scene();
    const tCam = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    tCam.position.set(0, 0, modelDefArg.cameraDistance);
    tScene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const k = new THREE.DirectionalLight(0xfff0d6, 0.3); k.position.set(2, 3, 4); tScene.add(k);

    const root = new THREE.Group();
    root.position.y = modelDefArg.cameraOffsetY;
    modelDefArg.parts.forEach((part) => {
      const [w, h, d] = part.size;
      const g = new THREE.Group();
      g.position.set(...part.position);
      const baseGeo = new THREE.BoxGeometry(w, h, d);
      setBoxFaceUVs(baseGeo, part.faces, modelDefArg.textureWidth, modelDefArg.textureHeight);
      g.add(new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ map: tex })));
      if (part.overlay) {
        const s = part.overlayScale || 1.125;
        const og = new THREE.BoxGeometry(w * s, h * s, d * s);
        setBoxFaceUVs(og, part.overlay, modelDefArg.textureWidth, modelDefArg.textureHeight);
        g.add(new THREE.Mesh(og, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.01, depthWrite: false })));
      }
      root.add(g);
    });
    tScene.add(root);

    const tRenderer = new THREE.WebGLRenderer({ canvas: off, antialias: false, alpha: true });
    tRenderer.setSize(size, size, false);

    let rafId = null;
    let running = true;
    let angle = Math.random() * Math.PI * 2; // randomize start so different cards don't sync
    function tick() {
      if (!running) return;
      angle += 0.012;
      root.rotation.y = angle;
      root.rotation.x = 0.18;
      tRenderer.render(tScene, tCam);
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return {
      canvas: off,
      dispose() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        tRenderer.dispose();
        tex.dispose();
        root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      },
    };
  }

  window.ModelViewer = {
    init,
    setModel,
    setOverlay(on) { showOverlay = on; },
    setBase(on) { showBase = on; },
    setPartVisible(name, on) {
      if (!modelRoot) return;
      const g = modelRoot.children.find(c => c.userData.partName === name);
      if (g) g.visible = on;
    },
    setAutoRotate(on) { autoRotate = on; },
    isAutoRotate() { return autoRotate; },
    resetView() { target = { x: 0.15, y: 0.5 }; zoom = 1; },
    setPose,
    getPose() { return pose; },
    invalidateTexture() { if (textureObj) textureObj.needsUpdate = true; },
    snapshotThumbnail,
    spinningThumbnail,
    getModelDef() { return modelDef; },
    _debug() { return { scene, camera, modelRoot, baseMeshes, overlayMeshes, modelDef }; },
  };
})();
