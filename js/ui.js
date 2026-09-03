/* Crazee-quarium :: ui.js
 * An immediate-mode UI drawn entirely on the canvas: buttons, sliders, the HUD,
 * the shop bar, every screen and the always-available sound panel.
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util, art = CQ.art, data = CQ.data, audio = CQ.audio;
  var clamp = util.clamp, lerp = util.lerp, rgba = util.rgba, shade = util.shade;

  var ui = {
    pointer: { x: -1, y: -1, down: false, justDown: false, justUp: false },
    blocked: false,
    cursor: 'default',
    activeSlider: null,
    hoverId: null,
    lastHover: null,
    time: 0
  };

  ui.begin = function (pointer, dt) {
    ui.pointer = pointer;
    ui.cursor = 'default';
    ui.hoverId = null;
    ui.time += dt;
    if (!pointer.down && ui.activeSlider) ui.activeSlider = null;
  };
  ui.end = function () {
    if (ui.hoverId && ui.hoverId !== ui.lastHover) audio.play('hover');
    ui.lastHover = ui.hoverId;
  };

  /* Layout adapts to the viewport: a narrow screen gets a two-line HUD and
   * a two-row shop so nothing overflows or overlaps. shopCount lets the shop
   * stay on one row when a level sells only a few things. */
  ui.metrics = function (W, H, shopCount) {
    var n = shopCount || 8;
    var narrow = W < 780;
    var hudH = narrow ? clamp(H * 0.10, 58, 86) : clamp(H * 0.088, 54, 78);
    var minBw = narrow ? 78 : 92;
    var perRow = Math.max(2, Math.floor((W - 8) / (minBw + 8)));
    var rows = n > perRow ? 2 : 1;
    var shopH = rows === 1 ? clamp(H * 0.112, 66, 98) : clamp(H * 0.175, 104, 146);
    return { hudH: hudH, shopH: shopH, shopRows: rows, narrow: narrow, pad: 12 };
  };

  function inRect(p, x, y, w, h) {
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  /* ----------------------------------------------------------- primitives */

  ui.button = function (id, x, y, w, h, label, o) {
    o = o || {};
    var ctx = ui.ctx;
    var p = ui.pointer;
    var hover = !ui.blocked && inRect(p, x, y, w, h);
    var disabled = !!o.disabled;
    var clicked = false;
    if (hover && !disabled) {
      ui.cursor = 'pointer';
      ui.hoverId = id;
      if (p.justDown) { clicked = true; audio.play(o.sound || 'click'); }
    }

    var top, bot, border, textColor;
    if (disabled) {
      top = 'rgba(46,64,78,0.85)'; bot = 'rgba(24,36,48,0.9)';
      border = 'rgba(120,150,170,0.35)'; textColor = 'rgba(190,215,230,0.45)';
    } else if (o.accent === 'gold') {
      top = hover ? '#ffd98a' : '#f0bd52'; bot = hover ? '#e0972a' : '#c8801a';
      border = '#fff0c0'; textColor = '#3a2400';
    } else if (o.accent === 'danger') {
      top = hover ? '#ff8f7a' : '#e05a45'; bot = hover ? '#d4402a' : '#a8301f';
      border = '#ffd0c4'; textColor = '#fff3ef';
    } else if (o.accent === 'green') {
      top = hover ? '#9be89f' : '#63c46c'; bot = hover ? '#3f9e4a' : '#2f7a3a';
      border = '#d8ffd8'; textColor = '#08290e';
    } else {
      top = hover ? '#3ba0d4' : '#1f7aa8'; bot = hover ? '#1a6b98' : '#0d4a70';
      border = 'rgba(180,235,255,0.7)'; textColor = '#f2fbff';
    }
    var press = (hover && p.down && !disabled) ? 2 : 0;

    ctx.save();
    ctx.translate(0, press);
    art.panel(ctx, x, y, w, h - press, {
      radius: o.radius === undefined ? 12 : o.radius,
      top: top, bottom: bot, strokeColor: border, strokeW: 2,
      shadow: !disabled
    });
    var cx = x + w / 2, cy = y + (h - press) / 2;
    var iconSize = o.iconSize || Math.min(h * 0.34, 20);
    if (o.icon && !o.iconOnly) {
      var tw = art.measure(ctx, label, o.size || Math.min(h * 0.4, 19));
      art.icon(ctx, o.icon, cx - tw / 2 - iconSize * 1.3, cy, iconSize, textColor);
      art.text(ctx, label, cx + iconSize * 0.7, cy, { size: o.size || Math.min(h * 0.4, 19), fill: textColor });
    } else if (o.iconOnly) {
      art.icon(ctx, o.icon, cx, cy, o.iconSize || h * 0.3, textColor, o.iconExtra);
    } else {
      art.text(ctx, label, cx, cy - (o.sub ? h * 0.11 : 0), { size: o.size || Math.min(h * 0.4, 19), fill: textColor });
      if (o.sub) art.text(ctx, o.sub, cx, cy + h * 0.24, { size: Math.min(h * 0.24, 13), fill: rgba('#ffffff', 0.75), weight: 'normal' });
    }
    ctx.restore();
    return clicked;
  };

  ui.slider = function (id, x, y, w, h, value, o) {
    o = o || {};
    var ctx = ui.ctx, p = ui.pointer;
    var pad = 10;
    var hit = { x: x - pad, y: y - h, w: w + pad * 2, h: h * 2.6 };
    var hover = !ui.blocked && inRect(p, hit.x, hit.y, hit.w, hit.h);
    if (hover) { ui.cursor = 'pointer'; ui.hoverId = id; }
    if (hover && p.justDown) ui.activeSlider = id;
    var v = clamp(value, 0, 1);
    if (ui.activeSlider === id && p.down) {
      var nv = clamp((p.x - x) / w, 0, 1);
      if (Math.abs(nv - v) > 0.005) {
        v = nv;
        if (o.tick !== false) audio.play('tick');
      }
    }

    /* track */
    ctx.save();
    art.panel(ctx, x, y, w, h, { radius: h / 2, top: 'rgba(4,26,42,0.9)', bottom: 'rgba(8,40,60,0.9)', strokeColor: 'rgba(140,210,240,0.45)', strokeW: 1.5, gloss: false, shadow: false });
    var fw = Math.max(h, w * v);
    var g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, o.color2 || '#2ea8e8');
    g.addColorStop(1, o.color || '#8ff0ff');
    ctx.fillStyle = g;
    util.roundRect(ctx, x, y, fw, h, h / 2);
    ctx.fill();
    /* notches */
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 10; i++) {
      var nx = x + (w * i) / 10;
      ctx.beginPath();
      ctx.moveTo(nx, y + h * 0.25);
      ctx.lineTo(nx, y + h * 0.75);
      ctx.stroke();
    }
    /* knob */
    var kx = x + w * v, ky = y + h / 2, kr = h * 0.95;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    var kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.4, kr * 0.1, kx, ky, kr);
    kg.addColorStop(0, '#ffffff');
    kg.addColorStop(0.6, '#cdf6ff');
    kg.addColorStop(1, '#4aa8d0');
    ctx.fillStyle = kg;
    art.circle(ctx, kx, ky, kr);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    art.circle(ctx, kx, ky, kr);
    ctx.stroke();
    ctx.restore();
    return v;
  };

  /* --------------------------------------------------------- sound panel */

  ui.settingsOpen = false;
  ui.openSettings = function () { ui.settingsOpen = true; audio.play('click'); };
  ui.closeSettings = function () { ui.settingsOpen = false; audio.play('back'); };

  ui.drawSettings = function (ctx, W, H) {
    if (!ui.settingsOpen) return;
    ui.ctx = ctx;
    /* dim the world behind the panel */
    ctx.fillStyle = 'rgba(2,12,22,0.62)';
    ctx.fillRect(0, 0, W, H);

    var w = Math.min(460, W - 40), h = 350;
    var x = (W - w) / 2, y = (H - h) / 2;
    art.panel(ctx, x, y, w, h, { radius: 20 });

    art.text(ctx, 'SOUND', x + w / 2, y + 40, { size: 30, fill: '#ffe066', stroke: '#04202f', strokeW: 6 });
    art.text(ctx, 'settings save automatically', x + w / 2, y + 68, { size: 13, fill: rgba('#dff1ff', 0.7), weight: 'normal' });

    var s = audio.settings;
    var rowY = y + 104;

    /* music */
    art.icon(ctx, 'note', x + 40, rowY + 14, 15, '#8ff0ff');
    art.text(ctx, 'Music', x + 66, rowY + 14, { size: 17, fill: '#dff1ff', align: 'left' });
    art.text(ctx, Math.round(s.music * 100) + '%', x + w - 40, rowY + 14, { size: 16, fill: '#ffe066', align: 'right' });
    var nm = ui.slider('set-music', x + 40, rowY + 36, w - 80, 12, s.music);
    if (nm !== s.music) audio.setMusic(nm);

    /* effects */
    rowY += 88;
    art.icon(ctx, 'speaker', x + 40, rowY + 14, 15, '#8ff0ff', false);
    art.text(ctx, 'Sound Effects', x + 66, rowY + 14, { size: 17, fill: '#dff1ff', align: 'left' });
    art.text(ctx, Math.round(s.fx * 100) + '%', x + w - 40, rowY + 14, { size: 16, fill: '#ffe066', align: 'right' });
    var nf = ui.slider('set-fx', x + 40, rowY + 36, w - 80, 12, s.fx);
    if (nf !== s.fx) audio.setFx(nf);

    /* mute + close */
    rowY += 76;
    if (ui.button('set-mute', x + 40, rowY, (w - 92) / 2, 46, s.muted ? 'Unmute' : 'Mute All', {
      icon: 'speaker', iconExtra: !s.muted, accent: s.muted ? 'green' : undefined
    })) audio.toggleMuted();
    if (ui.button('set-close', x + 52 + (w - 92) / 2, rowY, (w - 92) / 2, 46, 'Close', { accent: 'gold' })) ui.closeSettings();

    art.text(ctx, 'press S or Esc to toggle this panel', x + w / 2, y + h - 22, { size: 12, fill: rgba('#dff1ff', 0.55), weight: 'normal' });
  };

  /* Info and sound, present on every screen. */
  ui.cornerButtons = function (ctx, W, y) {
    var size = 40;
    if (ui.button('gear', W - size - 14, y, size, size, '', { iconOnly: true, icon: 'gear', iconSize: 13, radius: 10 })) {
      if (ui.settingsOpen) ui.closeSettings(); else ui.openSettings();
    }
    if (ui.button('info', W - size * 2 - 24, y, size, size, '', { iconOnly: true, icon: 'info', iconSize: 13, radius: 10 })) {
      if (ui.infoOpen) ui.closeInfo(); else ui.openInfo();
    }
    return size * 2 + 24;
  };

  /* ---------------------------------------------------------- info panel */

  ui.infoOpen = false;
  ui.openInfo = function () { ui.infoOpen = true; audio.play('click'); };
  ui.closeInfo = function () { ui.infoOpen = false; audio.play('back'); };

  var INFO_ROWS = [
    ['food', 'Click the water to drop one piece of food. Fed fish grow bigger and pay better.'],
    ['fish', 'Click a coin to bank it. A coin turns red just before it is lost.'],
    ['laser', 'Click an alien over and over to blast it. One hit per click, so upgrade the laser.'],
    ['egg', 'Buy all three egg pieces to finish a level and hatch a new pet.'],
    ['heart', 'Three pets dive with you. Every pet you hatch works for free, forever.'],
    ['skull', 'Lose every fish with no cash left for another and the tank is lost.']
  ];

  var INFO_TIPS = [
    'Upgrade Food Amount early - more pellets in the water means fewer hungry fish.',
    'Large guppies are safe from predators, so grow a few before you buy one.',
    'Keep a little cash spare so you can always restock after a raid.',
    'The cursor shows what a click will do: food, a coin, or a target.'
  ];

  ui.drawInfo = function (ctx, game) {
    if (!ui.infoOpen) return;
    ui.ctx = ctx;
    var W = game.W, H = game.H;
    ctx.fillStyle = 'rgba(2,12,22,0.66)';
    ctx.fillRect(0, 0, W, H);

    var w = Math.min(780, W - 28);
    var pad = clamp(w * 0.04, 16, 30);
    var textW = w - pad * 2 - 34;

    /* Lay the content out at a candidate size, shrinking until it fits. */
    var rowSize, tipSize, lineH, rows, tips, contentH, headH, footH;
    var size = clamp(Math.min(W, H) * 0.021, 10, 15);
    for (var attempt = 0; attempt < 4; attempt++) {
      rowSize = size;
      tipSize = Math.max(9, size - 1);
      lineH = rowSize * 1.32;
      rows = [];
      tips = [];
      var i;
      for (i = 0; i < INFO_ROWS.length; i++) {
        rows.push(art.wrapText(ctx, INFO_ROWS[i][1], textW, rowSize, 'normal'));
      }
      for (i = 0; i < INFO_TIPS.length; i++) {
        tips.push(art.wrapText(ctx, '-  ' + INFO_TIPS[i], w - pad * 2 - 24, tipSize, 'normal'));
      }
      headH = rowSize * 5.4;
      footH = rowSize * 4.6;
      var rowsH = 0;
      for (i = 0; i < rows.length; i++) rowsH += Math.max(lineH * 1.7, rows[i].length * lineH + lineH * 0.5);
      var tipsH = tipSize * 2.2;
      for (i = 0; i < tips.length; i++) tipsH += tips[i].length * tipSize * 1.3;
      contentH = headH + rowsH + tipsH + footH + pad * 2;
      if (contentH <= H - 28 || size <= 10) break;
      size = Math.max(10, size - 1.2);
    }

    var h = Math.min(H - 20, contentH);
    var x = (W - w) / 2, y = (H - h) / 2;
    art.panel(ctx, x, y, w, h, { radius: 20 });

    var cy = y + pad + rowSize * 1.5;
    art.text(ctx, 'HOW TO PLAY', x + w / 2, cy, {
      size: rowSize * 2, fill: '#ffe066', stroke: '#04202f', strokeW: 6
    });
    cy += rowSize * 1.9;
    art.text(ctx, data.levels.length + ' levels across ' + data.tanks.length + ' tanks   .   ' +
      data.pets.length + ' pets to hatch', x + w / 2, cy, {
        size: rowSize * 1.05, fill: '#8ff0ff', weight: 'normal'
      });
    cy += rowSize * 1.9;

    /* control rows */
    for (var r = 0; r < rows.length; r++) {
      var rh = Math.max(lineH * 1.7, rows[r].length * lineH + lineH * 0.5);
      art.panel(ctx, x + pad, cy, w - pad * 2, rh - lineH * 0.3, {
        radius: 10, top: 'rgba(12,58,84,0.7)', bottom: 'rgba(6,30,48,0.75)',
        gloss: false, shadow: false, strokeColor: 'rgba(140,220,255,0.2)'
      });
      var mid = cy + (rh - lineH * 0.3) / 2;
      art.icon(ctx, INFO_ROWS[r][0], x + pad + 20, mid, rowSize * 0.78, '#8ff0ff');
      for (var li = 0; li < rows[r].length; li++) {
        art.text(ctx, rows[r][li], x + pad + 40, mid - (rows[r].length - 1) * lineH / 2 + li * lineH, {
          size: rowSize, fill: '#dff1ff', align: 'left', weight: 'normal'
        });
      }
      cy += rh;
    }

    /* tips */
    cy += tipSize * 0.5;
    art.text(ctx, 'TIPS', x + pad + 4, cy, { size: tipSize * 1.15, fill: '#ffe066', align: 'left' });
    cy += tipSize * 1.5;
    for (var t = 0; t < tips.length; t++) {
      for (var tl = 0; tl < tips[t].length; tl++) {
        art.text(ctx, tips[t][tl], x + pad + (tl ? 16 : 4), cy, {
          size: tipSize, fill: rgba('#dff1ff', 0.9), align: 'left', weight: 'normal'
        });
        cy += tipSize * 1.3;
      }
    }

    /* progress, without giving away what is coming */
    var cleared = game.save.won ? data.levels.length : game.save.unlocked;
    cy = y + h - pad - rowSize * 2.6;
    art.text(ctx, 'You have cleared ' + cleared + ' of ' + data.levels.length + ' levels.' +
      (game.save.won ? '  All of them. Nicely done.' : ''), x + w / 2, cy, {
        size: rowSize * 1.05, fill: '#b7ffb0', weight: 'normal'
      });

    var bw = Math.min(200, w - pad * 2);
    if (ui.button('info-close', x + w / 2 - bw / 2, y + h - pad - rowSize * 1.9, bw, rowSize * 2.9, 'CLOSE', {
      accent: 'gold', size: rowSize * 1.25
    })) ui.closeInfo();
  };

  /* -------------------------------------------------------------- in-game */

  /* ------------------------------------------------- shared HUD fragments */

  /* Small labelled readout used for FISH and FOOD in the top bar. */
  function pill(ctx, x, y, w, h, label, size, alert, textColor) {
    art.panel(ctx, x, y, w, h, {
      radius: h / 2,
      top: alert ? 'rgba(140,28,36,0.95)' : 'rgba(12,60,86,0.9)',
      bottom: alert ? 'rgba(92,16,22,0.96)' : 'rgba(4,28,46,0.92)',
      gloss: false, shadow: false,
      strokeColor: alert ? 'rgba(255,150,150,0.75)' : 'rgba(140,220,255,0.35)'
    });
    art.text(ctx, label, x + w / 2, y + h / 2 + 1, {
      size: size, fill: textColor, stroke: '#04202f', strokeW: 3
    });
  }

  function drawEggPips(ctx, level, cx, cy, r, gap) {
    for (var e = 0; e < 3; e++) {
      var ex = cx + (e - 1) * gap;
      var got = e < level.eggPieces;
      ctx.save();
      ctx.globalAlpha = got ? 1 : 0.32;
      art.drawEgg(ctx, ex, cy, r, got ? e + 1 : 0, null, level.time);
      ctx.restore();
      if (!got) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        art.icon(ctx, 'lock', ex, cy, r * 0.48, '#9fc2d4');
        ctx.restore();
      }
    }
  }

  function drawBossBar(ctx, level, x, y, w, h, labelSize) {
    var boss = null;
    for (var i = 0; i < level.aliens.length; i++) {
      if (level.aliens[i].def.ai === 'boss') boss = level.aliens[i];
    }
    art.text(ctx, boss ? 'THE MAW' : (level.bossBeaten ? 'DEFEATED' : 'INCOMING'), x + w / 2, y - h, {
      size: labelSize || 15, fill: boss ? '#ff9aa2' : '#8ff0ff'
    });
    art.panel(ctx, x, y, w, h, {
      radius: h / 2, top: 'rgba(4,20,32,0.9)', bottom: 'rgba(4,20,32,0.9)',
      gloss: false, shadow: false, strokeColor: 'rgba(255,150,150,0.5)'
    });
    if (boss) {
      var fr = clamp(boss.hp / boss.maxHp, 0, 1);
      var g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, '#ff5c4d');
      g.addColorStop(1, '#ffd166');
      ctx.fillStyle = g;
      util.roundRect(ctx, x + 1, y + 1, Math.max(2, (w - 2) * fr), h - 2, (h - 2) / 2);
      ctx.fill();
    }
  }

  ui.drawHud = function (ctx, game, level) {
    ui.ctx = ctx;
    var W = level.W, m = game.metrics();
    var h = m.hudH, narrow = m.narrow;

    art.panel(ctx, -20, -20, W + 40, h + 20, {
      radius: 18, top: 'rgba(6,38,58,0.92)', bottom: 'rgba(3,20,34,0.88)',
      strokeColor: 'rgba(140,220,255,0.35)'
    });

    /* pause + settings, anchored right */
    var btn = clamp(h * (narrow ? 0.5 : 0.56), 30, 42);
    var btnY = (h - btn) / 2;
    if (ui.button('gear', W - btn - 12, btnY, btn, btn, '', {
      iconOnly: true, icon: 'gear', iconSize: btn * 0.32, radius: 10
    })) {
      if (ui.settingsOpen) ui.closeSettings(); else ui.openSettings();
    }
    if (ui.button('pause', W - btn * 2 - 22, btnY, btn, btn, '', {
      iconOnly: true, icon: 'pause', iconSize: btn * 0.3, radius: 10
    })) game.pause();
    if (ui.button('info', W - btn * 3 - 32, btnY, btn, btn, '', {
      iconOnly: true, icon: 'info', iconSize: btn * 0.32, radius: 10
    })) {
      if (ui.infoOpen) ui.closeInfo(); else ui.openInfo();
    }
    var right = W - btn * 3 - 42;

    /* money */
    var coinR = narrow ? 10 : 14;
    var moneyY = narrow ? h * 0.33 : h * 0.5;
    var moneyStr = util.fmtMoney(level.money);
    var moneySize = narrow ? Math.min(23, h * 0.3) : Math.min(30, h * 0.42);
    art.drawCoin(ctx, { x: 18 + coinR, y: moneyY, s: coinR, type: 'gold', spin: level.time * 2.2 });
    art.text(ctx, moneyStr, 18 + coinR * 2 + 8, moneyY, {
      size: moneySize, fill: '#ffe066', stroke: '#04202f', strokeW: 5, align: 'left'
    });
    var foodNow = level.paidFoodCount(), foodMax = level.maxFood();
    var foodFull = foodNow >= foodMax;

    if (narrow) {
      /* two compact lines: money on top, level + counters underneath */
      var line2 = h * 0.76;
      var nSize = Math.min(13, h * 0.17);
      var fishStrN = 'FISH ' + level.fishCount() + '/' + level.cfg.fishCap;
      var foodStrN = 'FOOD ' + foodNow + '/' + foodMax;
      var npw = Math.max(art.measure(ctx, fishStrN, nSize), art.measure(ctx, foodStrN, nSize)) + 20;
      /* the level name is dropped to just its number when the pills need the room */
      var nameSize = Math.min(14, h * 0.19);
      var nameStr = level.cfg.label + '  ' + level.cfg.name.toUpperCase();
      if (art.measure(ctx, nameStr, nameSize) > right - npw * 2 - 40) nameStr = level.cfg.label;
      art.text(ctx, nameStr, 18, line2, {
        size: nameSize, fill: '#dff1ff', align: 'left', stroke: '#04202f', strokeW: 3
      });
      var emptyN = level.fishCount() === 0;
      pill(ctx, right - npw, h * 0.56, npw, h * 0.34, foodStrN, nSize, foodFull, foodFull ? '#ffd9dd' : '#ffe066');
      pill(ctx, right - npw * 2 - 8, h * 0.56, npw, h * 0.34, fishStrN, nSize, emptyN, emptyN ? '#ffd9dd' : '#8ff0ff');
      if (level.cfg.boss) drawBossBar(ctx, level, right - 118, h * 0.3, 118, 9, 12);
      else drawEggPips(ctx, level, right - 30, h * 0.32, Math.min(12, h * 0.15), 25);
      return;
    }

    /* wide layout: centred level title, pets, egg pips at the right */
    var cx = W / 2;
    art.text(ctx, level.cfg.label + '  ' + level.cfg.name.toUpperCase(), cx, h * 0.36, {
      size: Math.min(21, h * 0.29), fill: '#dff1ff', stroke: '#04202f', strokeW: 4
    });
    art.text(ctx, data.tanks[level.cfg.tank].name, cx, h * 0.74, {
      size: Math.min(14, h * 0.2), fill: rgba('#8ff0ff', 0.8), weight: 'normal'
    });

    /* matching FISH and FOOD pills, right of the money */
    var lx = 18 + coinR * 2 + 8 + art.measure(ctx, moneyStr, moneySize) + 18;
    var cSize = Math.min(15, h * 0.21);
    var fishStr = 'FISH ' + level.fishCount() + '/' + level.cfg.fishCap;
    var foodStr = 'FOOD ' + foodNow + '/' + foodMax;
    var fpw = Math.max(art.measure(ctx, fishStr, cSize), art.measure(ctx, foodStr, cSize)) + 26;
    var empty = level.fishCount() === 0;
    pill(ctx, lx, h * 0.09, fpw, h * 0.38, fishStr, cSize, empty, empty ? '#ffd9dd' : '#8ff0ff');
    pill(ctx, lx, h * 0.53, fpw, h * 0.38, foodStr, cSize, foodFull, foodFull ? '#ffd9dd' : '#ffe066');

    if (level.cfg.boss) {
      drawBossBar(ctx, level, right - 156, h * 0.5, 150, 12, 15);
    } else {
      art.text(ctx, 'EGG', right - 118, h / 2, { size: 15, fill: '#dff1ff', align: 'right' });
      drawEggPips(ctx, level, right - 46, h / 2, Math.min(15, h * 0.22), 34);
    }

    /* active pets */
    for (var pi = 0; pi < level.pets.length; pi++) {
      var pd = level.pets[pi].def;
      var bx2 = lx + fpw + 16 + pi * 42;
      if (bx2 + 40 > cx - 205) break;
      ctx.save();
      art.panel(ctx, bx2, h * 0.16, 36, h * 0.68, {
        radius: 8, top: 'rgba(10,54,78,0.8)', bottom: 'rgba(4,26,42,0.85)',
        gloss: false, strokeColor: 'rgba(140,220,255,0.25)'
      });
      art.drawPet(ctx, {
        x: bx2 + 18, y: h / 2, s: 30, dir: 1, phase: level.time * 3 + pi,
        c1: pd.c1, c2: pd.c2, shape: pd.shape, acc: pd.acc, mood: 'ok'
      });
      ctx.restore();
    }
  };

  ui.drawShop = function (ctx, game, level) {
    ui.ctx = ctx;
    var W = level.W, H = level.H, m = game.metrics();
    var h = m.shopH, y = H - h;

    art.panel(ctx, -20, y, W + 40, h + 24, {
      radius: 18, top: 'rgba(6,38,58,0.94)', bottom: 'rgba(3,18,30,0.94)',
      strokeColor: 'rgba(140,220,255,0.35)'
    });

    var items = level.shopList();
    var rows = m.shopRows;
    var perRow = Math.ceil(items.length / rows);
    var pad = 8;
    var gapY = 6;
    var bw = Math.min(158, (W - 16 - (perRow - 1) * pad) / perRow);
    var bh = (h - 12 - (rows - 1) * gapY) / rows;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var row = Math.floor(i / perRow);
      var col = i % perRow;
      var inRow = Math.min(perRow, items.length - row * perRow);
      var rowW = inRow * bw + (inRow - 1) * pad;
      var bx = (W - rowW) / 2 + col * (bw + pad);
      var by = y + 6 + row * (bh + gapY);
      var dis = it.maxed || !it.afford;
      var acc = it.kind === 'egg' ? 'gold' : (it.kind === 'fish' ? 'green' : undefined);
      var hover = !ui.blocked && inRect(ui.pointer, bx, by, bw, bh);

      if (ui.button('shop-' + it.key, bx, by, bw, bh, '', { disabled: dis, accent: acc, radius: 12 })) {
        level.buy(it);
      }

      /* button face: icon, name, price */
      ctx.save();
      ctx.globalAlpha = dis ? 0.45 : 1;
      var iy = by + bh * 0.34;
      if (it.kind === 'fish') {
        art.drawFish(ctx, {
          x: bx + bw / 2, y: iy, s: Math.min(bw * 0.6, bh * 0.72), dir: 1,
          phase: ui.time * 4 + i, c1: it.fishDef.c1, c2: it.fishDef.c2,
          shape: it.fishDef.shape, mood: 'ok'
        });
      } else if (it.kind === 'egg') {
        art.drawEgg(ctx, bx + bw / 2, iy, bh * 0.29, level.eggPieces, null, level.time);
      } else {
        art.icon(ctx, it.icon, bx + bw / 2, iy, bh * 0.22, it.kind === 'upgrade' ? '#dff1ff' : '#ffe066');
      }
      var nameColor = it.kind === 'egg' ? '#3a2400' : (it.kind === 'fish' ? '#08290e' : '#eaf7ff');
      art.text(ctx, it.name, bx + bw / 2, by + bh * 0.66, {
        size: Math.min(13, bw * 0.135, bh * 0.2), fill: nameColor
      });
      if (it.maxed) {
        art.text(ctx, it.kind === 'egg' ? 'DONE' : 'MAX', bx + bw / 2, by + bh * 0.86, {
          size: Math.min(14, bw * 0.15, bh * 0.22), fill: '#b7ffb0'
        });
      } else {
        art.text(ctx, util.fmtMoney(it.price), bx + bw / 2, by + bh * 0.86, {
          size: Math.min(16, bw * 0.17, bh * 0.24),
          fill: it.afford ? (it.kind === 'egg' ? '#2a1800' : '#ffe066') : '#ff9aa2',
          stroke: it.kind === 'egg' ? undefined : '#04202f', strokeW: it.kind === 'egg' ? 0 : 3
        });
      }
      if (it.kind === 'upgrade') {
        for (var lp = 0; lp < it.max; lp++) {
          var lx = bx + bw / 2 - (it.max - 1) * 5 + lp * 10;
          ctx.fillStyle = lp < it.level ? '#8ff0ff' : 'rgba(200,230,245,0.28)';
          art.circle(ctx, lx, by + 9, 3.2);
          ctx.fill();
        }
      }
      ctx.restore();

      if (hover && !ui.blocked) ui.tooltip = { item: it, x: bx + bw / 2, y: by - 12 };
    }

  };

  ui.drawTooltip = function (ctx, W) {
    if (!ui.tooltip) return;
    var t = ui.tooltip, it = t.item;
    ui.tooltip = null;
    var lines = [];
    if (it.kind === 'fish') {
      lines.push(data.fish[it.key].desc);
      if (it.full) lines.push('Tank is full.');
    } else if (it.kind === 'egg') {
      lines.push('Buy all three pieces to finish the level and hatch a new pet.');
    } else if (it.key === 'food') {
      lines.push('Better food feeds more per piece and sinks slower.');
    } else if (it.key === 'maxfood') {
      lines.push('More food pieces allowed in the tank at once.');
    } else if (it.key === 'laser') {
      lines.push('More damage per click against aliens.');
    }
    if (!lines.length) return;
    var size = 13;
    var w = 0;
    for (var i = 0; i < lines.length; i++) w = Math.max(w, art.measure(ctx, lines[i], size, 'normal'));
    w += 24;
    var h = 14 + lines.length * 18;
    var x = clamp(t.x - w / 2, 8, W - w - 8);
    var y = t.y - h;
    art.panel(ctx, x, y, w, h, { radius: 8, top: 'rgba(10,44,66,0.96)', bottom: 'rgba(4,22,36,0.96)', gloss: false });
    for (var j = 0; j < lines.length; j++) {
      art.text(ctx, lines[j], x + w / 2, y + 16 + j * 18, { size: size, fill: '#dff1ff', weight: 'normal' });
    }
  };

  /* --------------------------------------------------------------- title */

  ui.drawTitle = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H;
    game.drawAmbient(ctx);

    var scale = clamp(Math.min(W / 1180, H / 800), 0.42, 1.05);
    art.drawLogo(ctx, W / 2 - 30 * scale, H * 0.22, scale, game.time);
    art.text(ctx, 'feed  .  grow  .  collect  .  defend', W / 2, H * 0.22 + 74 * scale, {
      size: 19 * scale, fill: '#cdf6ff', stroke: '#04263b', strokeW: 5
    });

    var bw = clamp(W * 0.26, 230, 320), bh = 58, gap = 14;
    var bx = W / 2 - bw / 2, by = H * 0.44;
    var save = game.save;
    var started = save.unlocked > 0 || save.session;
    if (ui.button('t-play', bx, by, bw, bh, started ? 'CONTINUE' : 'PLAY', { accent: 'gold', size: 24 })) {
      game.playFromSave();
    }
    by += bh + gap;
    if (ui.button('t-levels', bx, by, bw, bh, 'LEVEL SELECT', { size: 20 })) game.setScreen('map');
    by += bh + gap;
    if (ui.button('t-how', bx, by, bw, bh, 'HOW TO PLAY', { size: 20, icon: 'info', iconSize: 11 })) ui.openInfo();
    by += bh + gap;
    if (ui.button('t-sound', bx, by, bw, bh, 'SOUND', { size: 20, icon: 'speaker', iconExtra: audio.settings.muted })) ui.openSettings();

    /* progress line */
    var pets = save.pets.length;
    art.text(ctx, pets + ' of ' + data.pets.length + ' pets hatched   |   level ' +
      Math.min(save.unlocked + 1, data.levels.length) + ' of ' + data.levels.length,
      W / 2, H - 88, { size: 15, fill: rgba('#dff1ff', 0.85), weight: 'normal' });
    if (save.won) {
      art.icon(ctx, 'trophy', W / 2 - 150, H - 88, 13, '#ffd257');
      art.text(ctx, 'AQUARIUM SAVED', W / 2 + 150, H - 88, { size: 14, fill: '#ffd257' });
    }
    art.text(ctx, 'progress saves to this browser automatically', W / 2, H - 64, {
      size: 12, fill: rgba('#dff1ff', 0.5), weight: 'normal'
    });
    if (started) {
      if (ui.button('t-reset', 14, H - 44, 128, 32, 'Reset Save', { size: 13, accent: 'danger' })) game.confirmReset();
    }
    ui.cornerButtons(ctx, W, 14);
  };

  /* ----------------------------------------------------------------- map */

  ui.drawMap = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H, save = game.save;
    game.drawAmbient(ctx);
    ctx.fillStyle = 'rgba(2,14,26,0.5)';
    ctx.fillRect(0, 0, W, H);

    art.text(ctx, 'CHOOSE A TANK', W / 2, 46, { size: 32, fill: '#ffe066', stroke: '#04202f', strokeW: 6 });
    art.text(ctx, 'each level hatches a new pet', W / 2, 76, { size: 14, fill: rgba('#dff1ff', 0.75), weight: 'normal' });

    var levels = data.levels;
    var rows = data.tanks.length;
    var top = 104, bottom = H - 84;
    var rowH = (bottom - top) / rows;
    var nodeSize = clamp(Math.min(rowH * 0.62, W * 0.085), 44, 78);

    for (var t = 0; t < rows; t++) {
      var ry = top + rowH * t + rowH / 2;
      var th = art.themes[data.tanks[t].theme];
      /* row backdrop */
      art.panel(ctx, 20, ry - rowH * 0.42, W - 40, rowH * 0.84, {
        radius: 14, top: rgba(th.water[0], 0.3), bottom: rgba(th.water[1], 0.45),
        gloss: false, shadow: false, strokeColor: rgba(th.light, 0.25)
      });
      art.text(ctx, data.tanks[t].name.toUpperCase(), 40, ry - rowH * 0.24, {
        size: clamp(rowH * 0.19, 13, 19), fill: th.light, align: 'left', stroke: '#04202f', strokeW: 4
      });

      var inTank = [];
      for (var i = 0; i < levels.length; i++) if (levels[i].tank === t) inTank.push(levels[i]);
      var totalW = inTank.length * nodeSize + (inTank.length - 1) * nodeSize * 0.42;
      var startX = Math.max(200, (W - totalW) / 2);
      if (startX + totalW > W - 40) startX = W - 40 - totalW;

      for (var j = 0; j < inTank.length; j++) {
        var lv = inTank[j];
        var nx = startX + j * (nodeSize * 1.42);
        var ny = ry - nodeSize / 2 + rowH * 0.06;
        var unlocked = lv.index <= save.unlocked;
        var done = lv.index < save.unlocked || (save.won && lv.index === data.levels.length - 1);
        var isNext = lv.index === save.unlocked;
        var id = 'map-' + lv.index;

        if (unlocked) {
          if (ui.button(id, nx, ny, nodeSize, nodeSize, '', {
            radius: 14, accent: isNext ? 'gold' : (done ? 'green' : undefined)
          })) game.chooseLevel(lv.index);
        } else {
          art.panel(ctx, nx, ny, nodeSize, nodeSize, {
            radius: 14, top: 'rgba(30,44,56,0.8)', bottom: 'rgba(14,24,34,0.85)',
            strokeColor: 'rgba(120,150,170,0.3)', gloss: false
          });
        }
        ctx.save();
        ctx.globalAlpha = unlocked ? 1 : 0.5;
        var labelColor = unlocked ? (isNext ? '#3a2400' : (done ? '#08290e' : '#eaf7ff')) : '#9fc2d4';
        art.text(ctx, lv.boss ? 'BOSS' : lv.label, nx + nodeSize / 2, ny + nodeSize * 0.26, {
          size: nodeSize * (lv.boss ? 0.2 : 0.26), fill: labelColor
        });
        if (!unlocked) {
          art.icon(ctx, 'lock', nx + nodeSize / 2, ny + nodeSize * 0.62, nodeSize * 0.16, '#9fc2d4');
        } else if (lv.boss) {
          art.drawAlien(ctx, {
            x: nx + nodeSize / 2, y: ny + nodeSize * 0.66, s: nodeSize * 0.5, dir: 1,
            phase: game.time * 2, shape: 'maw', c1: '#5a1030', c2: '#ff5c4d'
          });
        } else if (lv.petIndex >= 0) {
          var pdef = data.pets[lv.petIndex];
          var have = save.pets.indexOf(pdef.key) >= 0;
          ctx.globalAlpha = have ? 1 : 0.85;
          if (have) {
            art.drawPet(ctx, {
              x: nx + nodeSize / 2, y: ny + nodeSize * 0.66, s: nodeSize * 0.44, dir: 1,
              phase: game.time * 3 + j, c1: pdef.c1, c2: pdef.c2, shape: pdef.shape, acc: pdef.acc, mood: 'ok'
            });
          } else {
            art.drawEgg(ctx, nx + nodeSize / 2, ny + nodeSize * 0.64, nodeSize * 0.2, 0, null, game.time);
          }
        }
        ctx.restore();
      }
    }

    if (ui.button('m-back', 14, H - 56, 130, 42, 'BACK', { icon: 'arrowLeft', iconSize: 11, size: 17 })) game.setScreen('title');
    art.text(ctx, save.pets.length + ' / ' + data.pets.length + ' pets', W / 2, H - 34, {
      size: 15, fill: '#ffe066', stroke: '#04202f', strokeW: 4
    });
    ui.cornerButtons(ctx, W, H - 56);
  };

  /* ---------------------------------------------------------- pet select */

  ui.drawPetSelect = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H, save = game.save;
    var cfg = data.levels[game.pendingLevel];
    game.drawAmbient(ctx);
    ctx.fillStyle = 'rgba(2,14,26,0.6)';
    ctx.fillRect(0, 0, W, H);

    art.text(ctx, 'PICK YOUR PETS', W / 2, 44, { size: 30, fill: '#ffe066', stroke: '#04202f', strokeW: 6 });
    art.text(ctx, cfg.label + ' - ' + cfg.name + '   |   choose up to ' + data.maxPets +
      '   |   selected ' + game.selectedPets.length,
      W / 2, 74, { size: 15, fill: rgba('#dff1ff', 0.85), weight: 'normal' });

    var all = data.pets;
    var cols = clamp(Math.floor((W - 60) / 118), 3, 10);
    var cell = Math.min(118, (W - 60) / cols);
    var rows = Math.ceil(all.length / cols);
    var gridW = cols * cell;
    var gx = (W - gridW) / 2;
    var gy = 100;
    var maxGridH = H - 200;
    var cellH = Math.min(cell, maxGridH / rows);

    for (var i = 0; i < all.length; i++) {
      var pd = all[i];
      var cxi = i % cols, cyi = Math.floor(i / cols);
      var x = gx + cxi * cell + 4, y = gy + cyi * cellH + 4;
      var w = cell - 8, h = cellH - 8;
      var owned = save.pets.indexOf(pd.key) >= 0;
      var sel = game.selectedPets.indexOf(pd.key);
      var id = 'pet-' + pd.key;

      if (owned) {
        if (ui.button(id, x, y, w, h, '', { radius: 12, accent: sel >= 0 ? 'green' : undefined })) {
          game.togglePet(pd.key);
        }
      } else {
        art.panel(ctx, x, y, w, h, {
          radius: 12, top: 'rgba(28,42,54,0.8)', bottom: 'rgba(12,22,32,0.85)',
          strokeColor: 'rgba(120,150,170,0.25)', gloss: false, shadow: false
        });
      }
      ctx.save();
      ctx.globalAlpha = owned ? 1 : 0.35;
      art.drawPet(ctx, {
        x: x + w / 2, y: y + h * 0.42, s: Math.min(w, h) * 0.62, dir: 1,
        phase: game.time * 3 + i, c1: pd.c1, c2: pd.c2, shape: pd.shape, acc: pd.acc, mood: 'ok'
      });
      art.text(ctx, owned ? pd.name : '???', x + w / 2, y + h - 14, {
        size: Math.min(13, w * 0.15), fill: owned ? (sel >= 0 ? '#08290e' : '#eaf7ff') : '#9fc2d4'
      });
      ctx.restore();
      if (!owned) art.icon(ctx, 'lock', x + w / 2, y + h * 0.5, Math.min(w, h) * 0.14, '#9fc2d4');
      if (sel >= 0) {
        art.panel(ctx, x + w - 26, y + 4, 22, 22, { radius: 11, top: '#ffe066', bottom: '#e0a020', gloss: false, shadow: false, strokeColor: '#fff6d0' });
        art.text(ctx, String(sel + 1), x + w - 15, y + 15, { size: 14, fill: '#3a2400' });
      }
      if (owned && !ui.blocked && inRect(ui.pointer, x, y, w, h)) {
        game.petHint = pd;
      }
    }

    /* hint line for the hovered/most recent pet */
    var hint = game.petHint;
    if (hint) {
      art.panel(ctx, W / 2 - Math.min(700, W - 60) / 2, H - 118, Math.min(700, W - 60), 44, {
        radius: 12, top: 'rgba(10,50,74,0.9)', bottom: 'rgba(4,24,38,0.92)', gloss: false, shadow: false
      });
      art.text(ctx, hint.name.toUpperCase() + ' - ' + hint.desc, W / 2, H - 96, {
        size: 15, fill: '#dff1ff', weight: 'normal'
      });
    }

    if (ui.button('ps-back', 14, H - 58, 130, 44, 'BACK', { icon: 'arrowLeft', iconSize: 11, size: 17 })) game.setScreen('map');
    if (ui.button('ps-go', W / 2 - 110, H - 60, 220, 48, 'DIVE IN', { accent: 'gold', size: 22 })) game.startPendingLevel();
    if (save.pets.length === 0) {
      art.text(ctx, 'no pets yet - finish this level to hatch your first', W / 2, H - 74, {
        size: 13, fill: rgba('#dff1ff', 0.6), weight: 'normal'
      });
    }
    ui.cornerButtons(ctx, W, H - 58);
  };

  /* -------------------------------------------------------------- pause */

  ui.drawPause = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H;
    ctx.fillStyle = 'rgba(2,12,22,0.6)';
    ctx.fillRect(0, 0, W, H);
    var w = Math.min(400, W - 40), h = 366;
    var x = (W - w) / 2, y = (H - h) / 2;
    art.panel(ctx, x, y, w, h, { radius: 20 });
    art.text(ctx, 'PAUSED', x + w / 2, y + 44, { size: 32, fill: '#ffe066', stroke: '#04202f', strokeW: 6 });
    var lv = game.level;
    if (lv) {
      art.text(ctx, lv.cfg.label + ' - ' + lv.cfg.name, x + w / 2, y + 76, { size: 15, fill: rgba('#dff1ff', 0.8), weight: 'normal' });
    }
    var by = y + 100, bh = 50, gap = 12;
    if (ui.button('p-resume', x + 30, by, w - 60, bh, 'RESUME', { accent: 'gold', size: 21, icon: 'play', iconSize: 12 })) game.resume();
    by += bh + gap;
    if (ui.button('p-sound', x + 30, by, w - 60, bh, 'SOUND', { size: 19, icon: 'speaker', iconSize: 12, iconExtra: audio.settings.muted })) ui.openSettings();
    by += bh + gap;
    if (ui.button('p-restart', x + 30, by, w - 60, bh, 'RESTART LEVEL', { size: 19 })) game.restartLevel();
    by += bh + gap;
    if (ui.button('p-quit', x + 30, by, w - 60, bh, 'QUIT TO MAP', { size: 19, accent: 'danger' })) game.quitToMap();
  };

  /* ----------------------------------------------------- level complete */

  ui.drawLevelComplete = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H;
    var t = game.animT;
    ctx.fillStyle = 'rgba(2,14,26,' + clamp(t * 1.2, 0, 0.72) + ')';
    ctx.fillRect(0, 0, W, H);

    var pet = game.hatchedPet;
    var cx = W / 2, cy = H * 0.42;

    art.text(ctx, 'LEVEL COMPLETE', cx, H * 0.14, {
      size: clamp(W * 0.035, 26, 44) * clamp(util.easeOutBack(clamp(t / 0.5, 0, 1)), 0.1, 1.3),
      fill: '#ffe066', stroke: '#04202f', strokeW: 7
    });

    if (t < 2.4 || !pet) {
      /* egg descends, shakes, then cracks open */
      var drop = clamp(t / 0.9, 0, 1);
      var ey = lerp(-80, cy, util.easeOutCubic(drop));
      var shake = t > 0.9 ? Math.sin(t * 34) * clamp((t - 0.9) * 6, 0, 7) : 0;
      var cracks = t < 1.3 ? 0 : t < 1.7 ? 1 : t < 2.1 ? 2 : 3;
      art.drawEgg(ctx, cx + shake, ey, clamp(H * 0.11, 54, 96), cracks, null, game.time);
      if (pet) {
        art.text(ctx, 'the egg is hatching...', cx, cy + H * 0.2, { size: 18, fill: '#dff1ff', weight: 'normal' });
      }
    } else {
      var pt = clamp((t - 2.4) / 0.8, 0, 1);
      var s = clamp(H * 0.3, 130, 240) * util.easeOutBack(pt);
      art.drawGlow(ctx, cx, cy, s * 1.35, '#ffe066', 0.42 * (1 - pt * 0.4) + 0.14);
      art.drawPet(ctx, {
        x: cx, y: cy + Math.sin(game.time * 2) * 8, s: s, dir: 1, phase: game.time * 3.4,
        c1: pet.c1, c2: pet.c2, shape: pet.shape, acc: pet.acc, mood: 'ok'
      });
      art.text(ctx, pet.name.toUpperCase() + ' JOINED YOU', cx, cy + s * 0.62 + 30, {
        size: clamp(W * 0.024, 20, 30), fill: '#b7ffb0', stroke: '#04202f', strokeW: 6
      });
      var dw = Math.min(680, W - 60);
      art.panel(ctx, cx - dw / 2, cy + s * 0.62 + 50, dw, 46, {
        radius: 12, top: 'rgba(10,50,74,0.9)', bottom: 'rgba(4,24,38,0.92)', gloss: false, shadow: false
      });
      art.text(ctx, pet.desc, cx, cy + s * 0.62 + 73, { size: 15, fill: '#dff1ff', weight: 'normal' });
    }

    /* run stats */
    var st = game.lastStats;
    if (st && t > 1.2) {
      ctx.save();
      ctx.globalAlpha = clamp((t - 1.2) / 0.6, 0, 1);
      var sy = H - 128;
      var parts = [
        ['collected', util.fmtMoney(st.collected)],
        ['aliens beaten', String(st.killed)],
        ['fish lost', String(st.lost)],
        ['food dropped', String(st.fed)]
      ];
      var pw = Math.min(760, W - 40), px0 = (W - pw) / 2;
      for (var i = 0; i < parts.length; i++) {
        var bx = px0 + (pw / parts.length) * i;
        art.text(ctx, parts[i][1], bx + pw / parts.length / 2, sy, { size: 21, fill: '#ffe066', stroke: '#04202f', strokeW: 5 });
        art.text(ctx, parts[i][0], bx + pw / parts.length / 2, sy + 22, { size: 12, fill: rgba('#dff1ff', 0.75), weight: 'normal' });
      }
      ctx.restore();
    }

    if (t > (pet ? 3.2 : 1.4)) {
      var isLast = game.save.unlocked >= data.levels.length - 1 && game.justFinishedIndex === data.levels.length - 1;
      if (ui.button('lc-next', W / 2 - 130, H - 74, 260, 52, isLast ? 'FINISH' : 'CONTINUE', { accent: 'gold', size: 22 })) {
        game.afterLevelComplete();
      }
      if (ui.button('lc-map', 14, H - 68, 130, 44, 'MAP', { size: 17 })) game.quitToMap();
    }
    ui.cornerButtons(ctx, W, 14);
  };

  /* ------------------------------------------------------------ game over */

  ui.drawGameOver = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H, t = game.animT;
    ctx.fillStyle = 'rgba(24,4,10,' + clamp(t * 1.1, 0, 0.72) + ')';
    ctx.fillRect(0, 0, W, H);
    var pop = clamp(util.easeOutBack(clamp(t / 0.5, 0, 1)), 0.1, 1.3);
    art.text(ctx, 'TANK LOST', W / 2, H * 0.3, {
      size: clamp(W * 0.05, 34, 62) * pop, fill: '#ff9aa2', stroke: '#3a0009', strokeW: 8
    });
    art.icon(ctx, 'skull', W / 2, H * 0.45, clamp(H * 0.06, 26, 46), '#e8eef4');
    var reason = game.failReason === 'broke'
      ? 'every fish died and you could not afford another'
      : 'the tank stayed empty too long';
    art.text(ctx, reason, W / 2, H * 0.56, { size: 17, fill: '#ffd9dd', weight: 'normal' });
    if (game.level) {
      art.text(ctx, game.level.cfg.label + ' - ' + game.level.cfg.name, W / 2, H * 0.61, {
        size: 15, fill: rgba('#ffd9dd', 0.7), weight: 'normal'
      });
    }
    if (t > 0.7) {
      if (ui.button('go-retry', W / 2 - 240, H * 0.72, 220, 52, 'TRY AGAIN', { accent: 'gold', size: 21 })) game.restartLevel();
      if (ui.button('go-map', W / 2 + 20, H * 0.72, 220, 52, 'BACK TO MAP', { size: 21 })) game.quitToMap();
    }
    art.text(ctx, 'tip: keep a few coins in reserve so you can always restock', W / 2, H - 44, {
      size: 13, fill: rgba('#ffd9dd', 0.6), weight: 'normal'
    });
    ui.cornerButtons(ctx, W, 14);
  };

  /* ------------------------------------------------------------------ win */

  ui.drawWin = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H, t = game.animT;

    /* the celebration scene draws itself; this is the overlay */
    var pop = clamp(util.easeOutElastic(clamp(t / 1.5, 0, 1)), 0, 1.2);
    var titleY = H * 0.2;
    ctx.save();
    ctx.translate(W / 2, titleY);
    ctx.scale(pop, pop);
    art.text(ctx, 'AQUARIUM SAVED', 0, 0, {
      size: clamp(W * 0.052, 34, 66), fill: '#ffe066', stroke: '#3a2400', strokeW: 9,
      shadow: 'rgba(255,220,120,0.8)', shadowBlur: 30
    });
    ctx.restore();

    if (t > 0.9) {
      ctx.save();
      ctx.globalAlpha = clamp((t - 0.9) / 0.8, 0, 1);
      art.text(ctx, 'THE MAW IS BEATEN. EVERY PET IS HOME.', W / 2, titleY + clamp(W * 0.042, 30, 54), {
        size: clamp(W * 0.018, 15, 22), fill: '#cdf6ff', stroke: '#04263b', strokeW: 5
      });
      ctx.restore();
    }

    if (t > 1.4) {
      var ty = H * 0.42;
      ctx.save();
      ctx.globalAlpha = clamp((t - 1.4) / 0.7, 0, 1);
      var ts = clamp(H * 0.1, 48, 92) * (1 + Math.sin(game.time * 2) * 0.03);
      art.icon(ctx, 'trophy', W / 2, ty, ts, '#ffd257');
      ctx.restore();
    }

    if (t > 2.2) {
      ctx.save();
      ctx.globalAlpha = clamp((t - 2.2) / 0.8, 0, 1);
      var st = game.save.totals;
      var lines = [
        'pets hatched: ' + game.save.pets.length + ' of ' + data.pets.length,
        'money collected: ' + util.fmtMoney(st.collected),
        'aliens beaten: ' + st.killed,
        'fish lost along the way: ' + st.lost
      ];
      var lw = Math.min(560, W - 60), lh = 40 + lines.length * 26;
      var lx = W / 2 - lw / 2, ly = H * 0.56;
      art.panel(ctx, lx, ly, lw, lh, { radius: 16, top: 'rgba(10,50,74,0.86)', bottom: 'rgba(4,24,38,0.9)' });
      art.text(ctx, 'FINAL LOG', W / 2, ly + 24, { size: 17, fill: '#ffe066' });
      for (var i = 0; i < lines.length; i++) {
        art.text(ctx, lines[i], W / 2, ly + 50 + i * 26, { size: 15, fill: '#dff1ff', weight: 'normal' });
      }
      ctx.restore();
    }

    if (t > 3.4) {
      if (ui.button('w-map', W / 2 - 230, H - 96, 220, 52, 'FREE PLAY', { size: 20 })) game.quitToMap();
      if (ui.button('w-title', W / 2 + 10, H - 96, 220, 52, 'TITLE SCREEN', { accent: 'gold', size: 20 })) {
        game.setScreen('title');
        audio.music('loop');
      }
      art.text(ctx, 'thanks for playing - every level stays open for another run', W / 2, H - 28, {
        size: 13, fill: rgba('#dff1ff', 0.7), weight: 'normal'
      });
    }
    ui.cornerButtons(ctx, W, 14);
  };

  /* ----------------------------------------------------------- confirm box */

  ui.drawConfirm = function (ctx, game) {
    ui.ctx = ctx;
    var W = game.W, H = game.H, c = game.confirm;
    if (!c) return;
    ctx.fillStyle = 'rgba(2,12,22,0.66)';
    ctx.fillRect(0, 0, W, H);
    var w = Math.min(440, W - 40), h = 200;
    var x = (W - w) / 2, y = (H - h) / 2;
    art.panel(ctx, x, y, w, h, { radius: 18 });
    art.text(ctx, c.title, x + w / 2, y + 44, { size: 24, fill: '#ffe066', stroke: '#04202f', strokeW: 5 });
    art.text(ctx, c.body, x + w / 2, y + 84, { size: 15, fill: '#dff1ff', weight: 'normal' });
    if (ui.button('cf-no', x + 26, y + h - 68, (w - 68) / 2, 46, 'CANCEL', { size: 18 })) game.confirm = null;
    if (ui.button('cf-yes', x + 42 + (w - 68) / 2, y + h - 68, (w - 68) / 2, 46, c.yes || 'CONFIRM', { size: 18, accent: 'danger' })) {
      var fn = c.onYes;
      game.confirm = null;
      if (fn) fn();
    }
  };

  CQ.ui = ui;
})();
