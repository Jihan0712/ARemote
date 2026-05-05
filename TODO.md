# JollibeeAR – WebAR Face Emote Project

> Three.js + MindAR face tracking that detects your face and renders an emote on your forehead.

---

## 1. Project Setup & Dependencies
- [ ] Initialize project with Vite scaffold
- [ ] Install **Three.js** and **MindAR** — MindAR bundles its own face-mesh model
  ```
  npm create vite@latest jollibee-ar -- --template vanilla
  npm install three mind-ar
  ```
- [ ] Or use MindAR CDN (no bundler needed for quick prototyping):
  ```html
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-three.prod.js"></script>
  ```
- [ ] Set up folder structure:
  ```
  /src
    index.html
    main.js
    style.css
  /assets
    /emotes        ← emote sprites or .glb models
  ```

---

## 2. Camera & Webcam Access
- [ ] MindAR handles `getUserMedia` internally — no manual camera setup needed
- [ ] Pass UI options to `MindARThree` constructor to show built-in loading UI:
  ```js
  new window.MINDAR.FACE.MindARThree({ container: document.body, uiLoading: "yes", uiError: "yes" })
  ```
- [ ] Handle permission denied / no camera via MindAR error events

---

## 3. Face Landmark Detection (MindAR)
- [ ] Create `MindARThree` instance and call `mindarThree.start()` — loads face-mesh model automatically
  ```js
  const mindarThree = new window.MINDAR.FACE.MindARThree({ container: document.body });
  const { renderer, scene, camera } = mindarThree;
  await mindarThree.start();
  ```
- [ ] Add a face anchor for landmark index `1` (forehead center; MindAR exposes 468 MediaPipe-compatible landmarks)
  ```js
  const anchor = mindarThree.addAnchor(1);
  ```
- [ ] MindAR runs the detection loop internally — attach objects to `anchor.group` instead of a manual RAF
- [ ] Reference landmark map: https://github.com/tensorflow/tfjs-models/blob/master/face-landmarks-detection/mesh_map.jpg

---

## 4. Three.js Scene & AR Overlay
- [ ] `MindARThree` auto-creates `scene`, `camera`, and `renderer` — destructure them directly (no manual setup)
- [ ] MindAR handles canvas overlay and video background automatically
- [ ] Add lights if using 3D `.glb` emotes: `scene.add(new THREE.AmbientLight(0xffffff, 1))`
- [ ] Drive the render loop via MindAR's animation loop:
  ```js
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  ```

---

## 5. Forehead Anchor Positioning (MindAR handles mapping)
- [ ] MindAR anchor index **`1`** maps to the forehead center — no manual coordinate math needed
- [ ] Attach the emote mesh directly to `anchor.group`; MindAR updates its transform every frame
- [ ] Fine-tune vertical position with a local offset: `emote.position.set(0, 0.15, 0)`
- [ ] Scale emote to fit forehead: `emote.scale.set(0.5, 0.5, 0.5)` (tune to taste)

---

## 6. Emote Asset Creation / Loading
- [ ] Design or source emote sprites (PNG with transparency) — e.g., 😂 🔥 💀 ❤️ stars
- [ ] Option A (simple): use `THREE.Sprite` with `SpriteMaterial` + canvas texture
- [ ] Option B (fancy): use `.glb` 3D models loaded with `GLTFLoader` for animated emotes
- [ ] Add a default "Jollibee bee" emote asset

---

## 7. Attach Emote to Forehead
- [ ] Add emote mesh/sprite to `anchor.group` so it auto-tracks the forehead:
  ```js
  anchor.group.add(emote);
  ```
- [ ] Sprites auto-face the camera; for `.glb` meshes call `emote.lookAt(camera.position)` in the loop
- [ ] Show/hide emote using `anchor.onTargetFound` / `anchor.onTargetLost` events

---

## 8. Tracking Smoothing & Stability
- [ ] MindAR has built-in smoothing — tune `filterMinCF` and `filterBeta` in the constructor if jittery:
  ```js
  new window.MINDAR.FACE.MindARThree({ filterMinCF: 0.001, filterBeta: 1000 })
  ```
- [ ] Handle no-face frames via `anchor.onTargetLost` (hide emote) and `anchor.onTargetFound` (show emote)
- [ ] Handle rapid head rotation without emote flying off screen

---

## 9. Emote Selector UI
- [ ] Build a bottom-bar UI with emote thumbnail buttons
- [ ] Clicking a button swaps the active emote on the forehead
- [ ] Highlight the currently selected emote
- [ ] Add a "take screenshot / share" button (canvas snapshot → download)

---

## 10. Mobile & Performance Testing
- [ ] Test on iOS Safari (requires HTTPS + `playsInline` on video — MindAR sets this automatically)
- [ ] Test on Android Chrome
- [ ] Target ≥ 30 FPS — profile with DevTools if below
- [ ] Use PNG sprites instead of `.glb` if performance is poor on low-end devices
- [ ] Lazy-load emote assets to reduce initial load time

---

## 11. HTTPS Deployment
- [ ] Camera API requires HTTPS — use Vite dev server (`--https`) for local testing
- [ ] Deploy to **Netlify** or **GitHub Pages** (both provide free HTTPS)
- [ ] MindAR CDN build includes all WASM — no special MIME config needed
- [ ] Set `Cross-Origin-Opener-Policy: same-origin` header if SharedArrayBuffer warnings appear

---

## Tech Stack Summary

| Layer | Library |
|---|---|
| 3D / AR render | Three.js |
| Face tracking | MindAR (`mind-ar` face mode) |
| Bundler | Vite (or CDN script tag) |
| Assets | PNG sprites or `.glb` (GLTF) |
| Hosting | Netlify / GitHub Pages (HTTPS) |
