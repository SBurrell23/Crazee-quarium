/* Crazee-quarium :: art.js
 * All graphics are generated on the canvas: no image files, no emoji, no fonts beyond system text.
 * Creatures are drawn in a unit space (body length 1.0, centred on the origin, facing +x)
 * so callers only supply a pixel size and a facing direction.
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util;
  var TAU = util.TAU, clamp = util.clamp, lerp = util.lerp, shade = util.shade, rgba = util.rgba;

  var FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function fillCircle(ctx, x, y, r, color) { ctx.fillStyle = color; circle(ctx, x, y, r); ctx.fill(); }
  function ellipse(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); }

  /* ------------------------------------------------------------------ text */
  function text(ctx, str, x, y, o) {
    o = o || {};
    var size = o.size || 16;
    ctx.save();
    ctx.font = (o.italic ? 'italic ' : '') + (o.weight || 'bold') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.shadow) {
      ctx.shadowColor = o.shadow;
      ctx.shadowBlur = o.shadowBlur || size * 0.5;
      ctx.shadowOffsetY = o.shadowY || 0;
    }
    if (o.strokeW) {
      ctx.lineWidth = o.strokeW;
      ctx.strokeStyle = o.stroke || '#04202f';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.fill || '#ffffff';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function measure(ctx, str, size, weight) {
    ctx.save();
    ctx.font = (weight || 'bold') + ' ' + (size || 16) + 'px ' + FONT;
    var w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  /* --------------------------------------------------------------- themes */
  var themes = [
    { name: 'Coral Cove',    water: ['#4fc3e8', '#0a4f78'], deep: '#05304c', sand: '#e6d5a4', sandDark: '#b9a271', plant: ['#48b356', '#237a3c'], rock: '#3d5a6c', light: '#cdf3ff', accent: '#ffd36b' },
    { name: 'Starlit Shelf', water: ['#5b9be0', '#16306f'], deep: '#0d1c46', sand: '#cdd8ec', sandDark: '#96a2bd', plant: ['#84d2ea', '#3f7fa8'], rock: '#2c3855', light: '#e6efff', accent: '#ffe89a' },
    { name: 'Beetle Trench', water: ['#3aa791', '#06463a'], deep: '#032b25', sand: '#c3af80', sandDark: '#8f7d55', plant: ['#9cc954', '#5f8f30'], rock: '#31423b', light: '#ccffed', accent: '#f7e06a' },
    { name: 'The Abyss',     water: ['#4b3d95', '#0b0725'], deep: '#070420', sand: '#635a78', sandDark: '#3f3850', plant: ['#a86ad6', '#5f2f92'], rock: '#241f38', light: '#ddccff', accent: '#8ff0ff' },
    { name: 'The Maw',       water: ['#8a2b3c', '#1b0409'], deep: '#140206', sand: '#6b4340', sandDark: '#452a29', plant: ['#d4523d', '#7d2418'], rock: '#31191b', light: '#ffc0b4', accent: '#ffd166' }
  ];

  /* ------------------------------------------------------- background art */

  /* floorYOpt lets a level lift the sea floor clear of its shop bar. */
  function makeDecor(W, H, themeIndex, floorYOpt) {
    var th = themes[clamp(themeIndex, 0, themes.length - 1)];
    var rnd = util.mulberry32(1337 + themeIndex * 977);
    var floorY = floorYOpt === undefined ? H - clamp(H * 0.13, 56, 150) : floorYOpt;
    var floorH = H - floorY;

    var decor = { W: W, H: H, theme: th, themeIndex: themeIndex, floorY: floorY, floorH: floorH, plants: [], bubbles: [], shafts: [] };

    var plantCount = Math.max(6, Math.round(W / 150));
    for (var i = 0; i < plantCount; i++) {
      var tall = rnd();
      decor.plants.push({
        x: (i + 0.35 + rnd() * 0.3) * (W / plantCount),
        h: lerp(H * 0.10, H * 0.30, tall * tall),
        w: lerp(4, 12, rnd()),
        blades: 3 + Math.floor(rnd() * 4),
        phase: rnd() * TAU,
        speed: lerp(0.5, 1.1, rnd()),
        hue: rnd(),
        kind: rnd() < 0.25 ? 'fan' : 'kelp'
      });
    }
    for (var b = 0; b < 34; b++) {
      decor.bubbles.push({ x: rnd() * W, r: lerp(1.5, 5, rnd()), sp: lerp(14, 42, rnd()), ph: rnd() * TAU, off: rnd() });
    }
    for (var s = 0; s < 5; s++) {
      decor.shafts.push({ x: rnd() * W, w: lerp(W * 0.05, W * 0.16, rnd()), ph: rnd() * TAU, sk: lerp(-0.35, 0.35, rnd()), a: lerp(0.05, 0.13, rnd()) });
    }

    /* Static layers (gradient, far rocks, sea floor) are baked once per resize. */
    var bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(W));
    bg.height = Math.max(1, Math.round(H));
    var c = bg.getContext('2d');

    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.water[0]);
    g.addColorStop(0.55, util.mixColor(th.water[0], th.water[1], 0.72));
    g.addColorStop(1, th.deep);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    /* Distant rock ridge */
    c.save();
    c.fillStyle = rgba(th.rock, 0.55);
    c.beginPath();
    c.moveTo(0, floorY + 6);
    var px = 0;
    while (px < W) {
      var pw = lerp(60, 180, rnd());
      var ph = lerp(18, 90, rnd());
      c.quadraticCurveTo(px + pw * 0.5, floorY - ph, px + pw, floorY + 4);
      px += pw;
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.restore();

    /* Sea floor */
    var fg = c.createLinearGradient(0, floorY - 10, 0, H);
    fg.addColorStop(0, th.sand);
    fg.addColorStop(1, th.sandDark);
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(0, floorY + 10);
    var fx = 0;
    while (fx < W) {
      var fw = lerp(70, 190, rnd());
      c.quadraticCurveTo(fx + fw * 0.5, floorY + lerp(-12, 8, rnd()), fx + fw, floorY + lerp(4, 14, rnd()));
      fx += fw;
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    /* Speckles, pebbles and a few shells on the floor */
    for (var k = 0; k < Math.round(W * 0.55); k++) {
      var sx = rnd() * W, sy = floorY + 8 + rnd() * (floorH - 8);
      c.fillStyle = rgba(rnd() < 0.5 ? th.sandDark : shade(th.sand, 0.35), lerp(0.15, 0.5, rnd()));
      c.fillRect(sx, sy, lerp(1, 3, rnd()), lerp(1, 2.5, rnd()));
    }
    for (var p = 0; p < Math.round(W / 90); p++) {
      var bx = rnd() * W, by = floorY + 14 + rnd() * (floorH - 20), br = lerp(5, 16, rnd());
      var pg = c.createRadialGradient(bx - br * 0.3, by - br * 0.4, br * 0.2, bx, by, br);
      pg.addColorStop(0, shade(th.rock, 0.35));
      pg.addColorStop(1, shade(th.rock, -0.2));
      c.fillStyle = pg;
      c.beginPath(); c.ellipse(bx, by, br, br * 0.72, rnd() * TAU, 0, TAU); c.fill();
    }
    for (var sh = 0; sh < Math.round(W / 380) + 1; sh++) {
      drawShell(c, rnd() * W, floorY + 18 + rnd() * (floorH - 28), lerp(9, 16, rnd()), th, rnd());
    }

    decor.bg = bg;
    return decor;
  }

  function drawShell(c, x, y, r, th, seed) {
    c.save();
    c.translate(x, y);
    c.rotate(lerp(-0.4, 0.4, seed));
    var g = c.createLinearGradient(0, -r, 0, r * 0.4);
    g.addColorStop(0, '#fff3e2');
    g.addColorStop(1, shade(th.accent, -0.15));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-r, r * 0.35);
    c.quadraticCurveTo(-r * 0.9, -r * 0.9, 0, -r);
    c.quadraticCurveTo(r * 0.9, -r * 0.9, r, r * 0.35);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#8a6b46', 0.5);
    c.lineWidth = 1;
    for (var i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(0, r * 0.3);
      c.lineTo(i * r * 0.42, -r * 0.85);
      c.stroke();
    }
    c.restore();
  }

  function drawBackground(ctx, decor, t) {
    var th = decor.theme, W = decor.W, H = decor.H;
    ctx.drawImage(decor.bg, 0, 0, W, H);

    /* Light shafts from the surface */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < decor.shafts.length; i++) {
      var s = decor.shafts[i];
      var sway = Math.sin(t * 0.22 + s.ph) * W * 0.02;
      var x = s.x + sway;
      var g = ctx.createLinearGradient(x, 0, x + s.sk * H, H * 0.9);
      g.addColorStop(0, rgba(th.light, s.a * (0.7 + 0.3 * Math.sin(t * 0.5 + s.ph))));
      g.addColorStop(1, rgba(th.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - s.w * 0.5, -10);
      ctx.lineTo(x + s.w * 0.5, -10);
      ctx.lineTo(x + s.w * 0.16 + s.sk * H, H * 0.95);
      ctx.lineTo(x - s.w * 0.16 + s.sk * H, H * 0.95);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* Surface caustics */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(th.light, 0.10);
    ctx.lineWidth = 2;
    for (var r = 0; r < 4; r++) {
      ctx.beginPath();
      for (var x2 = 0; x2 <= W; x2 += 24) {
        var y = 8 + r * 13 + Math.sin(x2 * 0.012 + t * 1.1 + r) * 5 + Math.sin(x2 * 0.031 - t * 0.7) * 3;
        if (x2 === 0) ctx.moveTo(x2, y); else ctx.lineTo(x2, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    /* Plants */
    for (var p = 0; p < decor.plants.length; p++) drawPlant(ctx, decor.plants[p], decor.floorY, th, t);

    /* Drifting ambient bubbles */
    ctx.save();
    for (var b = 0; b < decor.bubbles.length; b++) {
      var bb = decor.bubbles[b];
      var span = H + 40;
      var y2 = H + 20 - (((t * bb.sp + bb.off * span) % span));
      var x3 = bb.x + Math.sin(y2 * 0.02 + bb.ph) * 12;
      ctx.strokeStyle = rgba('#ffffff', 0.22);
      ctx.fillStyle = rgba('#ffffff', 0.07);
      ctx.lineWidth = 1;
      circle(ctx, x3, y2, bb.r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.35);
      circle(ctx, x3 - bb.r * 0.3, y2 - bb.r * 0.35, bb.r * 0.28);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlant(ctx, pl, floorY, th, t) {
    var col = util.mixColor(th.plant[0], th.plant[1], pl.hue);
    ctx.save();
    ctx.translate(pl.x, floorY + 12);
    for (var i = 0; i < pl.blades; i++) {
      var lean = (i - (pl.blades - 1) / 2) * 0.22;
      var sway = Math.sin(t * pl.speed + pl.phase + i * 0.7) * 0.24;
      var h = pl.h * lerp(0.6, 1, (i % 2 ? 0.85 : 1));
      var w = pl.w * lerp(0.6, 1, (i % 3 ? 0.8 : 1));
      var g = ctx.createLinearGradient(0, 0, 0, -h);
      g.addColorStop(0, shade(col, -0.35));
      g.addColorStop(1, shade(col, 0.2));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);
      if (pl.kind === 'fan') {
        ctx.quadraticCurveTo((lean + sway) * h * 0.7, -h * 0.55, (lean + sway) * h * 1.3, -h);
        ctx.quadraticCurveTo((lean + sway) * h * 0.7 + w * 1.4, -h * 0.5, w * 0.5, 0);
      } else {
        ctx.quadraticCurveTo((lean + sway) * h * 0.5, -h * 0.6, (lean + sway) * h + w * 0.1, -h);
        ctx.quadraticCurveTo((lean + sway) * h * 0.5 + w * 1.1, -h * 0.55, w * 0.5, 0);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* Foreground glass: vignette plus a highlight so it reads as a tank. */
  function drawGlass(ctx, W, H, t) {
    var g = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,10,20,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var hg = ctx.createLinearGradient(0, 0, W * 0.55, H);
    hg.addColorStop(0, 'rgba(255,255,255,0.07)');
    hg.addColorStop(0.35, 'rgba(255,255,255,0.012)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ------------------------------------------------------------- creatures */

  function fishEye(ctx, x, y, r, mood, blink) {
    if (mood === 'dead') {
      ctx.strokeStyle = '#1b2b33';
      ctx.lineWidth = r * 0.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      return;
    }
    fillCircle(ctx, x, y, r, '#fdfdff');
    ctx.strokeStyle = 'rgba(20,40,50,0.35)';
    ctx.lineWidth = r * 0.12;
    circle(ctx, x, y, r); ctx.stroke();
    var px = x + r * 0.22, py = y + (mood === 'hungry' ? r * 0.12 : 0);
    fillCircle(ctx, px, py, r * 0.52, '#152229');
    fillCircle(ctx, px - r * 0.15, py - r * 0.2, r * 0.18, 'rgba(255,255,255,0.92)');
    if (blink) {
      ctx.fillStyle = 'rgba(20,40,50,0.9)';
      ctx.beginPath();
      ctx.rect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 1.5);
      ctx.fill();
    }
  }

  function fanTail(ctx, o) {
    /* Wagging tail attached at (ax, 0), sweeping back to -x. */
    var wag = Math.sin(o.phase) * (o.wag === undefined ? 0.34 : o.wag);
    ctx.save();
    ctx.translate(o.ax, 0);
    ctx.rotate(wag);
    var g = ctx.createLinearGradient(0, 0, -o.len, 0);
    g.addColorStop(0, shade(o.color, -0.1));
    g.addColorStop(1, shade(o.color, 0.28));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -o.h * 0.22);
    ctx.quadraticCurveTo(-o.len * 0.7, -o.h * 1.15, -o.len, -o.h * 0.55);
    ctx.quadraticCurveTo(-o.len * 0.55, 0, -o.len, o.h * 0.55);
    ctx.quadraticCurveTo(-o.len * 0.7, o.h * 1.15, 0, o.h * 0.22);
    ctx.closePath();
    ctx.fill();
    if (o.rays) {
      ctx.strokeStyle = rgba(shade(o.color, -0.35), 0.5);
      ctx.lineWidth = 0.012;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-o.len * 0.1, i * o.h * 0.1);
        ctx.lineTo(-o.len * 0.92, i * o.h * 0.42);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function stripes(ctx, color, count, y0, y1) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = color;
    for (var i = 0; i < count; i++) {
      var x = -0.28 + i * (0.62 / count);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + 0.06, 0, x, y1);
      ctx.lineTo(x + 0.05, y1);
      ctx.quadraticCurveTo(x + 0.11, 0, x + 0.05, y0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function spots(ctx, color, seed) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = color;
    var rnd = util.mulberry32(seed || 7);
    for (var i = 0; i < 9; i++) {
      var x = lerp(-0.32, 0.34, rnd()), y = lerp(-0.2, 0.2, rnd()), r = lerp(0.02, 0.055, rnd());
      circle(ctx, x, y, r); ctx.fill();
    }
    ctx.restore();
  }

  var fishShapes = {};

  /* Classic aquarium guppy: teardrop body, big fan tail. */
  fishShapes.guppy = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(o.c1, 0.25);
    fanTail(ctx, { ax: -0.3, len: 0.24, h: 0.2, color: c2, phase: o.phase, rays: true });
    /* dorsal + pelvic fins */
    ctx.fillStyle = rgba(c2, 0.95);
    ctx.beginPath();
    ctx.moveTo(0.04, -0.19);
    ctx.quadraticCurveTo(-0.06, -0.36 - Math.sin(o.phase) * 0.02, -0.2, -0.16);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.0, 0.18);
    ctx.quadraticCurveTo(-0.08, 0.31, -0.18, 0.14);
    ctx.closePath(); ctx.fill();

    var g = ctx.createLinearGradient(0, -0.26, 0, 0.26);
    g.addColorStop(0, shade(c1, 0.34));
    g.addColorStop(0.45, c1);
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.47, 0.01);
    ctx.quadraticCurveTo(0.32, -0.25, 0.06, -0.24);
    ctx.quadraticCurveTo(-0.2, -0.22, -0.3, -0.09);
    ctx.quadraticCurveTo(-0.34, 0, -0.3, 0.09);
    ctx.quadraticCurveTo(-0.2, 0.22, 0.06, 0.24);
    ctx.quadraticCurveTo(0.32, 0.25, 0.47, 0.01);
    ctx.closePath();
    var body = ctx.fill();
    if (o.pattern === 'stripes') { ctx.beginPath(); ctx.ellipse(0.06, 0, 0.36, 0.23, 0, 0, TAU); stripes(ctx, rgba(shade(c1, -0.4), 0.35), 4, -0.25, 0.25); }
    else if (o.pattern === 'spots') { ctx.beginPath(); ctx.ellipse(0.06, 0, 0.36, 0.23, 0, 0, TAU); spots(ctx, rgba(shade(c1, -0.35), 0.35), o.seed); }

    /* belly sheen */
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(0.1, 0.12, 0.22, 0.07, -0.1, 0, TAU);
    ctx.fill();

    /* pectoral fin */
    ctx.fillStyle = rgba(c2, 0.85);
    ctx.save();
    ctx.translate(0.16, 0.08);
    ctx.rotate(Math.sin(o.phase * 1.7) * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.02, 0.14, -0.13, 0.11);
    ctx.quadraticCurveTo(-0.06, 0.03, 0, 0);
    ctx.fill();
    ctx.restore();

    /* mouth */
    ctx.strokeStyle = shade(c1, -0.5);
    ctx.lineWidth = 0.022;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.mouthOpen) { ctx.arc(0.42, 0.05, 0.045, -0.9, 1.6); }
    else { ctx.moveTo(0.4, 0.06); ctx.quadraticCurveTo(0.45, 0.09, 0.47, 0.05); }
    ctx.stroke();

    fishEye(ctx, 0.28, -0.075, 0.072, o.mood, o.blink);
    return body;
  };

  /* Carnivore: angular jaw, spiky dorsal ridge. */
  fishShapes.carnivore = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, -0.2);
    fanTail(ctx, { ax: -0.32, len: 0.2, h: 0.24, color: c2, phase: o.phase, wag: 0.26 });
    var g = ctx.createLinearGradient(0, -0.28, 0, 0.28);
    g.addColorStop(0, shade(c1, 0.3));
    g.addColorStop(0.5, c1);
    g.addColorStop(1, shade(c1, -0.38));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.5, -0.02);
    ctx.lineTo(0.2, -0.2);
    ctx.quadraticCurveTo(-0.05, -0.28, -0.32, -0.14);
    ctx.quadraticCurveTo(-0.36, 0, -0.32, 0.14);
    ctx.quadraticCurveTo(-0.05, 0.28, 0.2, 0.2);
    ctx.lineTo(0.5, 0.1);
    ctx.closePath();
    ctx.fill();

    /* dorsal spikes */
    ctx.fillStyle = shade(c2, -0.1);
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var x = 0.14 - i * 0.12;
      ctx.moveTo(x, -0.2);
      ctx.lineTo(x - 0.05, -0.34 + i * 0.02);
      ctx.lineTo(x - 0.1, -0.19);
    }
    ctx.fill();

    /* jaw + teeth */
    ctx.fillStyle = shade(c1, -0.45);
    ctx.beginPath();
    ctx.moveTo(0.5, -0.02);
    ctx.lineTo(0.5, 0.1);
    ctx.lineTo(0.28, 0.16);
    ctx.lineTo(0.3, -0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    var open = o.mouthOpen ? 0.05 : 0;
    for (var t2 = 0; t2 < 4; t2++) {
      var tx = 0.3 + t2 * 0.05;
      ctx.beginPath();
      ctx.moveTo(tx, 0.02 + open);
      ctx.lineTo(tx + 0.032, 0.02 + open);
      ctx.lineTo(tx + 0.016, 0.09 + open);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx, -0.0 - open * 0.6);
      ctx.lineTo(tx + 0.032, -0.0 - open * 0.6);
      ctx.lineTo(tx + 0.016, -0.06 - open * 0.6);
      ctx.closePath(); ctx.fill();
    }
    fishEye(ctx, 0.24, -0.09, 0.062, o.mood, o.blink);
  };

  /* Guppycruncher: heavy set, underbite, produces beetles. */
  fishShapes.cruncher = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, -0.25);
    fanTail(ctx, { ax: -0.3, len: 0.22, h: 0.26, color: c2, phase: o.phase, wag: 0.22 });
    var g = ctx.createLinearGradient(0, -0.3, 0, 0.3);
    g.addColorStop(0, shade(c1, 0.28));
    g.addColorStop(0.55, c1);
    g.addColorStop(1, shade(c1, -0.4));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.46, -0.08);
    ctx.quadraticCurveTo(0.36, -0.3, 0.02, -0.29);
    ctx.quadraticCurveTo(-0.24, -0.28, -0.3, -0.12);
    ctx.quadraticCurveTo(-0.34, 0.02, -0.3, 0.14);
    ctx.quadraticCurveTo(-0.2, 0.3, 0.1, 0.3);
    ctx.quadraticCurveTo(0.4, 0.3, 0.46, 0.12);
    ctx.closePath();
    ctx.fill();
    /* lower jaw juts forward */
    ctx.fillStyle = shade(c1, -0.3);
    ctx.beginPath();
    ctx.moveTo(0.24, 0.06);
    ctx.quadraticCurveTo(0.5, 0.06, 0.52, 0.2);
    ctx.quadraticCurveTo(0.36, 0.3, 0.16, 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    for (var i = 0; i < 5; i++) {
      var tx = 0.2 + i * 0.06;
      ctx.beginPath();
      ctx.moveTo(tx, 0.08);
      ctx.lineTo(tx + 0.038, 0.08);
      ctx.lineTo(tx + 0.019, -0.02 - (o.mouthOpen ? 0.03 : 0));
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = rgba(c2, 0.9);
    ctx.beginPath();
    ctx.moveTo(0.02, -0.28);
    ctx.quadraticCurveTo(-0.1, -0.44, -0.24, -0.24);
    ctx.closePath(); ctx.fill();
    fishEye(ctx, 0.27, -0.14, 0.066, o.mood, o.blink);
  };

  /* Beetlemuncher: broad flat head, huge scooping mouth. */
  fishShapes.muncher = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, -0.2);
    fanTail(ctx, { ax: -0.3, len: 0.22, h: 0.2, color: c2, phase: o.phase, wag: 0.3 });
    var g = ctx.createLinearGradient(0, -0.24, 0, 0.28);
    g.addColorStop(0, shade(c1, 0.32));
    g.addColorStop(0.5, c1);
    g.addColorStop(1, shade(c1, -0.34));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.5, -0.16);
    ctx.lineTo(0.12, -0.23);
    ctx.quadraticCurveTo(-0.26, -0.24, -0.3, -0.1);
    ctx.quadraticCurveTo(-0.34, 0.04, -0.28, 0.16);
    ctx.quadraticCurveTo(0.0, 0.28, 0.3, 0.22);
    ctx.quadraticCurveTo(0.5, 0.16, 0.5, -0.16);
    ctx.closePath();
    ctx.fill();
    /* scoop mouth */
    var mo = o.mouthOpen ? 0.06 : 0.0;
    ctx.fillStyle = '#3b1620';
    ctx.beginPath();
    ctx.moveTo(0.5, -0.14 - mo);
    ctx.quadraticCurveTo(0.3, 0.02, 0.5, 0.16 + mo);
    ctx.quadraticCurveTo(0.56, 0.0, 0.5, -0.14 - mo);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(c1, -0.45);
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.5, -0.14 - mo);
    ctx.quadraticCurveTo(0.3, 0.02, 0.5, 0.16 + mo);
    ctx.stroke();
    /* gill ridges */
    ctx.strokeStyle = rgba(shade(c1, -0.4), 0.4);
    ctx.lineWidth = 0.016;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0.16 - i * 0.09, 0.0, 0.14, -1.1, 1.1);
      ctx.stroke();
    }
    fishEye(ctx, 0.3, -0.1, 0.058, o.mood, o.blink);
  };

  /* Ultravore: apex predator, shark silhouette. */
  fishShapes.ultravore = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, -0.3);
    /* crescent tail */
    ctx.save();
    ctx.translate(-0.36, 0);
    ctx.rotate(Math.sin(o.phase) * 0.2);
    ctx.fillStyle = shade(c2, -0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.1, -0.14, -0.2, -0.34);
    ctx.quadraticCurveTo(-0.04, -0.16, 0.0, -0.04);
    ctx.quadraticCurveTo(-0.04, 0.16, -0.2, 0.34);
    ctx.quadraticCurveTo(-0.1, 0.14, 0, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    var g = ctx.createLinearGradient(0, -0.26, 0, 0.24);
    g.addColorStop(0, shade(c1, 0.26));
    g.addColorStop(0.55, c1);
    g.addColorStop(1, shade(c1, -0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.5, 0.02);
    ctx.quadraticCurveTo(0.3, -0.19, 0.02, -0.2);
    ctx.quadraticCurveTo(-0.24, -0.2, -0.36, -0.06);
    ctx.quadraticCurveTo(-0.4, 0.0, -0.36, 0.06);
    ctx.quadraticCurveTo(-0.2, 0.2, 0.04, 0.2);
    ctx.quadraticCurveTo(0.3, 0.2, 0.5, 0.02);
    ctx.closePath();
    ctx.fill();
    /* dorsal + pectoral */
    ctx.fillStyle = shade(c1, -0.2);
    ctx.beginPath();
    ctx.moveTo(0.06, -0.19);
    ctx.lineTo(-0.06, -0.42);
    ctx.lineTo(-0.2, -0.17);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.12, 0.14);
    ctx.lineTo(0.0, 0.36);
    ctx.lineTo(-0.06, 0.13);
    ctx.closePath(); ctx.fill();
    /* gill slashes */
    ctx.strokeStyle = rgba('#0b1520', 0.5);
    ctx.lineWidth = 0.016;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0.2 - i * 0.05, -0.09);
      ctx.quadraticCurveTo(0.18 - i * 0.05, 0.0, 0.2 - i * 0.05, 0.09);
      ctx.stroke();
    }
    /* jaw */
    var mo = o.mouthOpen ? 0.07 : 0.02;
    ctx.fillStyle = '#2a0b12';
    ctx.beginPath();
    ctx.moveTo(0.5, 0.02);
    ctx.quadraticCurveTo(0.34, 0.06 + mo, 0.24, 0.14 + mo);
    ctx.quadraticCurveTo(0.36, 0.08, 0.5, 0.06);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    for (var t2 = 0; t2 < 5; t2++) {
      var tx = 0.26 + t2 * 0.045, ty = 0.12 + mo - t2 * 0.018;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 0.03, ty - 0.005);
      ctx.lineTo(tx + 0.015, ty - 0.06);
      ctx.closePath(); ctx.fill();
    }
    fishEye(ctx, 0.32, -0.06, 0.05, o.mood, o.blink);
  };

  /* Breeder: round matriarch that spawns guppies. */
  fishShapes.breeder = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, 0.2);
    fanTail(ctx, { ax: -0.26, len: 0.26, h: 0.24, color: c2, phase: o.phase, rays: true });
    var g = ctx.createRadialGradient(0.05, -0.06, 0.05, 0.02, 0.03, 0.4);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(0.6, c1);
    g.addColorStop(1, shade(c1, -0.32));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0.06, 0.0, 0.4, 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(c2, 0.9);
    ctx.beginPath();
    ctx.moveTo(0.05, -0.28);
    ctx.quadraticCurveTo(-0.04, -0.46, -0.18, -0.24);
    ctx.closePath(); ctx.fill();
    /* belly with visible eggs */
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(0.08, 0.14, 0.25, 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(shade(c1, 0.5), 0.75);
    for (var i = 0; i < 5; i++) {
      circle(ctx, -0.04 + i * 0.06, 0.15 + (i % 2 ? 0.03 : 0), 0.022); ctx.fill();
    }
    ctx.strokeStyle = shade(c1, -0.5);
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    if (o.mouthOpen) ctx.arc(0.44, 0.03, 0.04, -0.8, 1.5);
    else { ctx.moveTo(0.4, 0.05); ctx.quadraticCurveTo(0.45, 0.08, 0.47, 0.03); }
    ctx.stroke();
    fishEye(ctx, 0.3, -0.09, 0.075, o.mood, o.blink);
  };

  /* Starcatcher: bottom walker with funnels on its back. */
  fishShapes.starcatcher = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2 || shade(c1, -0.25);
    /* legs */
    ctx.strokeStyle = shade(c2, -0.25);
    ctx.lineWidth = 0.035;
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var lx = -0.22 + i * 0.14;
      var step = Math.sin(o.phase * 2 + i * 1.5) * 0.05;
      ctx.beginPath();
      ctx.moveTo(lx, 0.12);
      ctx.quadraticCurveTo(lx + 0.02 + step, 0.24, lx - 0.02 + step, 0.3);
      ctx.stroke();
    }
    var g = ctx.createLinearGradient(0, -0.2, 0, 0.16);
    g.addColorStop(0, shade(c1, 0.3));
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.36, 0.1);
    ctx.quadraticCurveTo(-0.4, -0.14, -0.1, -0.18);
    ctx.quadraticCurveTo(0.2, -0.22, 0.42, -0.06);
    ctx.quadraticCurveTo(0.5, 0.06, 0.34, 0.13);
    ctx.quadraticCurveTo(0.0, 0.2, -0.36, 0.1);
    ctx.closePath();
    ctx.fill();
    /* two funnels */
    ctx.fillStyle = shade(c2, -0.1);
    for (var f = 0; f < 2; f++) {
      var fx = -0.14 + f * 0.26;
      ctx.beginPath();
      ctx.moveTo(fx - 0.08, -0.16);
      ctx.lineTo(fx - 0.11, -0.3);
      ctx.lineTo(fx + 0.11, -0.3);
      ctx.lineTo(fx + 0.08, -0.16);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#12232c';
      ctx.beginPath(); ctx.ellipse(fx, -0.3, 0.11, 0.035, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(c2, -0.1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(0.05, -0.08, 0.24, 0.05, -0.06, 0, TAU); ctx.fill();
    fishEye(ctx, 0.32, -0.02, 0.055, o.mood, o.blink);
  };

  /* --------------------------- pet body shapes (in the same unit space) --- */
  var petShapes = {};

  petShapes.fish = function (ctx, o) { fishShapes.guppy(ctx, o); };

  petShapes.snail = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    /* foot */
    ctx.fillStyle = shade(c2, 0.1);
    ctx.beginPath();
    ctx.moveTo(-0.34, 0.22);
    ctx.quadraticCurveTo(-0.1, 0.34, 0.3, 0.24);
    ctx.quadraticCurveTo(0.44, 0.2, 0.42, 0.12);
    ctx.quadraticCurveTo(0.1, 0.2, -0.34, 0.12);
    ctx.closePath();
    ctx.fill();
    /* head + eye stalks */
    ctx.fillStyle = shade(c2, 0.22);
    ctx.beginPath();
    ctx.ellipse(0.3, 0.06, 0.16, 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(c2, 0.1);
    ctx.lineWidth = 0.03;
    var wob = Math.sin(o.phase) * 0.03;
    ctx.beginPath();
    ctx.moveTo(0.34, -0.02); ctx.lineTo(0.44 + wob, -0.22);
    ctx.moveTo(0.26, -0.04); ctx.lineTo(0.3 + wob, -0.26);
    ctx.stroke();
    fillCircle(ctx, 0.44 + wob, -0.24, 0.04, '#20303a');
    fillCircle(ctx, 0.3 + wob, -0.28, 0.04, '#20303a');
    /* shell spiral */
    var g = ctx.createRadialGradient(-0.02, -0.06, 0.03, 0.0, 0.0, 0.34);
    g.addColorStop(0, shade(c1, 0.42));
    g.addColorStop(1, shade(c1, -0.28));
    ctx.fillStyle = g;
    circle(ctx, 0.0, -0.02, 0.3); ctx.fill();
    ctx.strokeStyle = rgba(shade(c1, -0.45), 0.75);
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    for (var a = 0; a < 9; a += 0.12) {
      var r = 0.03 + a * 0.032;
      var px = Math.cos(a * 1.0 + 0.4) * r, py = -0.02 + Math.sin(a * 1.0 + 0.4) * r;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.ellipse(-0.1, -0.16, 0.1, 0.05, -0.5, 0, TAU); ctx.fill();
  };

  petShapes.jelly = function (ctx, o) {
    var c1 = o.c1;
    var pulse = 1 + Math.sin(o.phase * 1.6) * 0.07;
    ctx.save();
    ctx.scale(pulse, 1 / pulse);
    var g = ctx.createRadialGradient(0, -0.1, 0.03, 0, -0.02, 0.36);
    g.addColorStop(0, rgba(shade(c1, 0.55), 0.95));
    g.addColorStop(0.7, rgba(c1, 0.8));
    g.addColorStop(1, rgba(shade(c1, -0.2), 0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.34, 0.04);
    ctx.quadraticCurveTo(-0.34, -0.34, 0, -0.34);
    ctx.quadraticCurveTo(0.34, -0.34, 0.34, 0.04);
    ctx.quadraticCurveTo(0.18, 0.14, 0, 0.06);
    ctx.quadraticCurveTo(-0.18, 0.14, -0.34, 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(shade(c1, 0.6), 0.55);
    ctx.lineWidth = 0.022;
    for (var i = 0; i < 5; i++) {
      var tx = -0.24 + i * 0.12;
      ctx.beginPath();
      ctx.moveTo(tx, 0.05);
      ctx.quadraticCurveTo(tx + Math.sin(o.phase * 2 + i) * 0.08, 0.24, tx + Math.sin(o.phase * 2 + i) * 0.12, 0.42);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(-0.1, -0.2, 0.1, 0.055, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
    fillCircle(ctx, 0.09, -0.1, 0.035, '#20303a');
    fillCircle(ctx, -0.09, -0.1, 0.035, '#20303a');
  };

  petShapes.crab = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    ctx.strokeStyle = shade(c1, -0.3);
    ctx.lineWidth = 0.035;
    ctx.lineCap = 'round';
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var step = Math.sin(o.phase * 2.4 + i * 1.2 + (s > 0 ? 0 : 1.6)) * 0.05;
        ctx.beginPath();
        ctx.moveTo(s * (0.1 + i * 0.08), 0.06);
        ctx.quadraticCurveTo(s * (0.26 + i * 0.08), 0.16 + step, s * (0.3 + i * 0.06), 0.3);
        ctx.stroke();
      }
    }
    /* claws */
    for (var cs = -1; cs <= 1; cs += 2) {
      var ca = Math.sin(o.phase * 1.8) * 0.2 * cs;
      ctx.save();
      ctx.translate(cs * 0.3, -0.04);
      ctx.rotate(ca);
      ctx.fillStyle = shade(c2, -0.05);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(cs * 0.16, -0.06, cs * 0.2, -0.16);
      ctx.quadraticCurveTo(cs * 0.06, -0.1, cs * 0.04, -0.02);
      ctx.quadraticCurveTo(cs * 0.16, 0.02, cs * 0.2, 0.06);
      ctx.quadraticCurveTo(cs * 0.08, 0.08, 0, 0.03);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    var g = ctx.createLinearGradient(0, -0.24, 0, 0.12);
    g.addColorStop(0, shade(c1, 0.35));
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -0.04, 0.3, 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(c1, -0.45), 0.5);
    ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(-0.2, -0.1); ctx.quadraticCurveTo(0, -0.02, 0.2, -0.1); ctx.stroke();
    fishEye(ctx, -0.1, -0.14, 0.05, o.mood, o.blink);
    fishEye(ctx, 0.1, -0.14, 0.05, o.mood, o.blink);
  };

  petShapes.turtle = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    /* flippers */
    ctx.fillStyle = shade(c2, 0.05);
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(-0.05, s * 0.16);
      ctx.rotate(Math.sin(o.phase * 2 + (s > 0 ? 0 : 1.5)) * 0.35 * s);
      ctx.beginPath();
      ctx.ellipse(-0.1, s * 0.1, 0.18, 0.07, s * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(0.18, s * 0.14);
      ctx.rotate(Math.sin(o.phase * 2 + (s > 0 ? 0.7 : 2.2)) * 0.4 * s);
      ctx.beginPath();
      ctx.ellipse(0.06, s * 0.08, 0.16, 0.065, -s * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    /* head */
    ctx.fillStyle = shade(c2, 0.15);
    ctx.beginPath(); ctx.ellipse(0.34, 0.0, 0.13, 0.11, 0, 0, TAU); ctx.fill();
    /* shell */
    var g = ctx.createRadialGradient(-0.04, -0.1, 0.04, 0, 0, 0.36);
    g.addColorStop(0, shade(c1, 0.35));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, -0.02, 0.36, 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(shade(c1, -0.5), 0.55);
    ctx.lineWidth = 0.022;
    ctx.beginPath(); ctx.ellipse(0, -0.02, 0.2, 0.14, 0, 0, TAU); ctx.stroke();
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.2, -0.02 + Math.sin(a) * 0.14);
      ctx.lineTo(Math.cos(a) * 0.35, -0.02 + Math.sin(a) * 0.25);
      ctx.stroke();
    }
    fishEye(ctx, 0.4, -0.04, 0.045, o.mood, o.blink);
  };

  petShapes.seahorse = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    var curl = Math.sin(o.phase) * 0.12;
    var g = ctx.createLinearGradient(-0.1, -0.4, 0.1, 0.4);
    g.addColorStop(0, shade(c1, 0.35));
    g.addColorStop(1, shade(c1, -0.32));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.16, -0.34);
    ctx.quadraticCurveTo(0.3, -0.24, 0.24, -0.1);
    ctx.quadraticCurveTo(0.12, 0.02, 0.06, 0.16);
    ctx.quadraticCurveTo(0.02 + curl, 0.34, -0.16 + curl, 0.32);
    ctx.quadraticCurveTo(-0.26 + curl, 0.3, -0.2 + curl, 0.2);
    ctx.quadraticCurveTo(-0.08, 0.22, -0.04, 0.08);
    ctx.quadraticCurveTo(0.0, -0.1, -0.06, -0.24);
    ctx.quadraticCurveTo(-0.02, -0.4, 0.16, -0.34);
    ctx.closePath();
    ctx.fill();
    /* snout */
    ctx.fillStyle = shade(c1, -0.1);
    ctx.beginPath();
    ctx.moveTo(0.2, -0.28);
    ctx.lineTo(0.42, -0.2);
    ctx.lineTo(0.2, -0.16);
    ctx.closePath(); ctx.fill();
    /* dorsal frill */
    ctx.fillStyle = rgba(c2, 0.85);
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var y = -0.22 + i * 0.12;
      ctx.moveTo(-0.06, y);
      ctx.quadraticCurveTo(-0.2, y + 0.03, -0.16, y + 0.1);
    }
    ctx.fill();
    fishEye(ctx, 0.18, -0.26, 0.05, o.mood, o.blink);
  };

  petShapes.puffer = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    var puff = 1 + Math.sin(o.phase * 1.3) * 0.05;
    ctx.save();
    ctx.scale(puff, puff);
    /* spikes */
    ctx.fillStyle = shade(c2, -0.05);
    for (var i = 0; i < 14; i++) {
      var a = (i / 14) * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0.24, -0.04);
      ctx.lineTo(0.4, 0);
      ctx.lineTo(0.24, 0.04);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    var g = ctx.createRadialGradient(-0.06, -0.08, 0.04, 0, 0, 0.3);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    circle(ctx, 0, 0, 0.27); ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.beginPath(); ctx.ellipse(-0.09, -0.11, 0.09, 0.05, -0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(c1, -0.5);
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.arc(0.16, 0.08, 0.06, -0.6, 1.2);
    ctx.stroke();
    fishEye(ctx, 0.14, -0.06, 0.062, o.mood, o.blink);
  };

  petShapes.manta = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    var flap = Math.sin(o.phase * 1.7);
    var g = ctx.createLinearGradient(0, -0.2, 0, 0.2);
    g.addColorStop(0, shade(c1, 0.3));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0.34, 0);
    ctx.quadraticCurveTo(0.1, -0.1, -0.1, -0.12 - flap * 0.16);
    ctx.quadraticCurveTo(-0.34, -0.1 - flap * 0.1, -0.4, 0.04);
    ctx.quadraticCurveTo(-0.34, 0.12 + flap * 0.1, -0.1, 0.14 + flap * 0.16);
    ctx.quadraticCurveTo(0.1, 0.12, 0.34, 0);
    ctx.closePath();
    ctx.fill();
    /* wing tips + tail */
    ctx.strokeStyle = shade(c2, -0.1);
    ctx.lineWidth = 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.34, 0.02);
    ctx.quadraticCurveTo(-0.48, 0.04 + flap * 0.06, -0.56, 0.1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(0.06, -0.02, 0.16, 0.05, -0.1, 0, TAU); ctx.fill();
    fishEye(ctx, 0.26, -0.03, 0.05, o.mood, o.blink);
  };

  petShapes.eel = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    ctx.strokeStyle = shade(c1, -0.25);
    ctx.lineWidth = 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i <= 10; i++) {
      var x = -0.45 + i * 0.09;
      var y = Math.sin(o.phase * 2 + i * 0.7) * 0.12 * (1 - i / 14);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = c1;
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    for (var j = 0; j <= 10; j++) {
      var x2 = -0.45 + j * 0.09;
      var y2 = Math.sin(o.phase * 2 + j * 0.7) * 0.12 * (1 - j / 14);
      if (j === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    /* head */
    var hy = Math.sin(o.phase * 2 + 10 * 0.7) * 0.12 * (1 - 10 / 14);
    ctx.fillStyle = shade(c1, 0.2);
    ctx.beginPath(); ctx.ellipse(0.46, hy, 0.11, 0.085, 0, 0, TAU); ctx.fill();
    /* crackle */
    ctx.strokeStyle = rgba(c2, 0.85);
    ctx.lineWidth = 0.02;
    for (var k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-0.3 + k * 0.2, -0.12);
      ctx.lineTo(-0.24 + k * 0.2, -0.02);
      ctx.lineTo(-0.32 + k * 0.2, 0.06);
      ctx.stroke();
    }
    fishEye(ctx, 0.5, hy - 0.02, 0.04, o.mood, o.blink);
  };

  petShapes.oyster = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    var open = 0.06 + Math.abs(Math.sin(o.phase * 0.8)) * 0.14;
    /* pearl inside */
    var pg = ctx.createRadialGradient(-0.03, -0.05, 0.01, 0, 0, 0.12);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(1, '#c9d6e8');
    ctx.fillStyle = pg;
    circle(ctx, 0, -0.02, 0.1); ctx.fill();
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(0, s * 0.02);
      ctx.rotate(s * open);
      var g = ctx.createLinearGradient(0, s * -0.2, 0, s * 0.1);
      g.addColorStop(0, shade(c1, 0.35));
      g.addColorStop(1, shade(c1, -0.3));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-0.34, 0);
      ctx.quadraticCurveTo(-0.2, s * -0.3, 0.06, s * -0.28);
      ctx.quadraticCurveTo(0.32, s * -0.24, 0.36, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(shade(c2, -0.2), 0.6);
      ctx.lineWidth = 0.018;
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.13, 0);
        ctx.quadraticCurveTo(i * 0.1, s * -0.16, i * 0.05, s * -0.26);
        ctx.stroke();
      }
      ctx.restore();
    }
    fillCircle(ctx, 0.1, -0.02, 0.028, '#20303a');
    fillCircle(ctx, -0.1, -0.02, 0.028, '#20303a');
  };

  petShapes.shark = function (ctx, o) { fishShapes.ultravore(ctx, o); };

  petShapes.blob = function (ctx, o) {
    var c1 = o.c1, c2 = o.c2;
    var w = 0.3 + Math.sin(o.phase * 1.5) * 0.02;
    var g = ctx.createRadialGradient(-0.05, -0.08, 0.03, 0, 0, 0.34);
    g.addColorStop(0, shade(c1, 0.45));
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w, 0.16);
    ctx.quadraticCurveTo(-w - 0.05, -0.24, 0, -0.28);
    ctx.quadraticCurveTo(w + 0.05, -0.24, w, 0.16);
    ctx.quadraticCurveTo(w * 0.5, 0.26, 0, 0.24);
    ctx.quadraticCurveTo(-w * 0.5, 0.26, -w, 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(shade(c2, 0.2), 0.7);
    ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.arc(0, 0.02, 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
    fishEye(ctx, 0.11, -0.1, 0.06, o.mood, o.blink);
    fishEye(ctx, -0.11, -0.1, 0.06, o.mood, o.blink);
  };

  petShapes.star = function (ctx, o) {
    var c1 = o.c1;
    var spin = o.phase * 0.3;
    var g = ctx.createRadialGradient(0, 0, 0.04, 0, 0, 0.4);
    g.addColorStop(0, shade(c1, 0.45));
    g.addColorStop(1, shade(c1, -0.25));
    ctx.fillStyle = g;
    util.starPath(ctx, 0, 0, 5, 0.42, 0.18, spin);
    ctx.fill();
    ctx.fillStyle = rgba(shade(c1, 0.6), 0.5);
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * TAU + spin - Math.PI / 2;
      circle(ctx, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.035); ctx.fill();
    }
    fishEye(ctx, 0.07, -0.05, 0.05, o.mood, o.blink);
    fishEye(ctx, -0.07, -0.05, 0.05, o.mood, o.blink);
  };

  /* ---------------------------------------------------------- accessories */
  var accessories = {
    none: function () { },
    crown: function (ctx, o) {
      ctx.fillStyle = '#ffd257';
      ctx.strokeStyle = '#a97516';
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      ctx.moveTo(0.04, -0.3);
      ctx.lineTo(0.06, -0.42); ctx.lineTo(0.13, -0.34);
      ctx.lineTo(0.2, -0.44); ctx.lineTo(0.26, -0.32);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    },
    goggles: function (ctx, o) {
      ctx.strokeStyle = '#2f4756';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0.12, -0.14); ctx.lineTo(-0.06, -0.18);
      ctx.stroke();
      ctx.fillStyle = 'rgba(180,240,255,0.55)';
      ctx.strokeStyle = '#8fd8ef';
      ctx.lineWidth = 0.02;
      circle(ctx, 0.28, -0.09, 0.1); ctx.fill(); ctx.stroke();
    },
    antenna: function (ctx, o) {
      ctx.strokeStyle = '#dfe9f2';
      ctx.lineWidth = 0.022;
      var w = Math.sin(o.phase * 2) * 0.04;
      ctx.beginPath();
      ctx.moveTo(0.1, -0.26);
      ctx.quadraticCurveTo(0.14, -0.4, 0.22 + w, -0.46);
      ctx.stroke();
      var g = ctx.createRadialGradient(0.22 + w, -0.48, 0.005, 0.22 + w, -0.48, 0.06);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(1, 'rgba(255,214,102,0)');
      ctx.fillStyle = g;
      circle(ctx, 0.22 + w, -0.48, 0.06); ctx.fill();
      fillCircle(ctx, 0.22 + w, -0.48, 0.028, '#ffe89a');
    },
    cross: function (ctx, o) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e04b52';
      ctx.lineWidth = 0.012;
      circle(ctx, -0.06, 0.0, 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e04b52';
      ctx.fillRect(-0.085, -0.02, 0.05, 0.04);
      ctx.fillRect(-0.08, -0.045, 0.04, 0.09);
    },
    coinbadge: function (ctx, o) {
      ctx.fillStyle = '#ffd257';
      ctx.strokeStyle = '#a97516';
      ctx.lineWidth = 0.014;
      circle(ctx, -0.04, 0.02, 0.09); ctx.fill(); ctx.stroke();
      text(ctx, '$', -0.04, 0.03, { size: 0.14, fill: '#8a5f10', weight: 'bold' });
    },
    spikes: function (ctx, o) {
      ctx.fillStyle = '#cfd8e0';
      for (var i = 0; i < 4; i++) {
        var x = -0.16 + i * 0.1;
        ctx.beginPath();
        ctx.moveTo(x, -0.24);
        ctx.lineTo(x + 0.04, -0.4);
        ctx.lineTo(x + 0.08, -0.22);
        ctx.closePath(); ctx.fill();
      }
    },
    halo: function (ctx, o) {
      var a = 0.55 + Math.sin(o.phase * 1.4) * 0.2;
      ctx.strokeStyle = rgba('#fff3b0', a);
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.ellipse(0.05, -0.4, 0.2, 0.06, 0, 0, TAU);
      ctx.stroke();
    },
    hat: function (ctx, o) {
      ctx.fillStyle = '#3c2f6e';
      ctx.beginPath();
      ctx.moveTo(-0.1, -0.26);
      ctx.quadraticCurveTo(0.06, -0.62, 0.24, -0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#241c4a';
      ctx.beginPath();
      ctx.ellipse(0.07, -0.28, 0.22, 0.05, -0.05, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe89a';
      util.starPath(ctx, 0.1, -0.42, 5, 0.05, 0.02, o.phase * 0.5);
      ctx.fill();
    },
    gear: function (ctx, o) {
      ctx.save();
      ctx.translate(-0.04, 0.0);
      ctx.rotate(o.phase * 0.6);
      ctx.fillStyle = '#c8d4dd';
      for (var i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * TAU);
        ctx.fillRect(-0.02, -0.13, 0.04, 0.05);
        ctx.restore();
      }
      circle(ctx, 0, 0, 0.085); ctx.fill();
      ctx.fillStyle = '#7c8b96';
      circle(ctx, 0, 0, 0.035); ctx.fill();
      ctx.restore();
    },
    fin_flame: function (ctx, o) {
      var f = 0.5 + Math.abs(Math.sin(o.phase * 3)) * 0.5;
      var g = ctx.createLinearGradient(-0.3, 0, -0.55, 0);
      g.addColorStop(0, rgba('#ffd166', 0.85));
      g.addColorStop(1, rgba('#ff5f4d', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.12);
      ctx.quadraticCurveTo(-0.5 - f * 0.1, 0, -0.3, 0.12);
      ctx.closePath(); ctx.fill();
    }
  };

  /* ------------------------------------------------------------ main draws */

  function drawFish(ctx, o) {
    var shape = fishShapes[o.shape] || fishShapes.guppy;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.scale(o.s * (o.dir < 0 ? -1 : 1), o.s * (o.flipY ? -1 : 1));
    if (o.glow) {
      ctx.save();
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = 0.5;
      ctx.globalAlpha = 0.9;
    }
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    shape(ctx, o);
    if (o.glow) ctx.restore();
    ctx.restore();
  }

  function drawPet(ctx, o) {
    var shape = petShapes[o.shape] || petShapes.fish;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.scale(o.s * (o.dir < 0 ? -1 : 1), o.s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    shape(ctx, o);
    var acc = accessories[o.acc || 'none'];
    if (acc) acc(ctx, o);
    ctx.restore();
  }

  /* --------------------------------------------------------------- aliens */
  var alienShapes = {};

  alienShapes.gnasher = function (ctx, o) {
    var c1 = o.c1 || '#4a86d8', c2 = o.c2 || '#dff1ff';
    /* claws */
    ctx.fillStyle = c2;
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var a = -0.5 + i * 0.5 + Math.sin(o.phase * 2 + i) * 0.1;
        ctx.save();
        ctx.translate(s * 0.3, 0.02);
        ctx.rotate(a * s + (s < 0 ? Math.PI : 0));
        ctx.beginPath();
        ctx.moveTo(0, -0.03);
        ctx.quadraticCurveTo(0.16, -0.05, 0.24, 0.0);
        ctx.quadraticCurveTo(0.16, 0.05, 0, 0.03);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    var g = ctx.createRadialGradient(-0.06, -0.1, 0.05, 0, 0, 0.4);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.3, 0.12);
    ctx.quadraticCurveTo(-0.36, -0.3, 0, -0.34);
    ctx.quadraticCurveTo(0.36, -0.3, 0.3, 0.12);
    ctx.quadraticCurveTo(0.16, 0.3, 0, 0.3);
    ctx.quadraticCurveTo(-0.16, 0.3, -0.3, 0.12);
    ctx.closePath();
    ctx.fill();
    /* horns */
    ctx.fillStyle = shade(c1, -0.3);
    ctx.beginPath();
    ctx.moveTo(-0.14, -0.3); ctx.lineTo(-0.2, -0.46); ctx.lineTo(-0.04, -0.33); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.14, -0.3); ctx.lineTo(0.2, -0.46); ctx.lineTo(0.04, -0.33); ctx.closePath(); ctx.fill();
    /* grin */
    var open = o.mouthOpen ? 0.09 : 0.03;
    ctx.fillStyle = '#2b0c1a';
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.02);
    ctx.quadraticCurveTo(0, 0.14 + open, 0.2, 0.02);
    ctx.quadraticCurveTo(0, 0.08, -0.2, 0.02);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    for (var t2 = 0; t2 < 5; t2++) {
      var tx = -0.17 + t2 * 0.085;
      ctx.beginPath();
      ctx.moveTo(tx, 0.03);
      ctx.lineTo(tx + 0.06, 0.03);
      ctx.lineTo(tx + 0.03, 0.1 + open * 0.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(-0.1, -0.18, 0.1, 0.05, -0.5, 0, TAU); ctx.fill();
  };

  alienShapes.maulrog = function (ctx, o) {
    var c1 = o.c1 || '#f08a2e', c2 = o.c2 || '#c0392b';
    /* mane */
    ctx.fillStyle = c2;
    for (var i = 0; i < 9; i++) {
      var a = (i / 9) * TAU;
      ctx.save();
      ctx.rotate(a + Math.sin(o.phase + i) * 0.06);
      ctx.beginPath();
      ctx.moveTo(0.14, -0.06);
      ctx.lineTo(0.44, 0);
      ctx.lineTo(0.14, 0.06);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    /* tail */
    ctx.save();
    ctx.translate(-0.24, 0.08);
    ctx.rotate(Math.sin(o.phase * 1.6) * 0.3);
    ctx.fillStyle = shade(c1, -0.15);
    ctx.beginPath();
    ctx.moveTo(0, -0.06);
    ctx.quadraticCurveTo(-0.2, -0.2, -0.34, -0.02);
    ctx.quadraticCurveTo(-0.2, 0.06, 0, 0.06);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    var g = ctx.createRadialGradient(-0.04, -0.08, 0.04, 0, 0, 0.32);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
    circle(ctx, 0, 0, 0.28); ctx.fill();
    /* side fins */
    ctx.fillStyle = shade(c2, 0.1);
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -0.06);
      ctx.quadraticCurveTo(s * 0.42, -0.2, s * 0.34, 0.04);
      ctx.closePath(); ctx.fill();
    }
    /* mouth */
    var open = o.mouthOpen ? 0.1 : 0.04;
    ctx.fillStyle = '#33060a';
    ctx.beginPath();
    ctx.ellipse(0.06, 0.12, 0.14, 0.05 + open, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (var t3 = 0; t3 < 4; t3++) {
      var tx2 = -0.05 + t3 * 0.07;
      ctx.beginPath();
      ctx.moveTo(tx2, 0.08);
      ctx.lineTo(tx2 + 0.045, 0.08);
      ctx.lineTo(tx2 + 0.022, 0.15);
      ctx.closePath(); ctx.fill();
    }
    /* red eyes */
    for (var e = -1; e <= 1; e += 2) {
      fillCircle(ctx, e * 0.1, -0.06, 0.07, '#fff2e8');
      fillCircle(ctx, e * 0.11, -0.06, 0.04, '#d81f26');
      fillCircle(ctx, e * 0.1, -0.08, 0.014, '#fff');
    }
  };

  alienShapes.bomber = function (ctx, o) {
    var c1 = o.c1 || '#7a8794', c2 = o.c2 || '#3d4750';
    /* treads */
    ctx.fillStyle = shade(c2, -0.2);
    util.roundRect(ctx, -0.36, 0.14, 0.72, 0.16, 0.07);
    ctx.fill();
    ctx.fillStyle = shade(c1, -0.05);
    for (var i = 0; i < 5; i++) {
      circle(ctx, -0.27 + i * 0.135, 0.22, 0.045); ctx.fill();
    }
    /* body dome */
    var g = ctx.createLinearGradient(0, -0.28, 0, 0.16);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.34, 0.14);
    ctx.quadraticCurveTo(-0.34, -0.24, 0, -0.26);
    ctx.quadraticCurveTo(0.34, -0.24, 0.34, 0.14);
    ctx.closePath(); ctx.fill();
    /* cannons */
    ctx.fillStyle = shade(c2, 0.1);
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * 0.24, -0.12);
      ctx.rotate(s * -0.5);
      util.roundRect(ctx, -0.05, -0.22, 0.1, 0.28, 0.03);
      ctx.fill();
      ctx.fillStyle = '#1a1f24';
      circle(ctx, 0, -0.2, 0.045); ctx.fill();
      ctx.fillStyle = shade(c2, 0.1);
      ctx.restore();
    }
    /* eye */
    var pulse = 0.6 + Math.abs(Math.sin(o.phase * 2)) * 0.4;
    ctx.fillStyle = rgba('#ff4444', pulse);
    circle(ctx, 0, -0.06, 0.09); ctx.fill();
    ctx.strokeStyle = shade(c2, 0.25);
    ctx.lineWidth = 0.03;
    circle(ctx, 0, -0.06, 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    circle(ctx, -0.03, -0.09, 0.025); ctx.fill();
    /* rivets */
    ctx.fillStyle = rgba(shade(c1, 0.5), 0.6);
    for (var r = 0; r < 5; r++) { circle(ctx, -0.24 + r * 0.12, 0.08, 0.014); ctx.fill(); }
  };

  alienShapes.squid = function (ctx, o) {
    var c1 = o.c1 || '#8e44ad', c2 = o.c2 || '#f39c12';
    /* tentacles */
    ctx.strokeStyle = shade(c1, -0.2);
    ctx.lineWidth = 0.055;
    ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var bx = -0.24 + i * 0.096;
      ctx.beginPath();
      ctx.moveTo(bx, 0.1);
      ctx.quadraticCurveTo(bx + Math.sin(o.phase * 2 + i) * 0.12, 0.3, bx + Math.sin(o.phase * 2 + i * 1.3) * 0.18, 0.46);
      ctx.stroke();
    }
    /* mantle */
    var g = ctx.createLinearGradient(0, -0.4, 0, 0.16);
    g.addColorStop(0, shade(c1, 0.42));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.3, 0.1);
    ctx.quadraticCurveTo(-0.34, -0.42, 0, -0.44);
    ctx.quadraticCurveTo(0.34, -0.42, 0.3, 0.1);
    ctx.quadraticCurveTo(0, 0.2, -0.3, 0.1);
    ctx.closePath(); ctx.fill();
    /* knife */
    ctx.save();
    ctx.translate(0.34, 0.06);
    ctx.rotate(-0.5 + Math.sin(o.phase * 2.5) * 0.35);
    ctx.fillStyle = '#5b3a1e';
    util.roundRect(ctx, -0.03, 0, 0.06, 0.14, 0.02); ctx.fill();
    var kg = ctx.createLinearGradient(-0.05, 0, 0.05, 0);
    kg.addColorStop(0, '#f2f7fa');
    kg.addColorStop(0.5, '#c3cdd6');
    kg.addColorStop(1, '#8d99a4');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.moveTo(-0.045, 0);
    ctx.lineTo(0.045, 0);
    ctx.lineTo(0.02, -0.34);
    ctx.lineTo(-0.02, -0.34);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* eyes */
    for (var e = -1; e <= 1; e += 2) {
      fillCircle(ctx, e * 0.13, -0.16, 0.1, '#fdf6ff');
      fillCircle(ctx, e * 0.14, -0.15, 0.055, '#20142b');
      fillCircle(ctx, e * 0.12, -0.19, 0.022, '#fff');
    }
    ctx.strokeStyle = shade(c2, -0.1);
    ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.arc(0, 0.0, 0.09, 0.25, Math.PI - 0.25); ctx.stroke();
  };

  alienShapes.golem = function (ctx, o) {
    var c1 = o.c1 || '#6d6a7c', c2 = o.c2 || '#ffe066';
    /* arms */
    ctx.fillStyle = shade(c1, -0.2);
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * 0.3, -0.02);
      ctx.rotate(Math.sin(o.phase * 1.2 + (s > 0 ? 0 : 2)) * 0.2 * s);
      util.roundRect(ctx, -0.09, -0.06, 0.18, 0.34, 0.06);
      ctx.fill();
      ctx.restore();
    }
    /* torso */
    var g = ctx.createLinearGradient(0, -0.34, 0, 0.3);
    g.addColorStop(0, shade(c1, 0.36));
    g.addColorStop(1, shade(c1, -0.4));
    ctx.fillStyle = g;
    util.roundRect(ctx, -0.28, -0.32, 0.56, 0.62, 0.14);
    ctx.fill();
    /* cracks */
    ctx.strokeStyle = rgba('#1a1620', 0.5);
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(-0.16, -0.28); ctx.lineTo(-0.08, -0.1); ctx.lineTo(-0.18, 0.06); ctx.lineTo(-0.06, 0.24);
    ctx.moveTo(0.18, -0.2); ctx.lineTo(0.1, 0.0); ctx.lineTo(0.2, 0.16);
    ctx.stroke();
    /* single glowing eye */
    var pulse = 0.7 + Math.sin(o.phase * 2.2) * 0.3;
    var eg = ctx.createRadialGradient(0, -0.12, 0.01, 0, -0.12, 0.16);
    eg.addColorStop(0, '#ffffff');
    eg.addColorStop(0.4, c2);
    eg.addColorStop(1, rgba(c2, 0));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = eg;
    circle(ctx, 0, -0.12, 0.16); ctx.fill();
    ctx.globalAlpha = 1;
    fillCircle(ctx, 0, -0.12, 0.07, '#fff8dc');
    fillCircle(ctx, 0, -0.12, 0.032, '#4a2c00');
    /* jaw */
    ctx.fillStyle = shade(c1, -0.5);
    util.roundRect(ctx, -0.15, 0.06, 0.3, 0.12, 0.04);
    ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.3);
    ctx.lineWidth = 0.014;
    for (var i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.15 + i * 0.075, 0.06);
      ctx.lineTo(-0.15 + i * 0.075, 0.18);
      ctx.stroke();
    }
  };

  alienShapes.thief = function (ctx, o) {
    var c1 = o.c1 || '#42d69a', c2 = o.c2 || '#1b6b52';
    /* sack */
    ctx.fillStyle = '#8b6b3e';
    ctx.beginPath();
    ctx.ellipse(-0.26, 0.14, 0.14, 0.16, 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5c4526';
    ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(-0.3, 0.0); ctx.lineTo(-0.22, -0.02); ctx.stroke();
    fillCircle(ctx, -0.28, 0.16, 0.035, '#ffd257');
    /* saucer body */
    var g = ctx.createLinearGradient(0, -0.16, 0, 0.16);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(1, shade(c1, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0.04, 0.02, 0.34, 0.13, 0, 0, TAU);
    ctx.fill();
    /* dome */
    ctx.fillStyle = rgba('#cdf6ff', 0.75);
    ctx.beginPath();
    ctx.ellipse(0.04, -0.04, 0.17, 0.14, 0, Math.PI, TAU);
    ctx.fill();
    fillCircle(ctx, 0.08, -0.08, 0.05, '#20303a');
    fillCircle(ctx, 0.09, -0.09, 0.018, '#fff');
    /* thruster lights */
    for (var i = 0; i < 4; i++) {
      var lx = -0.16 + i * 0.13;
      var a = 0.4 + 0.6 * Math.abs(Math.sin(o.phase * 3 + i));
      fillCircle(ctx, lx, 0.09, 0.028, rgba(c2, a));
    }
  };

  alienShapes.maw = function (ctx, o) {
    var c1 = o.c1 || '#5a1030', c2 = o.c2 || '#ff5c4d';
    var pulse = 1 + Math.sin(o.phase * 1.2) * 0.03;
    /* tentacles behind */
    ctx.strokeStyle = shade(c1, -0.2);
    ctx.lineWidth = 0.07;
    ctx.lineCap = 'round';
    for (var i = 0; i < 7; i++) {
      var a0 = Math.PI * (0.15 + i * 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * 0.3, Math.sin(a0) * 0.24);
      var sw = Math.sin(o.phase * 1.5 + i) * 0.14;
      ctx.quadraticCurveTo(Math.cos(a0) * 0.55 + sw, Math.sin(a0) * 0.5, Math.cos(a0) * 0.7 + sw * 1.5, Math.sin(a0) * 0.72);
      ctx.stroke();
    }
    ctx.save();
    ctx.scale(pulse, pulse);
    /* head mass */
    var g = ctx.createRadialGradient(-0.08, -0.14, 0.06, 0, 0, 0.52);
    g.addColorStop(0, shade(c1, 0.4));
    g.addColorStop(0.6, c1);
    g.addColorStop(1, shade(c1, -0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.46, 0.06);
    ctx.quadraticCurveTo(-0.5, -0.4, -0.1, -0.46);
    ctx.quadraticCurveTo(0.34, -0.5, 0.44, -0.16);
    ctx.quadraticCurveTo(0.52, 0.12, 0.24, 0.3);
    ctx.quadraticCurveTo(-0.1, 0.44, -0.36, 0.28);
    ctx.closePath();
    ctx.fill();
    /* spines */
    ctx.fillStyle = shade(c1, -0.4);
    for (var s = 0; s < 5; s++) {
      var sx = -0.3 + s * 0.15;
      ctx.beginPath();
      ctx.moveTo(sx, -0.42);
      ctx.lineTo(sx + 0.04, -0.62 - (s % 2) * 0.05);
      ctx.lineTo(sx + 0.1, -0.4);
      ctx.closePath(); ctx.fill();
    }
    /* three eyes */
    var eyes = [[-0.24, -0.2, 0.075], [0.02, -0.28, 0.065], [0.24, -0.14, 0.055]];
    for (var e = 0; e < eyes.length; e++) {
      var ex = eyes[e][0], ey = eyes[e][1], er = eyes[e][2];
      var eg = ctx.createRadialGradient(ex, ey, er * 0.2, ex, ey, er * 2.2);
      eg.addColorStop(0, rgba(c2, 0.9));
      eg.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = eg;
      circle(ctx, ex, ey, er * 2.2); ctx.fill();
      fillCircle(ctx, ex, ey, er, '#fff3e6');
      fillCircle(ctx, ex + er * 0.15, ey, er * 0.5, '#2a0410');
      fillCircle(ctx, ex - er * 0.2, ey - er * 0.3, er * 0.2, '#fff');
    }
    /* jaw */
    var open = (o.mouthOpen ? 0.16 : 0.05) + Math.sin(o.phase * 1.1) * 0.02;
    ctx.fillStyle = '#20030a';
    ctx.beginPath();
    ctx.moveTo(-0.34, 0.1);
    ctx.quadraticCurveTo(0, 0.24 + open * 2, 0.32, 0.06);
    ctx.quadraticCurveTo(0, 0.16, -0.34, 0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6ee';
    for (var t2 = 0; t2 < 8; t2++) {
      var tx = -0.31 + t2 * 0.082, ty = 0.115 + Math.sin(t2 / 7 * Math.PI) * 0.03;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 0.055, ty);
      ctx.lineTo(tx + 0.027, ty + 0.11 + open);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx, ty - 0.01);
      ctx.lineTo(tx + 0.055, ty - 0.01);
      ctx.lineTo(tx + 0.027, ty - 0.09);
      ctx.closePath(); ctx.fill();
    }
    /* glowing core */
    var cg = ctx.createRadialGradient(0, -0.02, 0.01, 0, -0.02, 0.14);
    cg.addColorStop(0, rgba('#ffffff', 0.9));
    cg.addColorStop(0.5, rgba(c2, 0.5));
    cg.addColorStop(1, rgba(c2, 0));
    ctx.fillStyle = cg;
    circle(ctx, 0, -0.02, 0.14); ctx.fill();
    ctx.restore();
  };

  function drawAlien(ctx, o) {
    var shape = alienShapes[o.shape] || alienShapes.gnasher;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.scale(o.s * (o.dir < 0 ? -1 : 1), o.s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    shape(ctx, o);
    if (o.flash > 0) {
      ctx.globalAlpha = clamp(o.flash, 0, 1) * 0.7;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- items */

  var coinLooks = {
    bronze: { face: '#e3a15a', edge: '#9c5f21', sym: '$' },
    silver: { face: '#e6edf4', edge: '#8d9aa7', sym: '$' },
    gold: { face: '#ffd766', edge: '#b57e13', sym: '$' },
    treasure: { face: '#ffe9a8', edge: '#a9761a', sym: '$' }
  };

  function drawCoin(ctx, o) {
    var type = o.type, s = o.s;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    if (type === 'diamond') {
      ctx.rotate(Math.sin(o.spin) * 0.25);
      var dg = ctx.createLinearGradient(-s, -s, s, s);
      dg.addColorStop(0, '#e8fbff');
      dg.addColorStop(0.45, '#7fe4ff');
      dg.addColorStop(1, '#2b8fd0');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.78, -s * 0.22);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.78, -s * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(-s * 0.78, -s * 0.22); ctx.lineTo(s * 0.78, -s * 0.22);
      ctx.moveTo(-s * 0.4, -s * 0.62); ctx.lineTo(0, s);
      ctx.moveTo(s * 0.4, -s * 0.62); ctx.lineTo(0, s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      util.starPath(ctx, -s * 0.3, -s * 0.35, 4, s * 0.3, s * 0.08, o.spin * 0.6);
      ctx.fill();
    } else if (type === 'pearl') {
      var pg = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.5, '#f2e9ff');
      pg.addColorStop(1, '#b9a9d6');
      ctx.fillStyle = pg;
      circle(ctx, 0, 0, s); ctx.fill();
      ctx.strokeStyle = rgba('#fff0ff', 0.6);
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.78, 0.6, 2.0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      circle(ctx, -s * 0.32, -s * 0.36, s * 0.2); ctx.fill();
    } else if (type === 'goldbar') {
      ctx.rotate(Math.sin(o.spin * 0.5) * 0.12);
      var bg = ctx.createLinearGradient(0, -s, 0, s);
      bg.addColorStop(0, '#ffe9a0');
      bg.addColorStop(0.5, '#ffc93c');
      bg.addColorStop(1, '#c08610');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, -s * 0.3);
      ctx.lineTo(s * 1.1, -s * 0.3);
      ctx.lineTo(s * 0.9, s * 0.5);
      ctx.lineTo(-s * 0.9, s * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff4c9';
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, -s * 0.32);
      ctx.lineTo(s * 0.85, -s * 0.32);
      ctx.lineTo(s * 1.1, -s * 0.62);
      ctx.lineTo(-s * 1.1, -s * 0.62);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#8a5f10', 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 'star') {
      var sg = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 1.3);
      sg.addColorStop(0, '#fffbe0');
      sg.addColorStop(0.5, '#ffe066');
      sg.addColorStop(1, 'rgba(255,196,0,0)');
      ctx.fillStyle = sg;
      circle(ctx, 0, 0, s * 1.3); ctx.fill();
      ctx.fillStyle = '#ffe066';
      util.starPath(ctx, 0, 0, 5, s, s * 0.44, o.spin * 0.8);
      ctx.fill();
      ctx.strokeStyle = '#c99a12';
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      util.starPath(ctx, 0, -s * 0.1, 5, s * 0.4, s * 0.16, o.spin * 0.8);
      ctx.fill();
    } else if (type === 'beetle') {
      var wig = Math.sin(o.spin * 3) * 0.2;
      ctx.rotate(wig * 0.2);
      ctx.strokeStyle = '#3d2a12';
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.lineCap = 'round';
      for (var l = -1; l <= 1; l += 2) {
        for (var i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(l * s * 0.4, -s * 0.3 + i * s * 0.3);
          ctx.lineTo(l * (s * 0.85 + Math.sin(o.spin * 4 + i) * s * 0.1), -s * 0.4 + i * s * 0.42);
          ctx.stroke();
        }
      }
      var eg2 = ctx.createRadialGradient(-s * 0.2, -s * 0.3, s * 0.1, 0, 0, s);
      eg2.addColorStop(0, '#c7f06a');
      eg2.addColorStop(0.6, '#6fae21');
      eg2.addColorStop(1, '#2f5b0d');
      ctx.fillStyle = eg2;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#294f0a';
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(0, s * 0.9); ctx.stroke();
      ctx.fillStyle = '#3a2a10';
      circle(ctx, 0, -s * 0.95, s * 0.32); ctx.fill();
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 1.2); ctx.lineTo(-s * 0.3, -s * 1.5);
      ctx.moveTo(s * 0.12, -s * 1.2); ctx.lineTo(s * 0.3, -s * 1.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.3, s * 0.16, s * 0.3, -0.3, 0, TAU); ctx.fill();
    } else {
      /* round coin, spinning about its vertical axis */
      var look = coinLooks[type] || coinLooks.gold;
      if (o.warn) {
        look = {
          face: util.mixColor(look.face, '#ff3b30', o.warn * 0.8),
          edge: util.mixColor(look.edge, '#8e0f08', o.warn * 0.8),
          sym: look.sym
        };
      }
      var sq = 0.22 + 0.78 * Math.abs(Math.cos(o.spin));
      ctx.scale(sq, 1);
      var cg2 = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s * 1.1);
      cg2.addColorStop(0, shade(look.face, 0.4));
      cg2.addColorStop(0.65, look.face);
      cg2.addColorStop(1, look.edge);
      ctx.fillStyle = cg2;
      circle(ctx, 0, 0, s); ctx.fill();
      ctx.strokeStyle = look.edge;
      ctx.lineWidth = Math.max(1, s * 0.14);
      circle(ctx, 0, 0, s * 0.92); ctx.stroke();
      ctx.fillStyle = rgba(look.edge, 0.85);
      text(ctx, look.sym, 0, s * 0.04, { size: s * 1.25, fill: rgba(look.edge, 0.9) });
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.34, -s * 0.36, s * 0.28, s * 0.14, -0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (o.warn) {
      /* Shapes with baked-in colours (gems, bars, beetles) cannot be
       * repalletted, so a red halo carries the warning for them. */
      var hg = ctx.createRadialGradient(o.x, o.y, s * 0.5, o.x, o.y, s * 2.6);
      hg.addColorStop(0, rgba('#ff3b30', 0.5 * o.warn));
      hg.addColorStop(1, rgba('#ff3b30', 0));
      ctx.save();
      ctx.fillStyle = hg;
      circle(ctx, o.x, o.y, s * 2.6);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFood(ctx, o) {
    var s = o.s, tier = o.tier || 1;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot || 0);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (tier === 1) {
      ctx.fillStyle = '#a97b3f';
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.4);
      ctx.lineTo(-s * 0.2, -s);
      ctx.lineTo(s * 0.9, -s * 0.3);
      ctx.lineTo(s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,190,0.5)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.4);
      ctx.lineTo(s * 0.2, -s * 0.2);
      ctx.lineTo(-s * 0.1, s * 0.3);
      ctx.closePath(); ctx.fill();
    } else if (tier === 2) {
      var g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.15, 0, 0, s * 1.2);
      g.addColorStop(0, '#ff9f5a');
      g.addColorStop(0.6, '#d2622c');
      g.addColorStop(1, '#8a3a13');
      ctx.fillStyle = g;
      circle(ctx, 0, 0, s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      circle(ctx, -s * 0.3, -s * 0.35, s * 0.22); ctx.fill();
    } else {
      var pg = ctx.createLinearGradient(0, -s, 0, s);
      pg.addColorStop(0, '#f5fbff');
      pg.addColorStop(0.5, '#bfe9ff');
      pg.addColorStop(0.5, '#5ec8ff');
      pg.addColorStop(1, '#2a86c8');
      ctx.fillStyle = pg;
      util.roundRect(ctx, -s * 1.1, -s * 0.72, s * 2.2, s * 1.44, s * 0.72);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      util.starPath(ctx, s * 0.5, -s * 0.3, 4, s * 0.4, s * 0.1, o.rot || 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEgg(ctx, x, y, r, cracks, colors, t) {
    ctx.save();
    ctx.translate(x, y);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.4);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(0.6, colors && colors[0] || '#f4e3c8');
    g.addColorStop(1, colors && colors[1] || '#c8a97c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r, 0, 0, TAU);
    ctx.fill();
    /* speckles */
    var rnd = util.mulberry32(42);
    ctx.fillStyle = 'rgba(120,80,40,0.35)';
    for (var i = 0; i < 16; i++) {
      var a = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.8;
      circle(ctx, Math.cos(a) * rr * r * 0.72, Math.sin(a) * rr * r * 0.92, r * lerp(0.03, 0.075, rnd()));
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.2, r * 0.1, -0.6, 0, TAU);
    ctx.fill();
    /* progressive cracks */
    ctx.strokeStyle = 'rgba(60,40,20,0.75)';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.lineCap = 'round';
    var paths = [
      [[-0.6, -0.2], [-0.25, -0.05], [-0.45, 0.2], [-0.1, 0.4]],
      [[0.55, -0.3], [0.2, -0.1], [0.5, 0.12], [0.15, 0.35]],
      [[-0.3, -0.75], [0.0, -0.5], [-0.15, -0.25], [0.2, -0.05]]
    ];
    for (var c = 0; c < Math.min(cracks, 3); c++) {
      ctx.beginPath();
      for (var p = 0; p < paths[c].length; p++) {
        var px = paths[c][p][0] * r * 0.78, py = paths[c][p][1] * r;
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    if (cracks >= 3) {
      var gl = 0.4 + Math.sin((t || 0) * 4) * 0.25;
      ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.8);
      gg.addColorStop(0, rgba('#fff6c0', gl));
      gg.addColorStop(1, 'rgba(255,246,192,0)');
      ctx.fillStyle = gg;
      circle(ctx, 0, 0, r * 1.8); ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- effects */

  function drawLightning(ctx, x1, y1, x2, y2, seed, color, width) {
    var rnd = util.mulberry32(seed | 0);
    var segs = 8;
    ctx.save();
    ctx.strokeStyle = color || '#bff0ff';
    ctx.lineWidth = width || 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = color || '#bff0ff';
    ctx.shadowBlur = (width || 3) * 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (var i = 1; i < segs; i++) {
      var t = i / segs;
      var nx = lerp(x1, x2, t), ny = lerp(y1, y2, t);
      var off = (rnd() - 0.5) * 34 * Math.sin(t * Math.PI);
      var dx = y2 - y1, dy = -(x2 - x1);
      var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      ctx.lineTo(nx + (dx / len) * off, ny + (dy / len) * off);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawLaser(ctx, x1, y1, x2, y2, alpha, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(color || '#ff5f4d', alpha * 0.15));
    g.addColorStop(0.7, rgba(color || '#ff5f4d', alpha * 0.9));
    g.addColorStop(1, rgba('#ffffff', alpha));
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba('#ffffff', alpha);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  function drawRing(ctx, x, y, r, alpha, color, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(color || '#ffffff', alpha);
    ctx.lineWidth = width || 3;
    circle(ctx, x, y, r);
    ctx.stroke();
    ctx.restore();
  }

  function drawSparkle(ctx, x, y, r, rot, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(color || '#ffffff', alpha === undefined ? 0.9 : alpha));
    g.addColorStop(1, rgba(color || '#ffffff', 0));
    ctx.fillStyle = g;
    circle(ctx, 0, 0, r); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', (alpha === undefined ? 0.9 : alpha) * 0.9);
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();
    ctx.restore();
  }

  /* Soft radial glow with no star arms - for big reveals. */
  function drawGlow(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color || '#ffffff', alpha === undefined ? 0.5 : alpha));
    g.addColorStop(0.45, rgba(color || '#ffffff', (alpha === undefined ? 0.5 : alpha) * 0.35));
    g.addColorStop(1, rgba(color || '#ffffff', 0));
    ctx.fillStyle = g;
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.restore();
  }

  function drawProjectile(ctx, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.kind === 'missile') {
      ctx.rotate(Math.atan2(o.vy, o.vx));
      /* exhaust */
      var f = 0.5 + Math.abs(Math.sin(o.age * 30)) * 0.5;
      var g = ctx.createLinearGradient(-o.s * 2.4 * f, 0, -o.s * 0.6, 0);
      g.addColorStop(0, 'rgba(255,140,60,0)');
      g.addColorStop(1, 'rgba(255,220,120,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-o.s * 0.6, -o.s * 0.4);
      ctx.lineTo(-o.s * 2.4 * f, 0);
      ctx.lineTo(-o.s * 0.6, o.s * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9d6de';
      util.roundRect(ctx, -o.s * 0.9, -o.s * 0.4, o.s * 1.8, o.s * 0.8, o.s * 0.35);
      ctx.fill();
      ctx.fillStyle = '#e04b52';
      ctx.beginPath();
      ctx.moveTo(o.s * 0.85, -o.s * 0.4);
      ctx.lineTo(o.s * 1.5, 0);
      ctx.lineTo(o.s * 0.85, o.s * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8d99a4';
      ctx.beginPath();
      ctx.moveTo(-o.s * 0.9, -o.s * 0.35);
      ctx.lineTo(-o.s * 1.3, -o.s * 0.8);
      ctx.lineTo(-o.s * 0.5, -o.s * 0.35);
      ctx.closePath(); ctx.fill();
    } else if (o.kind === 'orb') {
      var pulse = 1 + Math.sin(o.age * 12) * 0.12;
      var og = ctx.createRadialGradient(0, 0, o.s * 0.1, 0, 0, o.s * 1.8 * pulse);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.3, o.deflected ? '#9dffb0' : '#ffe066');
      og.addColorStop(1, o.deflected ? 'rgba(60,255,120,0)' : 'rgba(255,120,0,0)');
      ctx.fillStyle = og;
      circle(ctx, 0, 0, o.s * 1.8 * pulse); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      circle(ctx, 0, 0, o.s * 0.72); ctx.stroke();
    } else if (o.kind === 'spike') {
      ctx.rotate(Math.atan2(o.vy, o.vx));
      ctx.fillStyle = '#e7eef4';
      ctx.beginPath();
      ctx.moveTo(o.s * 1.4, 0);
      ctx.lineTo(-o.s * 0.6, -o.s * 0.45);
      ctx.lineTo(-o.s * 0.6, o.s * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      /* generic energy bolt */
      ctx.rotate(Math.atan2(o.vy, o.vx));
      ctx.globalCompositeOperation = 'lighter';
      var bg = ctx.createLinearGradient(-o.s * 2, 0, o.s * 2, 0);
      bg.addColorStop(0, 'rgba(120,220,255,0)');
      bg.addColorStop(0.5, 'rgba(190,245,255,0.9)');
      bg.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, o.s * 2, o.s * 0.55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------- ui */

  function panel(ctx, x, y, w, h, o) {
    o = o || {};
    var r = o.radius === undefined ? 14 : o.radius;
    ctx.save();
    if (o.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
    }
    var g = ctx.createLinearGradient(x, y, x, y + h);
    var top = o.top || 'rgba(16,54,78,0.94)';
    var bot = o.bottom || 'rgba(6,26,42,0.96)';
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = o.fill || g;
    util.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (o.stroke !== false) {
      ctx.strokeStyle = o.strokeColor || 'rgba(150,220,255,0.5)';
      ctx.lineWidth = o.strokeW || 2;
      util.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
      ctx.stroke();
    }
    /* glossy top edge */
    if (o.gloss !== false) {
      var gg = ctx.createLinearGradient(x, y, x, y + h * 0.45);
      gg.addColorStop(0, 'rgba(255,255,255,0.16)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      util.roundRect(ctx, x + 2, y + 2, w - 4, h * 0.45, r * 0.8);
      ctx.fill();
    }
    ctx.restore();
  }

  var icons = {};
  icons.gear = function (ctx, s, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * TAU);
      util.roundRect(ctx, -s * 0.11, -s * 0.95, s * 0.22, s * 0.42, s * 0.06);
      ctx.fill();
      ctx.restore();
    }
    circle(ctx, 0, 0, s * 0.62); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    circle(ctx, 0, 0, s * 0.26); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };
  icons.pause = function (ctx, s, color) {
    ctx.fillStyle = color;
    util.roundRect(ctx, -s * 0.5, -s * 0.7, s * 0.34, s * 1.4, s * 0.1); ctx.fill();
    util.roundRect(ctx, s * 0.16, -s * 0.7, s * 0.34, s * 1.4, s * 0.1); ctx.fill();
  };
  icons.play = function (ctx, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.72);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(-s * 0.45, s * 0.72);
    ctx.closePath(); ctx.fill();
  };
  icons.speaker = function (ctx, s, color, muted) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.28);
    ctx.lineTo(-s * 0.34, -s * 0.28);
    ctx.lineTo(0, -s * 0.72);
    ctx.lineTo(0, s * 0.72);
    ctx.lineTo(-s * 0.34, s * 0.28);
    ctx.lineTo(-s * 0.7, s * 0.28);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    if (muted) {
      ctx.beginPath();
      ctx.moveTo(s * 0.22, -s * 0.34); ctx.lineTo(s * 0.76, s * 0.34);
      ctx.moveTo(s * 0.76, -s * 0.34); ctx.lineTo(s * 0.22, s * 0.34);
      ctx.stroke();
    } else {
      for (var i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(s * 0.08, 0, s * (0.2 + i * 0.26), -0.9, 0.9);
        ctx.stroke();
      }
    }
  };
  icons.note = function (ctx, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-s * 0.28, s * 0.5, s * 0.3, s * 0.22, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.42, s * 0.28, s * 0.3, s * 0.22, -0.3, 0, TAU); ctx.fill();
    ctx.fillRect(-s * 0.02, -s * 0.75, s * 0.13, s * 1.3);
    ctx.fillRect(s * 0.62, -s * 0.95, s * 0.13, s * 1.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 0.75);
    ctx.lineTo(s * 0.78, -s * 0.98);
    ctx.lineTo(s * 0.78, -s * 0.66);
    ctx.lineTo(-s * 0.02, -s * 0.44);
    ctx.closePath(); ctx.fill();
  };
  icons.arrowLeft = function (ctx, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.6);
    ctx.lineTo(-s * 0.35, 0);
    ctx.lineTo(s * 0.3, s * 0.6);
    ctx.stroke();
  };
  icons.x = function (ctx, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, s * 0.5);
    ctx.moveTo(s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5, s * 0.5);
    ctx.stroke();
  };
  icons.check = function (ctx, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.05);
    ctx.lineTo(-s * 0.12, s * 0.5);
    ctx.lineTo(s * 0.58, -s * 0.5);
    ctx.stroke();
  };
  icons.lock = function (ctx, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.arc(0, -s * 0.22, s * 0.34, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = color;
    util.roundRect(ctx, -s * 0.5, -s * 0.22, s * 1.0, s * 0.78, s * 0.14);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    circle(ctx, 0, s * 0.14, s * 0.12); ctx.fill();
  };
  icons.food = function (ctx, s, color) {
    drawFood(ctx, { x: -s * 0.35, y: -s * 0.25, s: s * 0.4, tier: 2, rot: 0.3 });
    drawFood(ctx, { x: s * 0.3, y: s * 0.15, s: s * 0.36, tier: 1, rot: -0.4 });
    drawFood(ctx, { x: s * 0.05, y: -s * 0.6, s: s * 0.3, tier: 1, rot: 1.1 });
  };
  icons.laser = function (ctx, s, color) {
    ctx.save();
    ctx.rotate(-0.5);
    var g = ctx.createLinearGradient(-s, 0, s, 0);
    g.addColorStop(0, 'rgba(255,90,70,0)');
    g.addColorStop(0.6, '#ff6b52');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    util.roundRect(ctx, -s * 0.9, -s * 0.16, s * 1.8, s * 0.32, s * 0.16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = color || '#ffd166';
    ctx.lineWidth = s * 0.14;
    circle(ctx, 0, 0, s * 0.62); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, 0); ctx.lineTo(-s * 0.45, 0);
    ctx.moveTo(s * 0.45, 0); ctx.lineTo(s * 0.85, 0);
    ctx.moveTo(0, -s * 0.85); ctx.lineTo(0, -s * 0.45);
    ctx.moveTo(0, s * 0.45); ctx.lineTo(0, s * 0.85);
    ctx.stroke();
  };
  icons.egg = function (ctx, s, color) {
    drawEgg(ctx, 0, 0, s * 0.9, 0, null, 0);
  };
  icons.trophy = function (ctx, s, color) {
    var g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffd257');
    g.addColorStop(1, '#b7791a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.8);
    ctx.lineTo(s * 0.55, -s * 0.8);
    ctx.quadraticCurveTo(s * 0.5, s * 0.1, 0, s * 0.25);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.55, -s * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8bd45';
    ctx.lineWidth = s * 0.13;
    ctx.beginPath(); ctx.arc(-s * 0.72, -s * 0.42, s * 0.28, 0.6, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.72, -s * 0.42, s * 0.28, Math.PI * 1.4, 2.55); ctx.stroke();
    ctx.fillStyle = '#c8901f';
    util.roundRect(ctx, -s * 0.16, s * 0.2, s * 0.32, s * 0.4, s * 0.06); ctx.fill();
    util.roundRect(ctx, -s * 0.5, s * 0.58, s * 1.0, s * 0.24, s * 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.45, s * 0.1, s * 0.24, 0.2, 0, TAU); ctx.fill();
  };
  icons.fish = function (ctx, s, color) {
    drawFish(ctx, { x: 0, y: 0, s: s * 2.0, dir: 1, phase: 0.6, c1: color || '#ffb03a', c2: '#ff7a4d', shape: 'guppy', mood: 'ok' });
  };
  icons.skull = function (ctx, s, color) {
    ctx.fillStyle = color || '#e8eef4';
    circle(ctx, 0, -s * 0.15, s * 0.6); ctx.fill();
    util.roundRect(ctx, -s * 0.3, s * 0.25, s * 0.6, s * 0.35, s * 0.12); ctx.fill();
    ctx.fillStyle = '#1c2b33';
    circle(ctx, -s * 0.24, -s * 0.2, s * 0.17); ctx.fill();
    circle(ctx, s * 0.24, -s * 0.2, s * 0.17); ctx.fill();
    ctx.fillRect(-s * 0.08, s * 0.05, s * 0.16, s * 0.16);
  };
  icons.clock = function (ctx, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.14;
    circle(ctx, 0, 0, s * 0.72); ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.42);
    ctx.moveTo(0, 0); ctx.lineTo(s * 0.34, s * 0.1);
    ctx.stroke();
  };
  icons.plus = function (ctx, s, color) {
    ctx.fillStyle = color;
    util.roundRect(ctx, -s * 0.6, -s * 0.16, s * 1.2, s * 0.32, s * 0.1); ctx.fill();
    util.roundRect(ctx, -s * 0.16, -s * 0.6, s * 0.32, s * 1.2, s * 0.1); ctx.fill();
  };
  icons.heart = function (ctx, s, color) {
    ctx.fillStyle = color || '#ff6b81';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.62);
    ctx.bezierCurveTo(-s * 1.1, -s * 0.15, -s * 0.42, -s * 0.85, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.42, -s * 0.85, s * 1.1, -s * 0.15, 0, s * 0.62);
    ctx.closePath(); ctx.fill();
  };

  function icon(ctx, name, x, y, size, color, extra) {
    var fn = icons[name];
    if (!fn) return;
    ctx.save();
    ctx.translate(x, y);
    fn(ctx, size, color || '#dff1ff', extra);
    ctx.restore();
  }

  /* Bouncy logo lettering with a fish and bubbles. */
  function drawLogo(ctx, cx, cy, scale, t) {
    var word = 'CRAZEE-QUARIUM';
    var size = 74 * scale;
    ctx.save();
    ctx.font = '900 ' + size + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var widths = [], total = 0;
    for (var i = 0; i < word.length; i++) {
      var w = ctx.measureText(word[i]).width * 0.92;
      widths.push(w);
      total += w;
    }
    var x = cx - total / 2;
    for (var j = 0; j < word.length; j++) {
      var cw = widths[j];
      var wob = Math.sin(t * 2.2 + j * 0.55) * size * 0.075;
      var rot = Math.sin(t * 1.6 + j * 0.5) * 0.05;
      ctx.save();
      ctx.translate(x + cw / 2, cy + wob);
      ctx.rotate(rot);
      var g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.32, '#8ff0ff');
      g.addColorStop(0.62, '#2ea8e8');
      g.addColorStop(1, '#0b6ba8');
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.17;
      ctx.strokeStyle = '#03293f';
      ctx.strokeText(word[j], 0, 0);
      ctx.lineWidth = size * 0.07;
      ctx.strokeStyle = '#bff0ff';
      ctx.strokeText(word[j], 0, 0);
      ctx.fillStyle = g;
      ctx.fillText(word[j], 0, 0);
      ctx.restore();
      x += cw;
    }
    ctx.restore();
    /* mascot + bubbles */
    drawFish(ctx, {
      x: cx + total / 2 + 74 * scale, y: cy + Math.sin(t * 1.4) * 8 * scale, s: 92 * scale,
      dir: -1, phase: t * 6, c1: '#ffb03a', c2: '#ff7a4d', shape: 'guppy', mood: 'ok', pattern: 'stripes', seed: 3
    });
    for (var b = 0; b < 6; b++) {
      var bt = (t * 0.5 + b * 0.17) % 1;
      var bx = cx - total / 2 - 30 * scale + Math.sin(b * 2.1 + t) * 10 * scale;
      var by = cy + 40 * scale - bt * 120 * scale;
      ctx.save();
      ctx.globalAlpha = (1 - bt) * 0.7;
      ctx.strokeStyle = 'rgba(220,250,255,0.9)';
      ctx.fillStyle = 'rgba(180,240,255,0.2)';
      ctx.lineWidth = 1.6;
      circle(ctx, bx, by, (3 + b * 1.4) * scale);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------- cursors
   * Drawn with the same code style as everything else and handed to CSS as
   * data URLs, so there are still no image files in the project.
   */
  function cursorSprite(draw, size, hx, hy) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var x = c.getContext('2d');
    draw(x);
    return 'url(' + c.toDataURL('image/png') + ') ' + hx + ' ' + hy + ', auto';
  }

  var INK = 'rgba(5,24,38,0.9)';

  /* Pinching hand sprinkling flakes - shown over open water. */
  function drawFeedCursor(x) {
    function limbs(w, color) {
      x.strokeStyle = color;
      x.lineWidth = w;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath(); x.moveTo(8, 8); x.lineTo(17, 18); x.stroke();
      x.beginPath(); x.moveTo(12, 5); x.lineTo(20, 15); x.stroke();
    }
    /* outline pass */
    limbs(8, INK);
    x.fillStyle = INK;
    circle(x, 22, 22, 8.5); x.fill();
    /* fill pass */
    limbs(4.2, '#ffffff');
    x.fillStyle = '#f4fbff';
    circle(x, 22, 22, 6.4); x.fill();
    /* flakes falling from the pinch */
    var flakes = [[4, 15, 2.2], [8, 20, 1.8], [3, 24, 1.5]];
    for (var i = 0; i < flakes.length; i++) {
      x.fillStyle = INK;
      circle(x, flakes[i][0], flakes[i][1], flakes[i][2] + 1.3); x.fill();
      x.fillStyle = '#ffc46b';
      circle(x, flakes[i][0], flakes[i][1], flakes[i][2]); x.fill();
    }
  }

  /* Pointing hand - shown over a collectable coin. */
  function drawHandCursor(x) {
    function limbs(w, color) {
      x.strokeStyle = color;
      x.lineWidth = w;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath(); x.moveTo(10, 6); x.lineTo(10, 16); x.stroke();
      x.beginPath(); x.moveTo(8, 20); x.lineTo(5, 24); x.stroke();
    }
    limbs(8.5, INK);
    x.fillStyle = INK;
    util.roundRect(x, 5, 13, 17, 16, 6.5); x.fill();
    limbs(5, '#ffffff');
    x.fillStyle = '#f4fbff';
    util.roundRect(x, 7, 15, 13, 12, 5); x.fill();
    x.strokeStyle = '#ffffff';
    x.lineWidth = 5.5;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(10, 7); x.lineTo(10, 15); x.stroke();
    x.strokeStyle = 'rgba(5,24,38,0.4)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(13.5, 17); x.lineTo(13.5, 21);
    x.moveTo(17, 18); x.lineTo(17, 21);
    x.stroke();
  }

  /* Reticle - shown over an alien or an incoming shot. */
  function drawTargetCursor(x) {
    var c = 18;
    x.strokeStyle = 'rgba(5,24,38,0.55)';
    x.lineWidth = 5;
    circle(x, c, c, 10.5); x.stroke();
    x.strokeStyle = '#ff5f4d';
    x.lineWidth = 2.6;
    circle(x, c, c, 10.5); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.65)';
    x.lineWidth = 1.2;
    circle(x, c, c, 6.5); x.stroke();
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * TAU;
      var dx = Math.cos(a), dy = Math.sin(a);
      x.strokeStyle = 'rgba(5,24,38,0.55)';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(c + dx * 11, c + dy * 11); x.lineTo(c + dx * 16.5, c + dy * 16.5);
      x.stroke();
      x.strokeStyle = '#ffe066';
      x.lineWidth = 2.2;
      x.beginPath();
      x.moveTo(c + dx * 11, c + dy * 11); x.lineTo(c + dx * 16.5, c + dy * 16.5);
      x.stroke();
    }
    x.fillStyle = INK;
    circle(x, c, c, 2.8); x.fill();
    x.fillStyle = '#ffe066';
    circle(x, c, c, 1.7); x.fill();
  }

  function makeCursors() {
    try {
      return {
        feed: cursorSprite(drawFeedCursor, 34, 8, 7),
        hand: cursorSprite(drawHandCursor, 34, 10, 5),
        target: cursorSprite(drawTargetCursor, 36, 18, 18)
      };
    } catch (e) {
      return { feed: 'crosshair', hand: 'pointer', target: 'crosshair' };
    }
  }

  CQ.art = {
    makeCursors: makeCursors,
    FONT: FONT,
    themes: themes,
    text: text, measure: measure, circle: circle, fillCircle: fillCircle, ellipse: ellipse,
    makeDecor: makeDecor, drawBackground: drawBackground, drawGlass: drawGlass,
    drawFish: drawFish, drawPet: drawPet, drawAlien: drawAlien,
    fishShapes: fishShapes, petShapes: petShapes, alienShapes: alienShapes, accessories: accessories,
    drawCoin: drawCoin, drawFood: drawFood, drawEgg: drawEgg, drawProjectile: drawProjectile,
    drawLightning: drawLightning, drawLaser: drawLaser, drawRing: drawRing, drawSparkle: drawSparkle, drawGlow: drawGlow,
    panel: panel, icon: icon, icons: icons, drawLogo: drawLogo
  };
})();
