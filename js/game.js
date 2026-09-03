/* Crazee-quarium :: game.js
 * Screens, progression, autosave and the celebration sequence.
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util, art = CQ.art, data = CQ.data, ent = CQ.ent, ui = CQ.ui, audio = CQ.audio;
  var clamp = util.clamp, rand = util.rand;

  var SAVE_KEY = 'crazeequarium.save.v1';
  var SAVE_VERSION = 1;

  function defaultSave() {
    return {
      v: SAVE_VERSION,
      unlocked: 0,
      pets: [],
      loadout: [],
      won: false,
      totals: { collected: 0, killed: 0, lost: 0, fed: 0, spent: 0, fails: 0, wins: 0 },
      session: null,
      updated: 0
    };
  }

  function Game(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.W = canvas.width;
    this.H = canvas.height;
    this.time = 0;
    this.animT = 0;
    this.screen = 'title';
    this.level = null;
    this.paused = false;
    this.confirm = null;
    this.pendingLevel = 0;
    this.selectedPets = [];
    this.hatchedPet = null;
    this.lastStats = null;
    this.failReason = '';
    this.justFinishedIndex = -1;
    this.petHint = null;
    this.saveTimer = 0;
    this.pointer = { x: -1, y: -1, down: false, justDown: false, justUp: false };
    this.winFx = [];
    this.winPets = [];
    this.fireworkTimer = 0;

    this.save = this.loadSave();
    this.ambient = null;
  }

  /* ------------------------------------------------------------- persistence */

  Game.prototype.loadSave = function () {
    var s = CQ.storage.load(SAVE_KEY, null);
    var def = defaultSave();
    if (!s || s.v !== SAVE_VERSION) return def;
    /* merge defensively: a save from an older build must not crash the game */
    var out = def;
    out.unlocked = clamp(s.unlocked | 0, 0, data.levels.length - 1);
    out.won = !!s.won;
    out.pets = [];
    if (s.pets && s.pets.length) {
      for (var i = 0; i < s.pets.length; i++) {
        if (data.petByKey(s.pets[i]) && out.pets.indexOf(s.pets[i]) < 0) out.pets.push(s.pets[i]);
      }
    }
    out.loadout = [];
    if (s.loadout && s.loadout.length) {
      for (var j = 0; j < s.loadout.length; j++) {
        if (out.pets.indexOf(s.loadout[j]) >= 0 && out.loadout.length < data.maxPets) out.loadout.push(s.loadout[j]);
      }
    }
    if (s.totals) {
      for (var k in out.totals) {
        if (typeof s.totals[k] === 'number') out.totals[k] = s.totals[k];
      }
    }
    out.session = s.session && typeof s.session.level === 'number' ? s.session : null;
    return out;
  };

  Game.prototype.persist = function (includeSession) {
    if (includeSession && this.level && this.screen === 'game' && this.level.state === 'playing') {
      this.save.session = this.level.serialize();
    }
    this.save.updated = Date.now();
    CQ.storage.save(SAVE_KEY, this.save);
  };

  Game.prototype.clearSession = function () {
    this.save.session = null;
    this.persist(false);
  };

  Game.prototype.confirmReset = function () {
    var self = this;
    this.confirm = {
      title: 'RESET PROGRESS?',
      body: 'Every pet and unlocked level will be erased.',
      yes: 'ERASE',
      onYes: function () {
        CQ.storage.remove(SAVE_KEY);
        self.save = defaultSave();
        self.level = null;
        self.selectedPets = [];
        self.setScreen('title');
        audio.play('back');
      }
    };
  };

  /* ------------------------------------------------------------------ layout */

  function shopCountFor(cfg) {
    return (cfg && cfg.shop ? cfg.shop.length : 0) + (cfg && cfg.boss ? 0 : 1);
  }

  /* Single source of truth for the HUD/shop bar sizes. */
  Game.prototype.metrics = function () {
    return ui.metrics(this.W, this.H, this.level ? shopCountFor(this.level.cfg) : 8);
  };

  Game.prototype.resize = function (W, H) {
    this.W = W; this.H = H;
    this.ambient = null;
    if (this.level) {
      var m = this.metrics();
      this.level.resize(W, H, m.hudH, m.shopH);
    }
  };

  Game.prototype.ensureAmbient = function () {
    if (this.ambient && this.ambient.W === this.W && this.ambient.H === this.H) return this.ambient;
    var theme = this.save.won ? 0 : clamp(Math.floor(this.save.unlocked / 5), 0, 4);
    var decor = art.makeDecor(this.W, this.H, theme);
    var fish = [];
    var species = ['guppy', 'guppy', 'guppy', 'carnivore', 'breeder', 'muncher', 'cruncher'];
    for (var i = 0; i < 9; i++) {
      var sp = species[i % species.length];
      var def = data.fish[sp];
      fish.push({
        def: def,
        x: rand(0, this.W), y: rand(decor.floorY * 0.25, decor.floorY - 40),
        vx: rand(28, 62) * (util.chance(0.5) ? 1 : -1),
        vy: 0, phase: rand(0, util.TAU),
        s: def.stages[def.stages.length - 1].size * rand(0.62, 1.05),
        stage: def.stages.length - 1
      });
    }
    var pets = [];
    for (var p = 0; p < this.save.pets.length; p++) {
      var pd = data.petByKey(this.save.pets[p]);
      if (!pd) continue;
      pets.push({
        def: pd, x: rand(0, this.W), y: rand(decor.floorY * 0.3, decor.floorY - 30),
        vx: rand(24, 54) * (util.chance(0.5) ? 1 : -1), phase: rand(0, util.TAU),
        s: pd.size * rand(0.7, 1)
      });
    }
    this.ambient = { W: this.W, H: this.H, decor: decor, fish: fish, pets: pets };
    return this.ambient;
  };

  Game.prototype.updateAmbient = function (dt) {
    var a = this.ensureAmbient();
    var all = a.fish.concat(a.pets);
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      f.phase += dt * 4;
      f.x += f.vx * dt;
      f.y += Math.sin(f.phase * 0.32) * 12 * dt;
      var pad = f.s;
      if (f.x < -pad) { f.x = this.W + pad; f.y = rand(a.decor.floorY * 0.25, a.decor.floorY - 40); }
      if (f.x > this.W + pad) { f.x = -pad; f.y = rand(a.decor.floorY * 0.25, a.decor.floorY - 40); }
      f.y = clamp(f.y, 40, a.decor.floorY - 20);
    }
  };

  Game.prototype.drawAmbient = function (ctx) {
    var a = this.ensureAmbient();
    art.drawBackground(ctx, a.decor, this.time);
    var i;
    for (i = 0; i < a.fish.length; i++) {
      var f = a.fish[i];
      art.drawFish(ctx, {
        x: f.x, y: f.y, s: f.s, dir: f.vx > 0 ? 1 : -1, phase: f.phase,
        c1: f.def.c1, c2: f.def.c2, shape: f.def.shape, mood: 'ok',
        pattern: 'stripes', seed: i * 13
      });
    }
    for (i = 0; i < a.pets.length; i++) {
      var p = a.pets[i];
      art.drawPet(ctx, {
        x: p.x, y: p.y, s: p.s, dir: p.vx > 0 ? 1 : -1, phase: p.phase,
        c1: p.def.c1, c2: p.def.c2, shape: p.def.shape, acc: p.def.acc, mood: 'ok'
      });
    }
    art.drawGlass(ctx, this.W, this.H, this.time);
  };

  /* ------------------------------------------------------------------ flow */

  Game.prototype.setScreen = function (name) {
    this.screen = name;
    this.animT = 0;
    this.paused = false;
    ui.tooltip = null;
    if (name !== 'game') this.petHint = null;
    if (name === 'title' || name === 'map') this.ensureAmbient();
  };

  Game.prototype.playFromSave = function () {
    if (this.save.session) {
      this.resumeSession();
    } else {
      this.chooseLevel(this.save.unlocked);
    }
  };

  Game.prototype.chooseLevel = function (index) {
    index = clamp(index, 0, data.levels.length - 1);
    if (index > this.save.unlocked) return;
    this.pendingLevel = index;
    this.selectedPets = [];
    for (var i = 0; i < this.save.loadout.length; i++) {
      if (this.save.pets.indexOf(this.save.loadout[i]) >= 0) this.selectedPets.push(this.save.loadout[i]);
    }
    if (!this.save.pets.length) {
      this.startPendingLevel();
      return;
    }
    /* offer the newest pet if nothing is picked yet */
    if (!this.selectedPets.length) {
      this.selectedPets = this.save.pets.slice(Math.max(0, this.save.pets.length - data.maxPets));
    }
    this.petHint = data.petByKey(this.selectedPets[this.selectedPets.length - 1]) || null;
    this.setScreen('petselect');
  };

  Game.prototype.togglePet = function (key) {
    var i = this.selectedPets.indexOf(key);
    if (i >= 0) this.selectedPets.splice(i, 1);
    else {
      if (this.selectedPets.length >= data.maxPets) {
        this.selectedPets.shift();
      }
      this.selectedPets.push(key);
    }
    this.petHint = data.petByKey(key);
    this.save.loadout = this.selectedPets.slice();
    this.persist(false);
  };

  Game.prototype.startLevel = function (index, petKeys, sessionData) {
    index = clamp(index, 0, data.levels.length - 1);
    var cfg = data.levels[index];
    var m = ui.metrics(this.W, this.H, shopCountFor(cfg));
    var level = new CQ.Level(this, cfg, petKeys);
    level.resize(this.W, this.H, m.hudH, m.shopH);
    level.start();
    if (sessionData) level.restore(sessionData);
    this.level = level;
    this.failReason = '';
    this.setScreen('game');
    audio.music('loop');
    this.persist(true);
    return level;
  };

  Game.prototype.startPendingLevel = function () {
    this.save.loadout = this.selectedPets.slice();
    this.startLevel(this.pendingLevel, this.selectedPets);
  };

  Game.prototype.resumeSession = function () {
    var s = this.save.session;
    if (!s) { this.chooseLevel(this.save.unlocked); return; }
    var pets = [];
    for (var i = 0; i < (s.pets || []).length; i++) {
      if (this.save.pets.indexOf(s.pets[i]) >= 0) pets.push(s.pets[i]);
    }
    this.startLevel(s.level, pets, s);
  };

  Game.prototype.pause = function () {
    if (this.screen !== 'game') return;
    this.paused = true;
    audio.play('click');
    this.persist(true);
  };
  Game.prototype.resume = function () {
    this.paused = false;
    audio.play('click');
  };
  Game.prototype.restartLevel = function () {
    var idx = this.level ? this.level.cfg.index : this.pendingLevel;
    var pets = this.level ? this.level.petKeys : this.selectedPets;
    this.clearSession();
    this.startLevel(idx, pets);
  };
  Game.prototype.quitToMap = function () {
    this.clearSession();
    this.level = null;
    this.setScreen('map');
    audio.music('loop');
  };

  Game.prototype.onLevelComplete = function (level) {
    this.justFinishedIndex = level.cfg.index;
    this.lastStats = level.stats;
    var t = this.save.totals;
    t.collected += level.stats.collected;
    t.killed += level.stats.killed;
    t.lost += level.stats.lost;
    t.fed += level.stats.fed;
    t.spent += level.stats.spent;

    /* unlock the next level and hatch this level's pet */
    if (level.cfg.index + 1 > this.save.unlocked && level.cfg.index + 1 < data.levels.length) {
      this.save.unlocked = level.cfg.index + 1;
    }
    this.hatchedPet = null;
    if (level.cfg.petIndex >= 0) {
      var pd = data.pets[level.cfg.petIndex];
      if (pd && this.save.pets.indexOf(pd.key) < 0) this.save.pets.push(pd.key);
      this.hatchedPet = pd;
    }
    this.save.session = null;
    this.persist(false);

    if (level.cfg.boss) {
      this.triggerWin();
    } else {
      this.setScreen('levelcomplete');
    }
  };

  Game.prototype.afterLevelComplete = function () {
    var next = this.justFinishedIndex + 1;
    this.level = null;
    if (next >= data.levels.length) {
      this.setScreen('map');
      return;
    }
    if (next <= this.save.unlocked) this.chooseLevel(next);
    else this.setScreen('map');
  };

  Game.prototype.onLevelFailed = function (level, reason) {
    this.failReason = reason;
    this.save.totals.fails++;
    this.save.session = null;
    this.persist(false);
    this.setScreen('gameover');
  };

  /* ------------------------------------------------------------------- win */

  Game.prototype.triggerWin = function () {
    this.save.won = true;
    this.save.totals.wins++;
    this.save.session = null;
    this.persist(false);
    this.setScreen('win');
    this.winFx = [];
    this.fireworkTimer = 0;
    this.ambient = null;
    this.buildWinPets();
    audio.music('end');
    audio.play('fanfare');
  };

  Game.prototype.buildWinPets = function () {
    this.winPets = [];
    var keys = this.save.pets.length ? this.save.pets : data.pets.map(function (p) { return p.key; });
    for (var i = 0; i < keys.length; i++) {
      var pd = data.petByKey(keys[i]);
      if (!pd) continue;
      this.winPets.push({
        def: pd,
        x: rand(-200, this.W + 200),
        y: rand(this.H * 0.25, this.H * 0.8),
        vx: rand(40, 90) * (util.chance(0.5) ? 1 : -1),
        phase: rand(0, util.TAU),
        s: pd.size * rand(0.7, 1.05),
        bob: rand(0, util.TAU)
      });
    }
  };

  Game.prototype.updateWin = function (dt) {
    var i;
    this.ensureAmbient();
    this.updateAmbient(dt);
    if (!this.winPets.length) this.buildWinPets();
    for (i = 0; i < this.winPets.length; i++) {
      var p = this.winPets[i];
      p.phase += dt * 4;
      p.bob += dt * 1.6;
      p.x += p.vx * dt;
      p.y += Math.sin(p.bob) * 20 * dt;
      if (p.x < -220) p.x = this.W + 220;
      if (p.x > this.W + 220) p.x = -220;
      p.y = clamp(p.y, this.H * 0.16, this.H * 0.86);
    }

    /* confetti rain */
    if (this.winFx.length < 260) {
      for (i = 0; i < 3; i++) {
        this.winFx.push(new ent.Particle(null, rand(0, this.W), -20, {
          vx: rand(-40, 40), vy: rand(40, 130), g: 34, life: rand(3.5, 6.5),
          size: rand(3, 6), color: util.pick(['#ffd257', '#8ff0ff', '#ff8fb1', '#b7ffb0', '#ffffff', '#c86ad6']),
          kind: 'confetti', drag: 0.2
        }));
      }
    }
    /* fireworks */
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0 && this.animT > 0.6) {
      this.fireworkTimer = rand(0.55, 1.3);
      var fx = rand(this.W * 0.12, this.W * 0.88), fy = rand(this.H * 0.12, this.H * 0.55);
      var col = util.pick(['#ffd257', '#8ff0ff', '#ff8fb1', '#b7ffb0', '#ffe066', '#c86ad6']);
      for (i = 0; i < 46; i++) {
        var a = (i / 46) * util.TAU + rand(-0.06, 0.06);
        var sp = rand(90, 300);
        this.winFx.push(new ent.Particle(null, fx, fy, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 90, life: rand(0.7, 1.5),
          size: rand(2.5, 4.5), color: col, kind: 'spark', drag: 1.1
        }));
      }
      for (i = 0; i < 3; i++) {
        this.winFx.push(new ent.Particle(null, fx, fy, {
          vx: 0, vy: 0, g: 0, life: 0.35 + i * 0.1, size: 26 + i * 16, color: col, kind: 'ring'
        }));
      }
      audio.play(util.chance(0.4) ? 'sparkle' : 'coin_big');
    }
    for (i = 0; i < this.winFx.length; i++) this.winFx[i].update(dt);
    var keep = [];
    for (i = 0; i < this.winFx.length; i++) {
      var f = this.winFx[i];
      if (!f.dead && f.y < this.H + 40) keep.push(f);
    }
    this.winFx = keep;
  };

  Game.prototype.drawWinScene = function (ctx) {
    var a = this.ensureAmbient();
    art.drawBackground(ctx, a.decor, this.time);
    var i;
    for (i = 0; i < a.fish.length; i++) {
      var f = a.fish[i];
      art.drawFish(ctx, {
        x: f.x, y: f.y, s: f.s, dir: f.vx > 0 ? 1 : -1, phase: f.phase,
        c1: f.def.c1, c2: f.def.c2, shape: f.def.shape, mood: 'ok', pattern: 'stripes', seed: i * 7
      });
    }
    for (i = 0; i < this.winPets.length; i++) {
      var p = this.winPets[i];
      art.drawPet(ctx, {
        x: p.x, y: p.y, s: p.s, dir: p.vx > 0 ? 1 : -1, phase: p.phase,
        c1: p.def.c1, c2: p.def.c2, shape: p.def.shape, acc: p.def.acc, mood: 'ok',
        tilt: Math.sin(p.bob) * 0.1
      });
    }
    for (i = 0; i < this.winFx.length; i++) this.winFx[i].draw(ctx);
    art.drawGlass(ctx, this.W, this.H, this.time);
  };

  /* ---------------------------------------------------------------- update */

  Game.prototype.update = function (dt) {
    this.time += dt;
    this.animT += dt;
    var blocked = ui.settingsOpen || !!this.confirm;

    if (this.screen === 'game' && this.level) {
      if (!this.paused && !blocked) {
        this.level.update(dt);
        var p = this.pointer;
        if (p.down && this.level.state === 'playing') {
          var m = this.metrics();
          if (p.y > m.hudH + 2 && p.y < this.H - m.shopH - 2) {
            this.level.pointerAction(p.x, p.y, !p.justDown);
          }
        }
        this.saveTimer -= dt;
        if (this.saveTimer <= 0) {
          this.saveTimer = 4;
          this.persist(true);
        }
      }
    } else if (this.screen === 'win') {
      this.updateWin(dt);
    } else if (this.screen === 'title' || this.screen === 'map' || this.screen === 'petselect' || this.screen === 'howto') {
      this.updateAmbient(dt);
    } else if (this.screen === 'levelcomplete' || this.screen === 'gameover') {
      if (this.level) {
        /* keep the tank alive behind the panel, minus the danger */
        this.level.update(Math.min(dt, 0.033));
      }
    }
  };

  /* ------------------------------------------------------------------ draw */

  Game.prototype.draw = function (ctx) {
    var W = this.W, H = this.H;
    var overlay = ui.settingsOpen ? 'settings' : (this.confirm ? 'confirm' : (this.paused && this.screen === 'game' ? 'pause' : null));
    ui.blocked = overlay !== null;
    ui.ctx = ctx;

    switch (this.screen) {
      case 'title': ui.drawTitle(ctx, this); break;
      case 'howto': ui.drawHowTo(ctx, this); break;
      case 'map': ui.drawMap(ctx, this); break;
      case 'petselect': ui.drawPetSelect(ctx, this); break;
      case 'game':
        if (this.level) {
          this.level.draw(ctx);
          ui.drawHud(ctx, this, this.level);
          ui.drawShop(ctx, this, this.level);
          ui.drawTooltip(ctx, W);
        }
        break;
      case 'levelcomplete':
        if (this.level) { this.level.draw(ctx); }
        else this.drawAmbient(ctx);
        ui.drawLevelComplete(ctx, this);
        break;
      case 'gameover':
        if (this.level) { this.level.draw(ctx); }
        else this.drawAmbient(ctx);
        ui.drawGameOver(ctx, this);
        break;
      case 'win':
        this.drawWinScene(ctx);
        ui.drawWin(ctx, this);
        break;
      default:
        ui.drawTitle(ctx, this);
    }

    if (this.paused && this.screen === 'game') {
      ui.blocked = overlay !== 'pause';
      ui.drawPause(ctx, this);
    }
    if (this.confirm) {
      ui.blocked = overlay !== 'confirm';
      ui.drawConfirm(ctx, this);
    }
    ui.blocked = false;
    ui.drawSettings(ctx, W, H);
  };

  /* ------------------------------------------------------------------ keys */

  Game.prototype.key = function (code) {
    if (code === 'Escape') {
      if (ui.settingsOpen) { ui.closeSettings(); return; }
      if (this.confirm) { this.confirm = null; return; }
      if (this.screen === 'game') { if (this.paused) this.resume(); else this.pause(); return; }
      if (this.screen === 'howto' || this.screen === 'petselect') { this.setScreen(this.screen === 'petselect' ? 'map' : 'title'); return; }
      if (this.screen === 'map') { this.setScreen('title'); return; }
      return;
    }
    if (code === 'KeyS') {
      if (ui.settingsOpen) ui.closeSettings(); else ui.openSettings();
      return;
    }
    if (code === 'KeyM') { audio.toggleMuted(); return; }
    if (code === 'Space' || code === 'KeyP') {
      if (this.screen === 'game' && !ui.settingsOpen && !this.confirm) {
        if (this.paused) this.resume(); else this.pause();
      }
      return;
    }
    if (code === 'Enter') {
      if (this.screen === 'title') this.playFromSave();
      else if (this.screen === 'petselect') this.startPendingLevel();
      else if (this.screen === 'levelcomplete' && this.animT > 1.4) this.afterLevelComplete();
      else if (this.screen === 'gameover' && this.animT > 0.7) this.restartLevel();
    }
  };

  CQ.Game = Game;

  /* --------------------------------------------------------------- dev api
   * Exposed so the whole 21-level ladder can be exercised quickly, by hand or
   * from an automated pass. Harmless to ship: nothing here runs on its own.
   */
  CQ.dev = {
    game: null,
    money: function (n) { if (CQ.dev.game.level) CQ.dev.game.level.money += (n === undefined ? 10000 : n); },
    fish: function (n) {
      var lv = CQ.dev.game.level;
      if (!lv) return;
      for (var i = 0; i < (n || 1); i++) lv.spawnFish('guppy', rand(lv.bounds.l + 60, lv.bounds.r - 60), rand(lv.bounds.t + 60, lv.floorY - 60), 2);
    },
    feed: function (n) {
      var lv = CQ.dev.game.level;
      if (!lv) return;
      for (var i = 0; i < (n || 5); i++) lv.spawnFood(rand(lv.bounds.l + 40, lv.bounds.r - 40), lv.bounds.t + 20, true);
    },
    buyEggs: function () {
      var lv = CQ.dev.game.level;
      if (!lv) return;
      var list = lv.shopList();
      for (var i = 0; i < list.length; i++) {
        if (list[i].kind === 'egg') {
          while (lv.eggPieces < 3 && lv.state === 'playing') {
            lv.money = Math.max(lv.money, lv.cfg.eggPrice);
            lv.buy(lv.shopList()[i]);
          }
        }
      }
    },
    killAliens: function () {
      var lv = CQ.dev.game.level;
      if (!lv) return;
      for (var i = 0; i < lv.aliens.length; i++) lv.aliens[i].kill();
    },
    spawnAlien: function (key) { if (CQ.dev.game.level) CQ.dev.game.level.spawnAlien(key || 'gnasher'); },
    winLevel: function () {
      var lv = CQ.dev.game.level;
      if (!lv) return;
      if (lv.cfg.boss) {
        var found = false;
        for (var i = 0; i < lv.aliens.length; i++) {
          if (lv.aliens[i].def.ai === 'boss') { lv.aliens[i].hp = 0; lv.aliens[i].kill(); found = true; }
        }
        if (!found) { lv.bossTimer = 0.01; }
      } else {
        CQ.dev.buyEggs();
      }
    },
    unlockAll: function () {
      var g = CQ.dev.game;
      g.save.unlocked = data.levels.length - 1;
      g.save.pets = data.pets.map(function (p) { return p.key; });
      g.persist(false);
      g.ambient = null;
    },
    goto: function (i) {
      var g = CQ.dev.game;
      g.save.unlocked = Math.max(g.save.unlocked, clamp(i, 0, data.levels.length - 1));
      g.clearSession();
      g.startLevel(i, g.save.pets.slice(0, data.maxPets));
    },
    state: function () {
      var g = CQ.dev.game, lv = g.level;
      return {
        screen: g.screen, paused: g.paused, settings: ui.settingsOpen,
        level: lv ? lv.cfg.label : null,
        money: lv ? Math.round(lv.money) : null,
        eggs: lv ? lv.eggPieces : null,
        fish: lv ? lv.fishCount() : null,
        aliens: lv ? lv.aliens.length : null,
        drops: lv ? lv.drops.length : null,
        state: lv ? lv.state : null,
        unlocked: g.save.unlocked, pets: g.save.pets.length, won: g.save.won
      };
    }
  };
})();
