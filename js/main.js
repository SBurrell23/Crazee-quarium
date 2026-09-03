/* Crazee-quarium :: main.js - canvas setup, input, the frame loop. */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util, art = CQ.art, ui = CQ.ui, audio = CQ.audio;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  var dpr = 1, W = 0, H = 0;
  var game = null;
  var last = 0;
  var pendingDown = false, pendingUp = false;
  var pointer = { x: -1, y: -1, down: false, justDown: false, justUp: false };
  var cursors = null;
  var cursorKey = '';

  /* The canvas is styled to fill the viewport, so its own box is the most
   * reliable size - it stays correct inside an iframe and when the window
   * reports nothing useful (minimised, hidden, mid-orientation-change). */
  function viewport() {
    var r = canvas.getBoundingClientRect();
    var vw = Math.round(r.width) || canvas.clientWidth || window.innerWidth ||
      (document.documentElement && document.documentElement.clientWidth) || 0;
    var vh = Math.round(r.height) || canvas.clientHeight || window.innerHeight ||
      (document.documentElement && document.documentElement.clientHeight) || 0;
    return { w: vw, h: vh };
  }

  function resize() {
    var v = viewport();
    var nw = v.w, nh = v.h;
    if (nw < 240 || nh < 240) {
      /* Nothing useful to measure yet. Keep what we have; the observer will
       * call back once the element actually has a box. */
      if (W >= 240 && H >= 240) return;
      nw = 960; nh = 600;
    }
    var ndpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nw === W && nh === H && ndpr === dpr) return;
    W = nw; H = nh; dpr = ndpr;
    /* Only the backing store is sized here - the stylesheet owns the element
     * box (100vw/100vh), so an inline size can never pin it to a bad guess. */
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (game) game.resize(W, H);
  }

  function setPos(e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  }

  function onDown(e) {
    setPos(e);
    pointer.down = true;
    pendingDown = true;
    audio.unlock();
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    e.preventDefault();
  }
  function onMove(e) { setPos(e); }
  function onUp(e) {
    setPos(e);
    pointer.down = false;
    pendingUp = true;
  }

  canvas.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { pointer.down = false; });

  window.addEventListener('keydown', function (e) {
    audio.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (game) game.key(e.code);
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { window.setTimeout(resize, 120); });
  /* Catches layout changes the window event misses (iframes, pane reveals). */
  if (window.ResizeObserver) {
    try { new window.ResizeObserver(resize).observe(canvas); } catch (e) { /* ignore */ }
  }

  /* A tab icon drawn with the same code that draws the fish. */
  function makeFavicon() {
    try {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var cc = c.getContext('2d');
      var g = cc.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, '#4fc3e8');
      g.addColorStop(1, '#0a4f78');
      cc.fillStyle = g;
      cc.fillRect(0, 0, 64, 64);
      art.drawFish(cc, {
        x: 32, y: 34, s: 58, dir: 1, phase: 0.8,
        c1: '#ffb03a', c2: '#ff7a4d', shape: 'guppy', mood: 'ok', pattern: 'stripes', seed: 5
      });
      var link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = c.toDataURL('image/png');
      document.head.appendChild(link);
    } catch (e) { /* not important enough to break the boot */ }
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    pointer.justDown = pendingDown;
    pointer.justUp = pendingUp;
    pendingDown = false;
    pendingUp = false;

    ui.begin(pointer, dt);
    game.update(dt);
    game.draw(ctx);

    /* one-time nudge: browsers will not start audio before a gesture.
     * Sits above the shop bar in-game so it never covers a button. */
    if (!audio.isUnlocked() && !ui.infoOpen && !ui.settingsOpen && !game.confirm) {
      var inGame = game.screen === 'game';
      var hintY = inGame ? H - game.metrics().shopH - 34 : 22;
      var label = 'click anywhere to turn on sound';
      var hw = art.measure(ctx, label, 13, 'normal') + 26;
      var hintX = inGame ? W / 2 : 14 + hw / 2;
      art.panel(ctx, hintX - hw / 2, hintY - 13, hw, 26, {
        radius: 13, top: 'rgba(6,38,58,0.85)', bottom: 'rgba(3,20,34,0.9)', gloss: false, shadow: false
      });
      art.text(ctx, label, hintX, hintY, {
        size: 13, fill: 'rgba(223,241,255,0.9)', weight: 'normal'
      });
    }
    ui.end();

    updateCursor();

    window.requestAnimationFrame(frame);
  }

  /* The pointer art tells you what a click will do: a pinching hand over open
   * water, a pointing hand over a coin, a reticle over anything shootable. */
  function updateCursor() {
    var key = 'default';
    if (ui.cursor === 'pointer') {
      key = 'pointer';
    } else if (game.screen === 'game' && game.level && !game.paused &&
               !ui.settingsOpen && !game.confirm) {
      var kind = game.level.hoverKind(pointer.x, pointer.y);
      if (kind === 'target') key = 'target';
      else if (kind === 'coin') key = 'hand';
      else if (kind === 'feed') key = 'feed';
    }
    if (key === cursorKey) return;
    cursorKey = key;
    var css = 'default';
    if (key === 'pointer') css = 'pointer';
    else if (cursors && cursors[key]) css = cursors[key];
    canvas.style.cursor = css;
  }

  function boot() {
    audio.boot();
    cursors = art.makeCursors();
    resize();
    game = new CQ.Game(canvas, ctx);
    game.pointer = pointer;
    game.resize(W, H);
    CQ.dev.game = game;
    CQ.dev.cursor = function () { updateCursor(); return cursorKey; };
    window.game = game;
    audio.music('loop');
    makeFavicon();
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
