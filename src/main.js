// ── Globals from MindAR CDN bundle ───────────────────────────────────────────
const { MindARThree } = window.MINDAR.FACE;
const { THREE } = window;

// ── Emote definitions ─────────────────────────────────────────────────────────
// Add or remove emotes here. Each needs an `emoji` char and a display `label`.
const EMOTES = [
  { emoji: "🐝", label: "Bee" },
  { emoji: "⭐", label: "Star" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "🎉", label: "Party" },
];

// ── State ─────────────────────────────────────────────────────────────────────
let emoteSprite = null;
let currentIndex = 0;
let mindarThree = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Draws an emoji onto a canvas and returns a Three.js CanvasTexture.
 * Using canvas text keeps things dependency-free and works on all platforms.
 */
function makeEmojiTexture(emoji) {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.font = `${SIZE * 0.78}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, SIZE / 2, SIZE / 2);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Swaps the emote sprite's texture to `EMOTES[index]`.
 * Disposes the old texture to avoid GPU memory leaks.
 */
function swapEmote(index) {
  currentIndex = index;
  const oldMap = emoteSprite.material.map;
  emoteSprite.material.map = makeEmojiTexture(EMOTES[index].emoji);
  emoteSprite.material.needsUpdate = true;
  if (oldMap) oldMap.dispose();

  // Update button highlight
  document.querySelectorAll(".emote-btn").forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}

/**
 * Captures the renderer's canvas + video composited onto a 2-D canvas,
 * then triggers a PNG download.
 */
function takeScreenshot() {
  // MindAR places the video and the WebGL canvas inside #container
  const video = document.querySelector("#container video");
  const glCanvas = document.querySelector("#container canvas");
  if (!video || !glCanvas) return;

  const out = document.createElement("canvas");
  out.width = glCanvas.width;
  out.height = glCanvas.height;
  const ctx = out.getContext("2d");

  // Draw video frame first, then the AR layer on top
  ctx.drawImage(video, 0, 0, out.width, out.height);
  ctx.drawImage(glCanvas, 0, 0);

  const link = document.createElement("a");
  link.download = `jollibee-ar-${Date.now()}.png`;
  link.href = out.toDataURL("image/png");
  link.click();
}

// ── Build emote selector UI ───────────────────────────────────────────────────
function buildUI() {
  const ui = document.getElementById("ui");
  EMOTES.forEach((emote, i) => {
    const btn = document.createElement("button");
    btn.className = "emote-btn" + (i === 0 ? " active" : "");
    btn.textContent = emote.emoji;
    btn.setAttribute("aria-label", emote.label);
    btn.addEventListener("click", () => swapEmote(i));
    ui.appendChild(btn);
  });

  document.getElementById("snap-btn").addEventListener("click", takeScreenshot);
}

// ── Main AR setup ─────────────────────────────────────────────────────────────
async function start() {
  mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    // Smoothing: lower filterMinCF = smoother but more latency
    filterMinCF: 0.001,
    filterBeta: 1000,
    // MindAR built-in loading overlay
    uiLoading: "yes",
    uiScanning: "no",
    uiError: "yes",
  });

  const { renderer, scene, camera } = mindarThree;

  // Ambient light — needed if you swap in .glb models later
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  // ── Emote sprite ──────────────────────────────────────────────────────────
  const material = new THREE.SpriteMaterial({
    map: makeEmojiTexture(EMOTES[currentIndex].emoji),
    transparent: true,
    depthTest: false,
  });
  emoteSprite = new THREE.Sprite(material);

  // Scale: 0.4 world-units wide — tune if emote looks too big/small
  emoteSprite.scale.set(0.4, 0.4, 0.4);

  // Vertical offset so the emote floats above the forehead point
  emoteSprite.position.set(0, 0.15, 0);

  // ── Face anchor ───────────────────────────────────────────────────────────
  // Landmark 1 is the forehead centre in MediaPipe's 468-point face mesh.
  const anchor = mindarThree.addAnchor(1);
  anchor.group.add(emoteSprite);

  // Show/hide emote when face enters/leaves frame
  anchor.onTargetFound = () => { emoteSprite.visible = true; };
  anchor.onTargetLost  = () => { emoteSprite.visible = false; };

  // ── Render loop ───────────────────────────────────────────────────────────
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  // Start camera + face detection
  await mindarThree.start();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
buildUI();
start().catch((err) => {
  console.error("MindAR failed to start:", err);
  alert("Could not start AR. Please allow camera access and use HTTPS.");
});
