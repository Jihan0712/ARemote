/**
 * capture.js — Composite canvas, photo & video capture
 * Exported class: CaptureController
 */

// ── Constants ────────────────────────────────────────────────────────────────

var MAX_DPR         = 2;
var RECORD_HOLD_MS  = 300;
var VIDEO_DRAIN_MS  = 600;
var VIDEO_STOP_MS   = 100;
var JPEG_QUALITY    = 0.92;
var VIDEO_FPS       = 30;

// ── Compositor ───────────────────────────────────────────────────────────────

function Compositor(facing) {
  this.facing   = facing;   // 'user' | 'environment'
  this.canvas   = null;
  this.ctx      = null;
  this._loopId  = null;
  this._glCanvas = null;
  this._video    = null;
  this._header   = null;
  this._headerLoaded = false;
}

Compositor.prototype._ensureCanvas = function () {
  if (this.canvas) return;

  var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  var w = window.innerWidth;
  var h = window.innerHeight;

  this.canvas = document.createElement('canvas');
  this.canvas.width  = Math.round(w * dpr);
  this.canvas.height = Math.round(h * dpr);
  this.ctx = this.canvas.getContext('2d');

  // Locate GL canvas (A-Frame renderer)
  this._glCanvas = document.querySelector('canvas.a-canvas') ||
                   document.querySelector('a-scene canvas') ||
                   document.querySelector('canvas');

  // Locate video element created by MindAR
  this._video = document.querySelector('video');
};

Compositor.prototype._loadHeader = function () {
  if (this._headerLoaded) return;
  this._headerLoaded = true;

  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = (function (self) {
    return function () { self._header = img; };
  })(this);
  img.src = 'assets/header.png';
};

Compositor.prototype.drawFrame = function () {
  this._ensureCanvas();
  this._loadHeader();

  var c = this.canvas;
  var ctx = this.ctx;
  var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  var cw = c.width;
  var ch = c.height;
  var vw = window.innerWidth;
  var vh = window.innerHeight;

  ctx.clearRect(0, 0, cw, ch);

  // ── Draw video (cover-crop) ────────────────────────────────────────────────
  if (this._video && this._video.readyState >= 2) {
    var vidW = this._video.videoWidth;
    var vidH = this._video.videoHeight;
    var scaleW = cw / vidW;
    var scaleH = ch / vidH;
    var scale = Math.max(scaleW, scaleH);
    var drawW = vidW * scale;
    var drawH = vidH * scale;
    var ox = (cw - drawW) / 2;
    var oy = (ch - drawH) / 2;

    ctx.save();
    if (this.facing === 'user') {
      // Front camera: mirror the video (selfie view)
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this._video, ox, oy, drawW, drawH);
    ctx.restore();
  }

  // ── Draw GL canvas (emotes) ────────────────────────────────────────────────
  if (this._glCanvas) {
    ctx.save();
    if (this.facing === 'environment') {
      // Back camera: flip GL to counteract container CSS scaleX(-1)
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this._glCanvas, 0, 0, cw, ch);
    ctx.restore();
  }

  // ── Draw header ───────────────────────────────────────────────────────────
  if (this._header) {
    var hAspect = this._header.naturalWidth / this._header.naturalHeight;
    var barH = 48; // logical px
    var hH = 24;   // logical image height
    var hW = hH * hAspect;
    var hTop = Math.max(12, (window.screen && window.screen.top) || 0) + (barH - hH) / 2;
    ctx.drawImage(this._header,
      Math.round((vw / 2 - hW / 2) * dpr),
      Math.round(hTop * dpr),
      Math.round(hW * dpr),
      Math.round(hH * dpr)
    );
  }
};

Compositor.prototype.startBgLoop = function () {
  if (this._loopId) return;
  var self = this;
  var loop = function () {
    self.drawFrame();
    self._loopId = requestAnimationFrame(loop);
  };
  self._loopId = requestAnimationFrame(loop);
};

Compositor.prototype.stopBgLoop = function () {
  if (this._loopId) {
    cancelAnimationFrame(this._loopId);
    this._loopId = null;
  }
};

// ── CaptureController ─────────────────────────────────────────────────────────

function CaptureController() {
  this.facing      = sessionStorage.getItem('cameraFacing') || 'user';
  this.compositor  = new Compositor(this.facing);
  this._recorder   = null;
  this._chunks     = [];
  this._recording  = false;
}

CaptureController.prototype.startBgLoop = function () {
  this.compositor.startBgLoop();
};

// ── Photo ──────────────────────────────────────────────────────────────────────

CaptureController.prototype.takePhoto = function () {
  var self = this;
  this.compositor.drawFrame();
  this.compositor.canvas.toBlob(
    function (blob) { self._download(blob, 'jpg'); },
    'image/jpeg',
    JPEG_QUALITY
  );
};

// ── Video ──────────────────────────────────────────────────────────────────────

CaptureController.prototype._getSupportedMimeType = function () {
  var types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (var i = 0; i < types.length; i++) {
    try { if (MediaRecorder.isTypeSupported(types[i])) return types[i]; }
    catch (e) {}
  }
  return '';
};

CaptureController.prototype.startRecording = function (onStart) {
  if (this._recording) return;
  if (typeof MediaRecorder === 'undefined') {
    alert('Video recording is not supported in this browser.');
    return;
  }

  var comp = this.compositor;
  comp.stopBgLoop();
  comp._ensureCanvas();

  var stream;
  try {
    stream = comp.canvas.captureStream
      ? comp.canvas.captureStream(VIDEO_FPS)
      : comp.canvas.mozCaptureStream(VIDEO_FPS);
  } catch (e) {
    alert('captureStream is not supported in this browser.');
    comp.startBgLoop();
    return;
  }

  var mimeType = this._getSupportedMimeType();
  var opts = mimeType ? { mimeType: mimeType } : {};
  var recorder;
  try {
    recorder = new MediaRecorder(stream, opts);
  } catch (e) {
    alert('MediaRecorder could not start: ' + e.message);
    comp.startBgLoop();
    return;
  }

  this._chunks   = [];
  this._recorder = recorder;
  this._recording = true;
  var self = this;

  recorder.ondataavailable = function (e) {
    if (e.data && e.data.size > 0) self._chunks.push(e.data);
  };

  recorder.start();

  // Drive the composite canvas while recording
  var loop = function () {
    if (self._recording) {
      comp.drawFrame();
      requestAnimationFrame(loop);
    }
  };
  requestAnimationFrame(loop);

  if (typeof onStart === 'function') onStart();
};

CaptureController.prototype.stopRecording = function (onStopped) {
  if (!this._recording || !this._recorder) return;
  this._recording = false;
  var self = this;
  var rec  = this._recorder;

  // Allow encoder to drain before stopping
  setTimeout(function () {
    try { rec.requestData(); } catch (e) {}
    setTimeout(function () {
      rec.onstop = function () {
        self.compositor.startBgLoop();
        var mimeType = rec.mimeType || 'video/webm';
        var ext = mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
        var blob = new Blob(self._chunks, { type: mimeType });
        self._download(blob, ext);
        self._chunks   = [];
        self._recorder = null;
        if (typeof onStopped === 'function') onStopped();
      };
      rec.stop();
    }, VIDEO_STOP_MS);
  }, VIDEO_DRAIN_MS);
};

// ── Download helper ─────────────────────────────────────────────────────────────

CaptureController.prototype._download = function (blob, ext) {
  var url = URL.createObjectURL(blob);
  var a   = document.createElement('a');
  a.href     = url;
  a.download = 'jollibeeAR-' + Date.now() + '.' + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
};

// ── Export ─────────────────────────────────────────────────────────────────────

export { CaptureController };
