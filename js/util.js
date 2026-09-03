/* Crazee-quarium :: util.js - math, colour, formatting and storage helpers. */
(function () {
  'use strict';
  var CQ = window.CQ || (window.CQ = {});

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.random() * (b - a);
  }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function sign(v) { return v < 0 ? -1 : 1; }

  function dist2(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
  function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }

  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t) { return t * t * t; }
  function easeOutElastic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var c = TAU / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* Move `cur` toward `target` at `rate` units/second without overshoot. */
  function approach(cur, target, rate, dt) {
    var d = target - cur, step = rate * dt;
    if (Math.abs(d) <= step) return target;
    return cur + sign(d) * step;
  }

  /* Deterministic small PRNG so decor stays put between frames. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmtMoney(n) {
    n = Math.floor(n);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-$' : '$') + s;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---- colour ---- */
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    function h(v) { v = clamp(Math.round(v), 0, 255).toString(16); return v.length < 2 ? '0' + v : v; }
    return '#' + h(r) + h(g) + h(b);
  }
  /* amt > 0 lightens toward white, amt < 0 darkens toward black. */
  function shade(hex, amt) {
    var c = hexToRgb(hex), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return rgbToHex(c.r + (t - c.r) * p, c.g + (t - c.g) * p, c.b + (t - c.b) * p);
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function mixColor(a, b, t) {
    var c1 = hexToRgb(a), c2 = hexToRgb(b);
    return rgbToHex(lerp(c1.r, c2.r, t), lerp(c1.g, c2.g, t), lerp(c1.b, c2.b, t));
  }

  /* ---- canvas path helpers ---- */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function starPath(ctx, x, y, points, outer, inner, rot) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 ? inner : outer;
      var a = (i / (points * 2)) * TAU + (rot || 0) - Math.PI / 2;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function polyPath(ctx, pts) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
  }
  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /* ---- storage ---- */
  var storage = {
    available: (function () {
      try {
        var k = '__cq_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    })(),
    load: function (key, fallback) {
      if (!storage.available) return fallback;
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    save: function (key, value) {
      if (!storage.available) return false;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) { return false; }
    },
    remove: function (key) {
      if (!storage.available) return;
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  CQ.util = {
    TAU: TAU,
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, pick: pick, chance: chance, sign: sign,
    dist: dist, dist2: dist2,
    smoothstep: smoothstep, easeOutCubic: easeOutCubic, easeInCubic: easeInCubic,
    easeOutElastic: easeOutElastic, easeOutBack: easeOutBack, easeInOutQuad: easeInOutQuad,
    approach: approach, mulberry32: mulberry32,
    fmtMoney: fmtMoney, fmtTime: fmtTime,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, shade: shade, rgba: rgba, mixColor: mixColor,
    roundRect: roundRect, starPath: starPath, polyPath: polyPath, pointInRect: pointInRect
  };
  CQ.storage = storage;
})();
