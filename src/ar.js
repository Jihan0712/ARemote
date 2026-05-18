/**
 * ar.js — MindAR / A-Frame component
 * Registers the "emote-switcher" A-Frame component.
 * Dispatches a custom "arReady" event on document when face tracking is live.
 */

// ── Constants ────────────────────────────────────────────────────────────────

var SMILE_THRESHOLD   = 0.08;  // cornersUp ratio to trigger smile
var MOUTH_THRESHOLD   = 0.12;  // mouthOpen ratio to trigger smile
var SMILE_ON_FRAMES   = 4;     // frames required to confirm smile
var SMILE_OFF_STEP    = 2;     // frames removed per non-smile frame
var SMILE_MAX_FRAMES  = 10;    // frame counter cap
var POP_DURATION_MS   = 500;   // emote pop-in animation duration (ms)
var POP_SCALE_PEAK    = 1.35;  // peak scale during pop animation
var POP_PEAK_T        = 0.55;  // normalised time at which peak is reached
var HIDE_NOFACE_DELAY = 1000;  // ms delay before hiding no-face overlay
var EMOTE_SWITCH_MS   = 1000;  // ms between bee/jolli alternation

// ── EmoteSwitcher ─────────────────────────────────────────────────────────────

function EmoteSwitcher() {
  this._showBee     = true;
  this._popElapsed  = -1;  // -1 = idle, >=0 = animating
  this._wasSmiling  = false;
  this._smileFrames = 0;
  this._ready       = false;
  this._hideTimer   = null;

  // Cached DOM refs (populated on first tick)
  this._noFace = null;
  this._faceGuide = null;
  this._bee    = null;
  this._jolli  = null;
  this._anchor = null;
  this._lm61   = null;
  this._lm291  = null;
  this._lm13   = null;
  this._lm14   = null;

  var self = this;
  setInterval(function () { self._showBee = !self._showBee; }, EMOTE_SWITCH_MS);
}

EmoteSwitcher.prototype._cacheRefs = function () {
  this._noFace    = document.getElementById('no-face');
  this._faceGuide = document.getElementById('face-guide');
  this._bee    = document.getElementById('bee-img');
  this._jolli  = document.getElementById('jolli-img');
  this._anchor = document.getElementById('anchor-168');
  this._lm61   = document.getElementById('lm-61');
  this._lm291  = document.getElementById('lm-291');
  this._lm13   = document.getElementById('lm-13');
  this._lm14   = document.getElementById('lm-14');
  return !!(this._bee && this._lm61 && this._anchor);
};

EmoteSwitcher.prototype._onFaceLost = function () {
  if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
  this._noFace.style.display = 'flex';
  if (this._faceGuide) this._faceGuide.style.display = 'flex';
  this._bee.object3D.visible   = false;
  this._jolli.object3D.visible = false;
  this._smileFrames = 0;
  this._popElapsed  = -1;
  this._wasSmiling  = false;
};

EmoteSwitcher.prototype._onFaceFound = function () {
  if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
};

EmoteSwitcher.prototype._detectSmile = function () {
  var e61  = this._lm61.object3D.matrix.elements;
  var e291 = this._lm291.object3D.matrix.elements;
  var e13  = this._lm13.object3D.matrix.elements;
  var e14  = this._lm14.object3D.matrix.elements;

  var faceWidth = Math.abs(e61[12] - e291[12]);
  if (faceWidth === 0) return false;

  var cornersUp = ((e61[13] + e291[13]) / 2 - e13[13]) / faceWidth > SMILE_THRESHOLD;
  var mouthOpen = (e13[13] - e14[13]) / faceWidth > MOUTH_THRESHOLD;
  return cornersUp || mouthOpen;
};

EmoteSwitcher.prototype._updateEmotes = function (smiling, timeDelta) {
  if (smiling) {
    this._bee.object3D.visible   = this._showBee;
    this._jolli.object3D.visible = !this._showBee;

    if (this._popElapsed >= 0 && this._popElapsed < POP_DURATION_MS) {
      var t = this._popElapsed / POP_DURATION_MS;
      var s = t < POP_PEAK_T
        ? (t / POP_PEAK_T) * POP_SCALE_PEAK
        : POP_SCALE_PEAK - ((t - POP_PEAK_T) / (1 - POP_PEAK_T)) * (POP_SCALE_PEAK - 1);
      this._bee.object3D.scale.set(s, s, s);
      this._jolli.object3D.scale.set(s, s, s);
      this._popElapsed += timeDelta;
    } else if (this._popElapsed >= POP_DURATION_MS) {
      this._bee.object3D.scale.set(1, 1, 1);
      this._jolli.object3D.scale.set(1, 1, 1);
      this._popElapsed = -1;
    }
  } else {
    this._bee.object3D.visible   = false;
    this._jolli.object3D.visible = false;
    this._bee.object3D.scale.set(1, 1, 1);
    this._jolli.object3D.scale.set(1, 1, 1);
    this._popElapsed = -1;
  }
};

EmoteSwitcher.prototype.tick = function (time, timeDelta) {
  if (!this._ready) {
    if (!this._cacheRefs()) return;
    this._ready = true;
  }

  if (!this._anchor.object3D.visible) {
    this._onFaceLost();
    return;
  }

  this._onFaceFound();

  // Face visible: hide guide immediately
  if (this._faceGuide) this._faceGuide.style.display = 'none';

  var smileDetected = this._detectSmile();

  if (smileDetected) { this._smileFrames = Math.min(this._smileFrames + 1, SMILE_MAX_FRAMES); }
  else               { this._smileFrames = Math.max(this._smileFrames - SMILE_OFF_STEP, 0); }

  var smiling = this._smileFrames >= SMILE_ON_FRAMES;
  if (smiling && !this._wasSmiling) { this._popElapsed = 0; }
  this._wasSmiling = smiling;

  // Smile prompt: visible while face is found but not yet smiling
  this._noFace.style.display = smiling ? 'none' : 'flex';

  this._updateEmotes(smiling, timeDelta);
};

// ── Back-camera emote swap ─────────────────────────────────────────────────────

function swapToBackEmotes() {
  var bee   = document.getElementById('bee-img');
  var jolli = document.getElementById('jolli-img');
  if (bee)   bee.setAttribute('src', '#back-bee-tex');
  if (jolli) jolli.setAttribute('src', '#back-jolli-tex');
}

// ── A-Frame component registration ────────────────────────────────────────────

var _switcher = new EmoteSwitcher();

AFRAME.registerComponent('emote-switcher', {
  init: function () {
    var self = this;
    var currentFacing = sessionStorage.getItem('cameraFacing') || 'user';

    this.el.sceneEl.addEventListener('arReady', function () {
      // Notify capture module that AR is live
      document.dispatchEvent(new CustomEvent('ar-ready'));

      if (currentFacing === 'environment') {
        swapToBackEmotes();
      }
    });
  },

  tick: function (time, timeDelta) {
    _switcher.tick(time, timeDelta);
  }
});
