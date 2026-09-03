/* Crazee-quarium :: level.js
 * One playable tank: economy, spawning, the shop, win/lose rules and the world render.
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util, art = CQ.art, data = CQ.data, ent = CQ.ent, audio = CQ.audio;
  var clamp = util.clamp, rand = util.rand;

  function Level(game, cfg, petKeys) {
    this.game = game;
    this.cfg = cfg;
    this.theme = data.tanks[cfg.tank].theme;
    this.petKeys = (petKeys || []).slice(0, data.maxPets);

    this.money = cfg.startMoney;
    this.upg = { food: 1, maxfood: 1, laser: 1 };
    this.eggPieces = 0;
    this.purchases = {};

    this.fish = [];
    this.pets = [];
    this.aliens = [];
    this.drops = [];
    this.foods = [];
    this.projectiles = [];
    this.particles = [];
    this.pops = [];
    this.beams = [];

    this.time = 0;
    this.alienTimer = cfg.aliens && cfg.aliens.length ? (cfg.alienStart || 45) : Infinity;
    this.bossTimer = cfg.boss ? (cfg.bossStart || 20) : Infinity;
    this.bossAlive = false;
    this.bossBeaten = false;
    this.state = 'playing';
    this.emptyTankTimer = 0;
    this.feedCooldown = 0;
    this.fireCooldown = 0;
    this.alarm = 0;
    this.shakeAmt = 0;
    this.warned = false;
    this.tipTimer = 11;

    this.boost = { nutrition: 0, drops: 0 };
    this.alienSlow = 1;

    this.stats = { collected: 0, lost: 0, killed: 0, aliens: 0, fed: 0, spent: 0 };

    this.W = 1280; this.H = 720;
    this.scale = 1;
    this.bounds = { l: 0, t: 0, r: 1280, b: 720 };
    this.floorY = 640;
    this.decor = null;
  }

  /* ------------------------------------------------------------------ setup */

  Level.prototype.resize = function (W, H, hudH, shopH) {
    this.W = W; this.H = H;
    this.scale = clamp(Math.min(W / 1280, H / 760), 0.58, 1.45);
    /* keep the sea floor above the shop bar so the sand, pebbles and plants show */
    var sandBand = clamp(H * 0.07, 38, 76);
    var floorY = Math.max(H * 0.45, H - shopH - sandBand);
    this.decor = art.makeDecor(W, H, this.theme, floorY);
    this.floorY = floorY + Math.min(20, sandBand * 0.4);
    this.bounds = {
      l: 14,
      t: hudH + 12,
      r: W - 14,
      b: Math.max(hudH + 90, this.floorY - 6)
    };
    this.shopTop = H - shopH;
    /* pull everything back inside the new box */
    var b = this.bounds, all = this.fish.concat(this.pets, this.aliens, this.drops, this.foods);
    for (var i = 0; i < all.length; i++) {
      all[i].x = clamp(all[i].x, b.l + 8, b.r - 8);
      all[i].y = clamp(all[i].y, b.t + 8, this.floorY - 4);
    }
  };

  Level.prototype.start = function () {
    var b = this.bounds, i, j;
    for (i = 0; i < this.cfg.startFish.length; i++) {
      var sf = this.cfg.startFish[i];
      for (j = 0; j < sf.count; j++) {
        this.spawnFish(sf.species, rand(b.l + 90, b.r - 90), rand(b.t + 60, this.floorY - 60), sf.stage || 0, true);
      }
    }
    for (i = 0; i < this.petKeys.length; i++) {
      var pd = data.petByKey(this.petKeys[i]);
      if (pd) this.pets.push(new ent.Pet(this, pd));
    }
    this.applyPetPassives();
  };

  Level.prototype.applyPetPassives = function () {
    this.boost = { nutrition: 0, drops: 0 };
    this.alienSlow = 1;
    for (var i = 0; i < this.pets.length; i++) {
      var a = this.pets[i].ability;
      if (a.kind === 'boost') {
        this.boost.nutrition += a.nutrition;
        this.boost.drops += a.drops;
      } else if (a.kind === 'oracle') {
        this.alienSlow *= a.slow;
      }
    }
  };
  Level.prototype.hasPet = function (key) {
    for (var i = 0; i < this.pets.length; i++) if (this.pets[i].def.key === key) return true;
    return false;
  };

  /* -------------------------------------------------------------- spawn api */

  Level.prototype.spawnFish = function (species, x, y, stage, quiet) {
    var f = new ent.Fish(this, species, x, y, stage || 0);
    this.fish.push(f);
    if (!quiet) this.burst(x, y, { count: 8, color: '#bff0ff', speed: 90, size: 3, kind: 'bubble' });
    return f;
  };
  Level.prototype.spawnDrop = function (type, x, y, opts) {
    var d = new ent.Drop(this, type, x, y, opts);
    this.drops.push(d);
    return d;
  };
  Level.prototype.spawnFood = function (x, y, free) {
    var f = new ent.Food(this, x, y, this.upg.food, free);
    this.foods.push(f);
    this.stats.fed++;
    audio.play('food');
    this.burst(x, y, { count: 4, color: '#cdf6ff', speed: 60, size: 2.4, kind: 'bubble' });
    return f;
  };
  Level.prototype.spawnAlien = function (key) {
    var hpMul = this.cfg.alienHp || 1;
    var a = new ent.Alien(this, key, hpMul);
    this.aliens.push(a);
    return a;
  };
  Level.prototype.burst = function (x, y, o) {
    var n = o.count || 8;
    for (var i = 0; i < n; i++) {
      var a = rand(0, util.TAU), sp = rand(0.35, 1) * (o.speed || 120);
      this.particles.push(new ent.Particle(this, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.kind === 'bubble' ? 40 : 0),
        g: o.kind === 'bubble' ? -60 : (o.g === undefined ? 110 : o.g),
        life: rand(0.3, 0.85), size: (o.size || 3) * rand(0.6, 1.3),
        color: o.color || '#ffe066', kind: o.kind || 'spark'
      }));
    }
  };
  Level.prototype.ring = function (x, y, r, color) {
    for (var i = 0; i < 3; i++) {
      this.particles.push(new ent.Particle(this, x, y, {
        vx: 0, vy: 0, g: 0, life: 0.32 + i * 0.08, size: r * (0.25 + i * 0.1),
        color: color || '#ffffff', kind: 'ring'
      }));
    }
  };
  Level.prototype.pop = function (text, x, y, color, size) {
    this.pops.push(new ent.TextPop(x, y, text, color, size));
  };
  Level.prototype.beam = function (x1, y1, x2, y2, kind, color) {
    this.beams.push(new ent.Beam(x1, y1, x2, y2, kind, color));
  };
  Level.prototype.shake = function (amt) {
    this.shakeAmt = Math.min(34, this.shakeAmt + amt);
  };
  Level.prototype.addMoney = function (n, x, y, showPop) {
    this.money += n;
    if (showPop && x !== undefined) this.pop('+' + util.fmtMoney(n), x, y - 10, '#ffe066');
  };

  /* ------------------------------------------------------------- queries */

  Level.prototype.fishCount = function () {
    var n = 0;
    for (var i = 0; i < this.fish.length; i++) if (!this.fish[i].dead && !this.fish[i].dying) n++;
    return n;
  };
  Level.prototype.randomFish = function () {
    var live = [];
    for (var i = 0; i < this.fish.length; i++) if (!this.fish[i].dead && !this.fish[i].dying) live.push(this.fish[i]);
    return live.length ? util.pick(live) : null;
  };
  Level.prototype.laserDamage = function () {
    return data.upgrades.laser.damage[this.upg.laser - 1];
  };
  Level.prototype.maxFood = function () {
    return data.upgrades.maxfood.values[this.upg.maxfood - 1];
  };
  Level.prototype.paidFoodCount = function () {
    var n = 0;
    for (var i = 0; i < this.foods.length; i++) if (!this.foods[i].dead && !this.foods[i].free) n++;
    return n;
  };

  /* ---------------------------------------------------------------- shop */

  Level.prototype.priceMul = function () { return 1 + this.cfg.tank * 0.34; };

  /* Each purchase costs more, but the price stops climbing so a late-level
   * restock is always within reach. */
  Level.prototype.fishPrice = function (species) {
    var def = data.fish[species];
    var bought = this.purchases[species] || 0;
    return Math.round(Math.min(def.price + def.priceStep * bought, def.price * 4));
  };

  Level.prototype.shopList = function () {
    var out = [], i;
    var order = this.cfg.shop || [];
    for (i = 0; i < order.length; i++) {
      var key = order[i];
      if (data.upgrades[key]) {
        var u = data.upgrades[key];
        var lv = this.upg[key];
        var maxed = lv >= u.max;
        var price = maxed ? 0 : Math.round(u.prices[lv] * this.priceMul());
        var sub = '';
        if (key === 'food') sub = u.tiers[lv - 1].label;
        else if (key === 'maxfood') sub = u.values[lv - 1] + ' max';
        else if (key === 'laser') sub = 'dmg ' + u.damage[lv - 1];
        out.push({
          kind: 'upgrade', key: key, name: u.name, icon: u.icon,
          price: price, maxed: maxed, level: lv, max: u.max, sub: sub,
          afford: !maxed && this.money >= price
        });
      } else if (data.fish[key]) {
        var f = data.fish[key];
        var fp = this.fishPrice(key);
        out.push({
          kind: 'fish', key: key, name: f.name, icon: 'fish',
          price: fp, maxed: false, sub: (this.purchases[key] || 0) > 0 ? 'x' + (this.purchases[key]) : '',
          afford: this.money >= fp && this.fishCount() < this.cfg.fishCap,
          full: this.fishCount() >= this.cfg.fishCap,
          fishDef: f
        });
      }
    }
    if (!this.cfg.boss) {
      var ep = this.cfg.eggPrice;
      out.push({
        kind: 'egg', key: 'egg', name: 'Egg Piece', icon: 'egg',
        price: ep, maxed: this.eggPieces >= 3, level: this.eggPieces, max: 3,
        sub: this.eggPieces + ' of 3',
        afford: this.eggPieces < 3 && this.money >= ep
      });
    }
    return out;
  };

  Level.prototype.buy = function (item) {
    if (this.state !== 'playing') return false;
    if (item.kind === 'upgrade') {
      if (item.maxed || this.money < item.price) { audio.play('denied'); return false; }
      this.money -= item.price;
      this.stats.spent += item.price;
      this.upg[item.key]++;
      audio.play('upgrade');
      this.pop(data.upgrades[item.key].name + ' up!', this.W / 2, this.bounds.b - 40, '#8ff0ff', 20);
      return true;
    }
    if (item.kind === 'fish') {
      if (this.money < item.price) { audio.play('denied'); return false; }
      if (this.fishCount() >= this.cfg.fishCap) {
        audio.play('denied');
        this.pop('tank is full!', this.W / 2, this.bounds.b - 40, '#ff9aa2', 20);
        return false;
      }
      this.money -= item.price;
      this.stats.spent += item.price;
      this.purchases[item.key] = (this.purchases[item.key] || 0) + 1;
      var b = this.bounds;
      var f = this.spawnFish(item.key, rand(b.l + 80, b.r - 80), rand(b.t + 60, this.floorY - 70), 0);
      audio.play('buy');
      audio.play('born');
      this.pop(item.name + '!', f.x, f.y - 26, '#b7ffb0');
      this.emptyTankTimer = 0;
      return true;
    }
    if (item.kind === 'egg') {
      if (this.eggPieces >= 3 || this.money < item.price) { audio.play('denied'); return false; }
      this.money -= item.price;
      this.stats.spent += item.price;
      this.eggPieces++;
      audio.play('egg_piece');
      this.pop('egg piece ' + this.eggPieces + ' of 3', this.W / 2, this.bounds.t + 70, '#ffe066', 26);
      this.burst(this.W / 2, this.bounds.t + 70, { count: 24, color: '#ffe066', speed: 220, size: 4, kind: 'sparkle' });
      if (this.eggPieces >= 3) this.complete();
      return true;
    }
    return false;
  };

  Level.prototype.complete = function () {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    audio.play('level_win');
    this.game.onLevelComplete(this);
  };
  Level.prototype.fail = function (reason) {
    if (this.state !== 'playing') return;
    this.state = 'failed';
    this.failReason = reason;
    audio.play('level_fail');
    this.game.onLevelFailed(this, reason);
  };
  Level.prototype.onAlienKilled = function (alien) {
    this.pop('+bounty', alien.x, alien.y - 20, '#ffd257', 20);
    if (alien.def.ai === 'boss') {
      this.bossBeaten = true;
      this.bossAlive = false;
      var self = this;
      /* let the explosion breathe before the win screen */
      this.winDelay = 1.5;
    }
  };

  /* --------------------------------------------------------------- input */

  /* The finale gives you longer to claw your way back. */
  Level.prototype.graceTime = function () { return this.cfg.boss ? 24 : 14; };

  Level.prototype.cheapestFish = function () {
    var list = this.cfg.shop, best = Infinity;
    for (var i = 0; i < list.length; i++) {
      if (data.fish[list[i]]) best = Math.min(best, this.fishPrice(list[i]));
    }
    return best;
  };

  /* Returns true when the click was used by the world. */
  Level.prototype.pointerAction = function (x, y, isHold) {
    if (this.state !== 'playing' && !this.bossBeaten) return false;
    if (y < this.bounds.t - 4 || y > this.shopTop) return false;
    var i, d;

    /* 1. coins first - they are the reward for paying attention */
    for (i = this.drops.length - 1; i >= 0; i--) {
      d = this.drops[i];
      if (d.dead || d.collected) continue;
      var r = Math.max(20, d.s * 2.4);
      if (util.dist(x, y, d.x, d.y) < r) { d.collect(false); return true; }
    }
    /* 2. incoming missiles and orbs */
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      if (p.dead || p.friendly || p.delay > 0) continue;
      if (util.dist(x, y, p.x, p.y) < Math.max(22, p.s * 3)) {
        if (p.kind === 'orb') p.deflect();
        else p.destroy();
        return true;
      }
    }
    /* 3. aliens - the laser */
    if (this.fireCooldown <= 0) {
      for (i = this.aliens.length - 1; i >= 0; i--) {
        var a = this.aliens[i];
        if (a.dead || a.dying) continue;
        if (util.dist(x, y, a.x, a.y) < a.size() * 0.48) {
          this.fireCooldown = 0.13;
          a.damage(this.laserDamage(), 'laser');
          this.beam(x, this.H, a.x, a.y + a.size() * 0.1, 'laser', '#ff5f4d');
          this.burst(a.x + rand(-8, 8), a.y + rand(-8, 8), { count: 5, color: '#ffd166', speed: 130, size: 2.6, kind: 'spark' });
          audio.play('laser');
          return true;
        }
      }
    }
    /* 4. otherwise: feed the tank */
    if (this.feedCooldown <= 0) {
      if (this.paidFoodCount() >= this.maxFood()) {
        if (!isHold) {
          audio.play('denied');
          this.pop('food limit - upgrade Food Amount', x, y - 14, '#ff9aa2', 15);
        }
        return true;
      }
      this.feedCooldown = isHold ? 0.22 : 0.06;
      this.spawnFood(x, Math.max(this.bounds.t + 6, y), false);
      return true;
    }
    return true;
  };

  /* --------------------------------------------------------------- update */

  Level.prototype.update = function (dt) {
    var i, list;
    this.time += dt;
    if (this.feedCooldown > 0) this.feedCooldown -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.alarm > 0) this.alarm -= dt;
    if (this.tipTimer > 0) this.tipTimer -= dt;
    this.shakeAmt *= Math.pow(0.0016, dt);
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;

    if (this.winDelay !== undefined) {
      this.winDelay -= dt;
      if (this.winDelay <= 0) { this.winDelay = undefined; this.complete(); }
    }

    /* alien schedule */
    if (this.state === 'playing') {
      if (this.bossTimer !== Infinity && !this.bossAlive && !this.bossBeaten) {
        this.bossTimer -= dt;
        if (this.bossTimer <= 0) {
          this.bossTimer = Infinity;
          this.spawnAlien(this.cfg.boss);
          this.bossAlive = true;
        }
      }
      if (this.alienTimer !== Infinity) {
        this.alienTimer -= dt;
        var cap = 2 + (this.cfg.tank >= 2 ? 1 : 0) + (this.cfg.boss ? 1 : 0);
        if (this.alienTimer <= 6 && !this.warned) {
          this.warned = true;
          audio.play('alert');
          this.pop('something is coming...', this.W / 2, this.bounds.t + 46, '#ff9aa2', 20);
        }
        if (this.alienTimer <= 0) {
          this.warned = false;
          var gap = this.cfg.alienGap || [36, 52];
          var live = 0;
          for (i = 0; i < this.aliens.length; i++) if (!this.aliens[i].dead && this.aliens[i].def.ai !== 'boss') live++;
          if (live < cap) {
            this.spawnAlien(util.pick(this.cfg.aliens));
            this.alienTimer = rand(gap[0], gap[1]) * (this.hasPet('oracle') ? 1.15 : 1);
          } else {
            this.alienTimer = 6;
          }
        }
      }
    }

    /* entities */
    for (i = 0; i < this.foods.length; i++) this.foods[i].update(dt);
    for (i = 0; i < this.drops.length; i++) this.drops[i].update(dt);
    for (i = 0; i < this.fish.length; i++) this.fish[i].update(dt);
    for (i = 0; i < this.pets.length; i++) this.pets[i].update(dt);
    for (i = 0; i < this.aliens.length; i++) this.aliens[i].update(dt);
    for (i = 0; i < this.projectiles.length; i++) this.projectiles[i].update(dt);
    for (i = 0; i < this.particles.length; i++) this.particles[i].update(dt);
    for (i = 0; i < this.pops.length; i++) this.pops[i].update(dt);
    for (i = 0; i < this.beams.length; i++) this.beams[i].update(dt);

    /* wasted food recycling */
    if (this.hasPet('scrubber')) {
      for (i = 0; i < this.foods.length; i++) {
        var fd = this.foods[i];
        if (fd.dead && fd.wasted && !fd.recycled) {
          fd.recycled = true;
          this.spawnDrop('bronze', fd.x, fd.y - 6);
        }
      }
    }

    /* ambient bubbles from the sea floor */
    if (util.chance(dt * 2.2)) {
      this.particles.push(new ent.Particle(this, rand(this.bounds.l, this.bounds.r), this.floorY - 4, {
        vx: rand(-6, 6), vy: rand(-30, -14), g: -22, life: rand(1.4, 2.6),
        size: rand(1.6, 3.6), color: '#cdf6ff', kind: 'bubble', drag: 0.3
      }));
    }

    this.fish = prune(this.fish);
    this.pets = prune(this.pets);
    this.aliens = prune(this.aliens);
    this.drops = prune(this.drops);
    this.foods = prune(this.foods);
    this.projectiles = prune(this.projectiles);
    this.particles = prune(this.particles);
    this.pops = prune(this.pops);
    this.beams = prune(this.beams);
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);

    /* lose check: an empty tank you cannot restock */
    if (this.state === 'playing') {
      if (this.fishCount() === 0) {
        /* Always give the full grace period: floor coins and pets can still
         * bankroll a comeback. */
        this.emptyTankTimer += dt;
        if (this.emptyTankTimer > this.graceTime()) {
          this.fail(this.money >= this.cheapestFish() ? 'empty' : 'broke');
        }
      } else {
        this.emptyTankTimer = 0;
      }
    }
  };

  function prune(arr) {
    var out = [], i;
    for (i = 0; i < arr.length; i++) if (!arr[i].dead) out.push(arr[i]);
    return out;
  }

  /* ----------------------------------------------------------------- draw */

  Level.prototype.draw = function (ctx) {
    var i;
    ctx.save();
    if (this.shakeAmt > 0.2) {
      ctx.translate(rand(-this.shakeAmt, this.shakeAmt) * 0.5, rand(-this.shakeAmt, this.shakeAmt) * 0.5);
    }
    art.drawBackground(ctx, this.decor, this.time);

    for (i = 0; i < this.foods.length; i++) this.foods[i].draw(ctx);
    /* floor coins under everything else so fish stay readable */
    for (i = 0; i < this.drops.length; i++) if (this.drops[i].onFloor) this.drops[i].draw(ctx);
    for (i = 0; i < this.pets.length; i++) if (this.pets[i].def.floor) this.pets[i].draw(ctx);
    for (i = 0; i < this.fish.length; i++) if (this.fish[i].def.floor) this.fish[i].draw(ctx);
    for (i = 0; i < this.drops.length; i++) if (!this.drops[i].onFloor) this.drops[i].draw(ctx);
    for (i = 0; i < this.fish.length; i++) if (!this.fish[i].def.floor) this.fish[i].draw(ctx);
    for (i = 0; i < this.pets.length; i++) if (!this.pets[i].def.floor) this.pets[i].draw(ctx);
    for (i = 0; i < this.aliens.length; i++) this.aliens[i].draw(ctx);
    for (i = 0; i < this.projectiles.length; i++) this.projectiles[i].draw(ctx);
    for (i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
    for (i = 0; i < this.beams.length; i++) this.beams[i].draw(ctx);
    for (i = 0; i < this.pops.length; i++) this.pops[i].draw(ctx);

    art.drawGlass(ctx, this.W, this.H, this.time);

    /* alien alarm wash */
    if (this.alarm > 0) {
      var a = clamp(this.alarm / 1.6, 0, 1) * 0.35 * (0.5 + 0.5 * Math.sin(this.time * 14));
      var g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, util.rgba('#ff2b2b', a));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    /* empty tank warning */
    if (this.state === 'playing' && this.fishCount() === 0 && this.emptyTankTimer > 0.6) {
      var left = Math.max(0, this.graceTime() - this.emptyTankTimer);
      art.text(ctx, 'YOUR TANK IS EMPTY', this.W / 2, this.H * 0.42, {
        size: 34 * this.scale, fill: '#ff9aa2', stroke: '#3a0009', strokeW: 8
      });
      var canAfford = this.money >= this.cheapestFish();
      art.text(ctx, (canAfford ? 'buy a fish within ' : 'find ' + util.fmtMoney(this.cheapestFish() - this.money) + ' more within ') + Math.ceil(left) + 's',
        this.W / 2, this.H * 0.42 + 34 * this.scale, {
          size: 20 * this.scale, fill: '#ffd9dd', stroke: '#3a0009', strokeW: 5
        });
    }

    /* level tip */
    if (this.tipTimer > 0 && this.cfg.tip) {
      var alpha = clamp(this.tipTimer / 2, 0, 1) * clamp((11 - this.tipTimer) / 0.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      var tw = Math.min(this.W - 60, 720);
      art.panel(ctx, this.W / 2 - tw / 2, this.bounds.t + 8, tw, 46, { radius: 12, top: 'rgba(8,42,64,0.86)', bottom: 'rgba(4,22,36,0.9)' });
      art.text(ctx, this.cfg.tip, this.W / 2, this.bounds.t + 31, { size: 15, fill: '#dff1ff', weight: 'normal' });
      ctx.restore();
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------ save/load */

  Level.prototype.serialize = function () {
    var i, f = [];
    for (i = 0; i < this.fish.length; i++) {
      var fi = this.fish[i];
      if (fi.dead || fi.dying) continue;
      f.push({ s: fi.species, st: fi.stage, x: Math.round(fi.x), y: Math.round(fi.y), fu: +fi.fullness.toFixed(2), g: +fi.growth.toFixed(2) });
    }
    var d = [];
    for (i = 0; i < this.drops.length; i++) {
      var dr = this.drops[i];
      if (dr.dead || dr.collected) continue;
      d.push({ t: dr.type, x: Math.round(dr.x), y: Math.round(dr.y) });
    }
    return {
      level: this.cfg.index,
      pets: this.petKeys.slice(),
      money: Math.round(this.money),
      upg: { food: this.upg.food, maxfood: this.upg.maxfood, laser: this.upg.laser },
      egg: this.eggPieces,
      purchases: this.purchases,
      time: Math.round(this.time),
      fish: f,
      drops: d,
      stats: this.stats
    };
  };

  Level.prototype.restore = function (s) {
    var i;
    this.money = s.money;
    this.upg = { food: s.upg.food || 1, maxfood: s.upg.maxfood || 1, laser: s.upg.laser || 1 };
    this.eggPieces = s.egg || 0;
    this.purchases = s.purchases || {};
    this.time = s.time || 0;
    if (s.stats) this.stats = s.stats;
    this.fish.length = 0;
    var b = this.bounds;
    for (i = 0; i < (s.fish || []).length; i++) {
      var fd = s.fish[i];
      if (!data.fish[fd.s]) continue;
      var f = this.spawnFish(fd.s, clamp(fd.x, b.l + 20, b.r - 20), clamp(fd.y, b.t + 20, this.floorY - 20), fd.st, true);
      f.fullness = fd.fu === undefined ? 0.7 : fd.fu;
      f.growth = fd.g || 0;
    }
    for (i = 0; i < (s.drops || []).length; i++) {
      var dd = s.drops[i];
      if (data.drops[dd.t]) this.spawnDrop(dd.t, clamp(dd.x, b.l + 20, b.r - 20), clamp(dd.y, b.t + 20, this.floorY - 10));
    }
    /* a restored tank gets a moment of peace before the next alien */
    if (this.alienTimer !== Infinity) this.alienTimer = Math.max(14, (this.cfg.alienGap ? this.cfg.alienGap[0] : 36) * 0.4);
    if (this.bossTimer !== Infinity) this.bossTimer = Math.max(this.bossTimer, 14);
  };

  CQ.Level = Level;
})();
