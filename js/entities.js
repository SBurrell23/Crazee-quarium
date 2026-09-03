/* Crazee-quarium :: entities.js
 * Fish, pets, aliens, coins, food, projectiles and particles.
 * Everything talks to the level through a small set of helpers (spawnDrop, pop, burst...).
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util, art = CQ.art, data = CQ.data, audio = CQ.audio;
  var TAU = util.TAU, clamp = util.clamp, rand = util.rand, dist = util.dist, approach = util.approach;

  /* ==================================================================== food */
  function Food(level, x, y, tier, free) {
    this.level = level;
    this.x = x; this.y = y;
    this.tier = tier;
    this.free = !!free;
    var t = data.upgrades.food.tiers[clamp(tier, 1, 3) - 1];
    this.nutrition = t.nutrition;
    this.vy = t.sink * level.scale;
    this.vx = rand(-8, 8);
    this.rot = rand(0, TAU);
    this.spin = rand(-2, 2);
    this.s = (4.5 + tier * 1.5) * level.scale;
    this.claimedBy = null;
    this.onFloor = false;
    this.floorTime = 0;
    this.age = 0;
    this.dead = false;
  }
  Food.prototype.update = function (dt) {
    this.age += dt;
    this.rot += this.spin * dt;
    if (this.onFloor) {
      this.floorTime += dt;
      if (this.floorTime > 2.2) { this.dead = true; this.wasted = true; }
      return;
    }
    this.x += this.vx * dt + Math.sin(this.age * 2.2) * 6 * dt;
    this.y += this.vy * dt;
    var b = this.level.bounds;
    if (this.x < b.l) { this.x = b.l; this.vx = Math.abs(this.vx); }
    if (this.x > b.r) { this.x = b.r; this.vx = -Math.abs(this.vx); }
    if (this.y >= this.level.floorY - this.s) {
      this.y = this.level.floorY - this.s;
      this.onFloor = true;
    }
  };
  Food.prototype.draw = function (ctx) {
    var a = this.onFloor ? clamp(1 - (this.floorTime - 1.2) / 1.0, 0.25, 1) : 1;
    art.drawFood(ctx, { x: this.x, y: this.y, s: this.s, tier: this.tier, rot: this.rot, alpha: a });
  };

  /* =================================================================== drops */
  function Drop(level, type, x, y, opts) {
    opts = opts || {};
    this.level = level;
    this.type = type;
    this.def = data.drops[type] || data.drops.bronze;
    this.value = Math.round(this.def.value * (opts.valueMul || 1));
    this.x = x; this.y = y;
    this.vx = opts.vx === undefined ? rand(-14, 14) : opts.vx;
    this.vy = opts.vy === undefined ? 0 : opts.vy;
    this.s = this.def.s * level.scale;
    this.spin = rand(0, TAU);
    this.spinSpeed = rand(2.2, 4.6) * (util.chance(0.5) ? 1 : -1);
    this.onFloor = false;
    this.floorTime = 0;
    this.age = 0;
    this.dead = false;
    this.collected = false;
    this.pulledBy = null;
  }
  Drop.prototype.update = function (dt) {
    this.age += dt;
    this.spin += this.spinSpeed * dt;
    var b = this.level.bounds;

    if (this.pulledBy) {
      var p = this.pulledBy;
      if (p.dead) { this.pulledBy = null; }
      else {
        var d = Math.max(1, dist(this.x, this.y, p.x, p.y));
        this.x += ((p.x - this.x) / d) * 220 * this.level.scale * dt;
        this.y += ((p.y - this.y) / d) * 220 * this.level.scale * dt;
        return;
      }
    }

    if (this.def.rise) {
      this.y += this.def.sink * this.level.scale * dt;
      this.x += Math.sin(this.age * 2.6) * 14 * dt;
      if (this.y < b.t - 24) this.dead = true;
      return;
    }

    if (this.onFloor) {
      this.floorTime += dt;
      if (this.floorTime > this.def.linger) this.dead = true;
      return;
    }
    this.vy = approach(this.vy, this.def.sink * this.level.scale, 260, dt);
    this.x += this.vx * dt + Math.sin(this.age * 1.8) * 8 * dt;
    this.y += this.vy * dt;
    this.vx *= (1 - 0.9 * dt);
    if (this.x < b.l + this.s) { this.x = b.l + this.s; this.vx = Math.abs(this.vx); }
    if (this.x > b.r - this.s) { this.x = b.r - this.s; this.vx = -Math.abs(this.vx); }
    if (this.y >= this.level.floorY - this.s * 0.6) {
      this.y = this.level.floorY - this.s * 0.6;
      this.onFloor = true;
      this.vy = 0;
    }
  };
  Drop.prototype.collect = function (byPet) {
    if (this.collected) return;
    this.collected = true;
    this.dead = true;
    this.level.addMoney(this.value, this.x, this.y, true);
    audio.play(this.def.sound || 'coin', { pitch: this.def.pitch });
    this.level.burst(this.x, this.y, {
      count: byPet ? 5 : 9,
      color: this.type === 'diamond' ? '#8ff0ff' : (this.type === 'pearl' ? '#f2e9ff' : '#ffe066'),
      speed: 120, size: 3, kind: 'sparkle'
    });
    this.level.stats.collected += this.value;
  };
  Drop.prototype.draw = function (ctx) {
    var a = 1, warn = 0;
    /* A drop that is about to be lost turns red and pulses. */
    if (this.onFloor) {
      var left = this.def.linger - this.floorTime;
      a = clamp(left / 1.2, 0.25, 1);
      warn = clamp((1.6 - left) / 1.6, 0, 1);
    }
    if (this.def.rise) {
      var top = this.level.bounds.t;
      a = clamp((this.y - top) / 60, 0.15, 1);
      warn = clamp(1 - (this.y - top) / 110, 0, 1);
    }
    art.drawCoin(ctx, {
      x: this.x, y: this.y, s: this.s, type: this.type, spin: this.spin, alpha: a, warn: warn
    });
    if (warn > 0.05) {
      var pulse = 0.4 + 0.45 * Math.sin(this.age * 16);
      art.drawRing(ctx, this.x, this.y, this.s * (1.5 + warn * 0.55), Math.max(0, pulse) * warn, '#ff3b30', 2.4);
    }
  };

  /* ==================================================================== fish */
  function Fish(level, species, x, y, stage) {
    this.level = level;
    this.species = species;
    this.def = data.fish[species];
    this.stage = stage || 0;
    this.x = x; this.y = y;
    this.vx = rand(-1, 1) * 20;
    this.vy = 0;
    this.dir = this.vx >= 0 ? 1 : -1;
    this.phase = rand(0, TAU);
    this.fullness = 0.8;
    this.starve = 0;
    this.growth = 0;
    this.dropTimer = this.stageDef().dropTime * rand(0.35, 0.9);
    this.produceTimer = this.def.produce && this.def.produce.interval ? this.def.produce.interval * rand(0.4, 1) : 0;
    this.target = null;
    this.mouthOpen = 0;
    this.wanderTimer = 0;
    this.wander = { x: rand(-1, 1), y: rand(-0.4, 0.4) };
    this.blink = 0;
    this.blinkTimer = rand(2, 7);
    this.dying = false;
    this.dyingTime = 0;
    this.dead = false;
    this.hurt = 0;
    this.eaten = 0;
    this.bornAt = level.time;
    this.spawnPop = 0.6;
  }
  Fish.prototype.stageDef = function () {
    return this.def.stages[clamp(this.stage, 0, this.def.stages.length - 1)];
  };
  Fish.prototype.size = function () {
    return this.stageDef().size * this.level.scale * (this.spawnPop > 0 ? util.lerp(0.5, 1, 1 - this.spawnPop / 0.6) : 1);
  };
  Fish.prototype.hungry = function () { return this.fullness < 0.28; };

  Fish.prototype.die = function (cause) {
    if (this.dying || this.dead) return;
    this.dying = true;
    this.dyingTime = 0;
    this.target = null;
    audio.play('fish_die');
    this.level.stats.lost++;
    if (cause !== 'eaten') this.level.pop('lost', this.x, this.y - 12, '#ff9aa2');
  };
  Fish.prototype.consume = function () {
    /* Removed from the tank whole: eaten by a predator or an alien. */
    this.dead = true;
    this.level.burst(this.x, this.y, { count: 10, color: '#ffd0a8', speed: 130, size: 3, kind: 'chunk' });
  };

  Fish.prototype.eatFood = function (food) {
    var boost = 1 + (this.level.boost.nutrition || 0);
    var nut = food.nutrition * boost;
    food.dead = true;
    food.eaten = true;
    this.mouthOpen = 0.28;
    this.fullness = clamp(this.fullness + 0.55 + food.nutrition * 0.15, 0, 1);
    this.starve = 0;
    audio.play('eat');
    this.level.burst(food.x, food.y, { count: 5, color: '#ffe3b0', speed: 70, size: 2.4, kind: 'chunk' });
    if (this.def.growth && this.def.growth.length) {
      this.growth += nut;
      var need = this.def.growth[this.stage];
      if (need !== undefined && this.growth >= need) {
        this.growth = 0;
        this.stage++;
        this.dropTimer = Math.min(this.dropTimer, this.stageDef().dropTime * 0.5);
        this.spawnPop = 0.35;
        audio.play('grow');
        this.level.pop('grew!', this.x, this.y - this.size() * 0.7, '#b7ffb0');
        this.level.burst(this.x, this.y, { count: 16, color: '#bff0ff', speed: 150, size: 3, kind: 'sparkle' });
      }
    }
    if (this.def.produce && this.def.produce.on === 'eat') this.produceNow();
  };

  Fish.prototype.eatPrey = function (prey) {
    prey.consume();
    this.mouthOpen = 0.35;
    this.fullness = 1;
    this.starve = 0;
    this.eaten++;
    audio.play('chomp');
    if (this.def.produce && this.def.produce.on === 'eat') this.produceNow();
  };

  Fish.prototype.eatDrop = function (drop) {
    drop.dead = true;
    this.mouthOpen = 0.3;
    this.fullness = clamp(this.fullness + 0.55, 0, 1);
    this.starve = 0;
    audio.play('eat');
    this.level.burst(drop.x, drop.y, { count: 7, color: '#ffe066', speed: 100, size: 2.6, kind: 'sparkle' });
    if (this.def.produce && this.def.produce.on === 'eat') this.produceNow();
  };

  Fish.prototype.produceNow = function () {
    var p = this.def.produce;
    if (!p) return;
    var parts = p.type.split(':');
    if (parts[0] === 'drop') {
      this.level.spawnDrop(parts[1], this.x - this.dir * this.size() * 0.3, this.y + this.size() * 0.1);
      this.level.pop('+' + util.fmtMoney(data.drops[parts[1]].value), this.x, this.y - this.size() * 0.6, '#8ff0ff');
    } else if (parts[0] === 'fish') {
      if (this.level.fishCount() < this.level.cfg.fishCap) {
        this.level.spawnFish(parts[1], this.x, this.y + 8, 0);
        audio.play('born');
      }
    }
  };

  Fish.prototype.findTarget = function () {
    var diet = this.def.diet, best = null, bestD = Infinity, i, d;
    if (diet.kind === 'food') {
      var foods = this.level.foods;
      for (i = 0; i < foods.length; i++) {
        var f = foods[i];
        if (f.dead) continue;
        if (f.claimedBy && f.claimedBy !== this && !f.claimedBy.dead && !f.claimedBy.dying) continue;
        d = dist(this.x, this.y, f.x, f.y);
        if (d < bestD) { bestD = d; best = f; }
      }
    } else if (diet.kind === 'drop') {
      var drops = this.level.drops;
      for (i = 0; i < drops.length; i++) {
        var dr = drops[i];
        if (dr.dead || dr.collected) continue;
        if (diet.types.indexOf(dr.type) < 0) continue;
        if (dr.claimedBy && dr.claimedBy !== this) continue;
        d = dist(this.x, this.y, dr.x, dr.y);
        if (d < bestD) { bestD = d; best = dr; }
      }
    } else if (diet.kind === 'fish') {
      var fl = this.level.fish;
      for (i = 0; i < fl.length; i++) {
        var pf = fl[i];
        if (pf === this || pf.dead) continue;
        if (diet.species.indexOf(pf.species) < 0) continue;
        if (pf.stage > (diet.maxStage === undefined ? 9 : diet.maxStage)) continue;
        d = dist(this.x, this.y, pf.x, pf.y);
        if (d < bestD) { bestD = d; best = pf; }
      }
    }
    if (this.target && this.target.claimedBy === this) this.target.claimedBy = null;
    this.target = best;
    if (best && (diet.kind === 'food' || diet.kind === 'drop')) best.claimedBy = this;
  };

  Fish.prototype.update = function (dt) {
    var lvl = this.level, b = lvl.bounds, sc = lvl.scale;
    this.phase += dt * (4 + (this.stage || 0) * 0.5);
    if (this.mouthOpen > 0) this.mouthOpen -= dt;
    if (this.spawnPop > 0) this.spawnPop = Math.max(0, this.spawnPop - dt);
    if (this.hurt > 0) this.hurt -= dt;

    if (this.dying) {
      this.dyingTime += dt;
      /* Belly up, drift to the surface, then fade away. */
      this.y -= 26 * sc * dt;
      this.x += Math.sin(this.dyingTime * 2) * 10 * dt;
      if (this.y < b.t + 12) this.y = b.t + 12;
      if (this.dyingTime > 3.2) {
        this.dead = true;
        if (lvl.hasPet('scrubber')) {
          lvl.spawnDrop('silver', this.x, this.y);
          lvl.pop('recycled', this.x, this.y - 10, '#c8b48a');
        }
      }
      return;
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blink = 0.12; this.blinkTimer = rand(2.5, 8); }
    if (this.blink > 0) this.blink -= dt;

    /* hunger */
    this.fullness -= dt / this.def.fullTime;
    if (this.fullness <= 0) {
      this.fullness = 0;
      this.starve += dt;
      if (this.starve > 0.1 && this.starve % 3 < dt) audio.play('hungry');
      if (this.starve >= this.def.starveTime) { this.die('starve'); return; }
    }

    /* coin production by stage */
    var sd = this.stageDef();
    if (sd.drop && this.fullness > 0) {
      this.dropTimer -= dt * (1 + (lvl.boost.drops || 0));
      if (this.dropTimer <= 0) {
        this.dropTimer = sd.dropTime * rand(0.85, 1.15);
        var type = sd.drop;
        if (lvl.cfg.starGuppies && this.species === 'guppy' && util.chance(lvl.cfg.starGuppies)) type = 'star';
        lvl.spawnDrop(type, this.x, this.y + this.size() * 0.2);
      }
    }
    /* timed production (beetles, babies) */
    /* Breeding needs a genuinely well-fed parent, which keeps the tank from
     * outgrowing the food you can actually drop. */
    var prodFloor = this.def.produce && this.def.produce.type.indexOf('fish:') === 0 ? 0.6 : 0.22;
    if (this.def.produce && this.def.produce.on === 'timer' && this.fullness > prodFloor) {
      this.produceTimer -= dt * (1 + (lvl.boost.drops || 0));
      if (this.produceTimer <= 0) {
        this.produceTimer = this.def.produce.interval * rand(0.9, 1.1);
        this.produceNow();
      }
    }

    /* Target selection: only chase when there is a reason to. Predators hold out
     * longer than grazers so they do not strip the tank of guppies. */
    var kind = this.def.diet.kind;
    var appetite = kind === 'fish' ? 0.6 : (kind === 'drop' ? 0.82 : 0.92);
    var stillGrowing = this.def.growth && this.def.growth.length && this.stage < this.def.stages.length - 1;
    var wantsFood = this.fullness < appetite || stillGrowing;
    if (!this.target || this.target.dead || this.target.dying || this.target.collected) {
      this.target = null;
      if (wantsFood) this.findTarget();
    } else if (!wantsFood) {
      if (this.target.claimedBy === this) this.target.claimedBy = null;
      this.target = null;
    }

    var speed = this.def.speed * sc * (this.hungry() ? 1.16 : 1);
    var desX = 0, desY = 0;
    if (this.target) {
      var dx = this.target.x - this.x, dy = this.target.y - this.y;
      var dd = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      desX = (dx / dd) * speed * 1.35;
      desY = (dy / dd) * speed * 1.1;
      var reach = this.size() * 0.42 + (this.target.s || this.target.size ? (this.target.size ? this.target.size() * 0.4 : this.target.s) : 6);
      if (dd < reach) {
        if (this.def.diet.kind === 'food') this.eatFood(this.target);
        else if (this.def.diet.kind === 'drop') this.eatDrop(this.target);
        else this.eatPrey(this.target);
        this.target = null;
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = rand(1.4, 3.8);
        this.wander.x = rand(-1, 1);
        this.wander.y = rand(-0.45, 0.45);
        if (Math.abs(this.wander.x) < 0.25) this.wander.x = this.wander.x < 0 ? -0.3 : 0.3;
      }
      desX = this.wander.x * speed;
      desY = this.wander.y * speed * 0.55 + Math.sin(this.phase * 0.4) * 8 * sc;
    }

    if (this.def.floor) {
      /* Floor dwellers only walk left and right. */
      var targetY = lvl.floorY - this.size() * 0.42;
      desY = (targetY - this.y) * 3;
      desX *= 0.8;
    }

    /* Gentle separation so a school does not pile onto one pixel. */
    var sepX = 0, sepY = 0, mySize = this.size();
    for (var si = 0; si < lvl.fish.length; si++) {
      var other = lvl.fish[si];
      if (other === this || other.dead) continue;
      var ox = this.x - other.x, oy = this.y - other.y;
      var od2 = ox * ox + oy * oy;
      var want = (mySize + other.size()) * 0.4;
      if (od2 > 0.5 && od2 < want * want) {
        var od = Math.sqrt(od2), push = 1 - od / want;
        sepX += (ox / od) * push;
        sepY += (oy / od) * push;
      }
    }
    desX += sepX * speed * 1.5;
    desY += sepY * speed * 1.5;

    /* soft walls */
    var margin = 40 * sc;
    if (this.x < b.l + margin) desX += (b.l + margin - this.x) * 2.6;
    if (this.x > b.r - margin) desX -= (this.x - (b.r - margin)) * 2.6;
    if (this.y < b.t + margin * 0.6) desY += (b.t + margin * 0.6 - this.y) * 2.6;
    if (this.y > b.b - margin * 0.6) desY -= (this.y - (b.b - margin * 0.6)) * 2.6;

    var accel = 260 * sc;
    this.vx = approach(this.vx, desX, accel, dt);
    this.vy = approach(this.vy, desY, accel, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, b.l, b.r);
    this.y = clamp(this.y, b.t, Math.max(b.t + 1, lvl.floorY - this.size() * 0.2));
    if (Math.abs(this.vx) > 6) this.dir = this.vx > 0 ? 1 : -1;
  };

  Fish.prototype.draw = function (ctx) {
    var s = this.size();
    var mood = this.dying ? 'dead' : (this.hungry() ? 'hungry' : 'ok');
    var c1 = this.def.c1;
    if (this.dying) c1 = util.mixColor(c1, '#8899a0', clamp(this.dyingTime / 2.2, 0, 0.7));
    else if (this.hungry()) c1 = util.mixColor(c1, '#9fb3a8', 0.4);
    var alpha = this.dying ? clamp(1 - (this.dyingTime - 2.0) / 1.2, 0.1, 1) : 1;

    /* hunger indicator */
    if (!this.dying && this.hungry()) {
      var pulse = 0.45 + 0.35 * Math.sin(this.level.time * 6);
      art.drawRing(ctx, this.x, this.y - s * 0.72, s * 0.22, pulse, '#ff9aa2', 2);
      art.text(ctx, '!', this.x, this.y - s * 0.72, { size: s * 0.34, fill: '#ffd9dd', stroke: '#7d1f2b', strokeW: s * 0.05 });
    }

    art.drawFish(ctx, {
      x: this.x, y: this.y, s: s, dir: this.dir,
      phase: this.phase, c1: c1, c2: this.def.c2,
      shape: this.def.shape, mood: mood,
      mouthOpen: this.mouthOpen > 0,
      pattern: this.stage >= 2 ? 'stripes' : (this.stage === 1 ? 'spots' : 'none'),
      seed: (this.bornAt * 1000) | 0,
      tilt: this.dying ? 0 : clamp(this.vy / 260, -0.3, 0.3) * (this.dir > 0 ? 1 : -1),
      flipY: this.dying,
      alpha: alpha,
      blink: this.blink > 0
    });
  };

  /* ==================================================================== pets */
  function Pet(level, def) {
    this.level = level;
    this.def = def;
    this.ability = def.ability;
    this.x = rand(level.bounds.l + 80, level.bounds.r - 80);
    this.y = def.floor ? level.floorY - def.size * 0.4 * level.scale : rand(level.bounds.t + 60, level.bounds.b - 60);
    this.vx = rand(-20, 20); this.vy = 0;
    this.dir = 1;
    this.phase = rand(0, TAU);
    this.timer = (this.ability.interval || 4) * rand(0.2, 0.8);
    this.target = null;
    this.wanderTimer = 0;
    this.wander = { x: rand(-1, 1), y: rand(-0.4, 0.4) };
    this.dead = false;
    this.fx = 0;
    this.spawnPop = 0.7;
  }
  Pet.prototype.size = function () {
    return this.def.size * this.level.scale * (this.spawnPop > 0 ? util.lerp(0.4, 1, 1 - this.spawnPop / 0.7) : 1);
  };

  Pet.prototype.nearestAlien = function () {
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.level.aliens.length; i++) {
      var a = this.level.aliens[i];
      if (a.dead || a.dying || a.state === 'leave') continue;
      var d = dist(this.x, this.y, a.x, a.y);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  };
  Pet.prototype.nearestDrop = function (radius, onFloorOnly) {
    var best = null, bestD = radius === undefined ? Infinity : radius * this.level.scale;
    for (var i = 0; i < this.level.drops.length; i++) {
      var dr = this.level.drops[i];
      if (dr.dead || dr.collected || dr.def.rise) continue;
      if (onFloorOnly && !dr.onFloor) continue;
      var d = dist(this.x, this.y, dr.x, dr.y);
      if (d < bestD) { bestD = d; best = dr; }
    }
    return best;
  };

  Pet.prototype.update = function (dt) {
    var lvl = this.level, b = lvl.bounds, sc = lvl.scale, kind = this.ability.kind;
    this.phase += dt * 4;
    if (this.spawnPop > 0) this.spawnPop = Math.max(0, this.spawnPop - dt);
    if (this.fx > 0) this.fx -= dt;
    var speed = 62 * sc;
    var desX = 0, desY = 0, seeking = null;

    if (this.ability.interval) this.timer -= dt;

    switch (kind) {
      case 'collect':
        seeking = this.nearestDrop(this.ability.radius * 2.4, false) || this.nearestDrop();
        break;
      case 'magnet':
        var pulled = 0;
        for (var i = 0; i < lvl.drops.length; i++) {
          var dr = lvl.drops[i];
          if (dr.dead || dr.collected || dr.def.rise) continue;
          if (dist(this.x, this.y, dr.x, dr.y) < this.ability.radius * sc) { dr.pulledBy = this; pulled++; }
          if (dr.pulledBy === this && dist(this.x, this.y, dr.x, dr.y) < this.size() * 0.5) dr.collect(true);
        }
        if (pulled === 0) seeking = this.nearestDrop();
        break;
      case 'bite':
      case 'shield':
        seeking = this.nearestAlien();
        break;
      case 'dripCoin':
        if (this.timer <= 0) {
          this.timer = this.ability.interval;
          lvl.spawnDrop(this.ability.drop, this.x, this.y + this.size() * 0.2);
          this.fx = 0.3;
        }
        break;
      case 'spawnGuppy':
        if (this.timer <= 0) {
          this.timer = this.ability.interval;
          if (lvl.fishCount() < lvl.cfg.fishCap) {
            lvl.spawnFish('guppy', this.x, this.y + 10, 0);
            audio.play('born');
            lvl.pop('baby!', this.x, this.y - this.size() * 0.6, '#ffc0d0');
            this.fx = 0.4;
          }
        }
        break;
      case 'dropFood':
        if (this.timer <= 0) {
          this.timer = this.ability.interval;
          lvl.spawnFood(this.x + rand(-30, 30), this.y + this.size() * 0.4, true);
          this.fx = 0.3;
        }
        break;
      case 'zap':
        if (this.timer <= 0) {
          var a = this.nearestAlien();
          if (a) {
            this.timer = this.ability.interval;
            a.damage(this.ability.damage, 'pet');
            lvl.beam(this.x, this.y, a.x, a.y, 'lightning', '#bff0ff');
            audio.play('zap');
            this.fx = 0.35;
          } else this.timer = 0.4;
        }
        break;
      case 'spikes':
        if (this.timer <= 0) {
          var at = this.nearestAlien();
          if (at) {
            this.timer = this.ability.interval;
            for (var k = 0; k < this.ability.count; k++) {
              lvl.projectiles.push(new Projectile(lvl, 'spike', this.x, this.y + (k - 1) * 8, {
                target: at, speed: 320, damage: this.ability.damage, friendly: true
              }));
            }
            audio.play('spike');
            this.fx = 0.3;
          } else this.timer = 0.4;
        }
        break;
      case 'heal':
        if (this.timer <= 0) {
          var worst = null, low = 0.75;
          for (var h = 0; h < lvl.fish.length; h++) {
            var f = lvl.fish[h];
            if (f.dead || f.dying) continue;
            if (f.fullness < low) { low = f.fullness; worst = f; }
          }
          if (worst) {
            this.timer = this.ability.interval;
            worst.fullness = clamp(worst.fullness + this.ability.amount, 0, 1);
            worst.starve = 0;
            audio.play('heal');
            lvl.burst(worst.x, worst.y, { count: 8, color: '#b7ffb0', speed: 90, size: 3, kind: 'sparkle' });
            this.fx = 0.35;
          } else this.timer = 0.6;
        }
        break;
      case 'interest':
        if (this.timer <= 0) {
          this.timer = this.ability.interval;
          var gain = Math.min(this.ability.cap, Math.floor(lvl.money * this.ability.rate));
          if (gain >= 1) {
            lvl.addMoney(gain, this.x, this.y, true);
            audio.play('interest');
            this.fx = 0.3;
          }
        }
        break;
      case 'upgradeCoin':
        if (this.timer <= 0) {
          var chain = { bronze: 'silver', silver: 'gold', gold: 'diamond', star: 'gold', beetle: 'pearl' };
          var cand = null;
          for (var u = 0; u < lvl.drops.length; u++) {
            var d2 = lvl.drops[u];
            if (d2.dead || d2.collected) continue;
            if (chain[d2.type]) { cand = d2; break; }
          }
          if (cand) {
            this.timer = this.ability.interval;
            var nt = chain[cand.type];
            cand.type = nt;
            cand.def = data.drops[nt];
            cand.value = cand.def.value;
            cand.s = cand.def.s * sc;
            audio.play('magic');
            lvl.burst(cand.x, cand.y, { count: 12, color: '#e0b3ff', speed: 120, size: 3, kind: 'sparkle' });
            lvl.beam(this.x, this.y, cand.x, cand.y, 'magic', '#e0b3ff');
            this.fx = 0.4;
          } else this.timer = 0.5;
        }
        break;
      case 'wildcard':
        if (this.timer <= 0) {
          this.timer = this.ability.interval;
          this.fx = 0.6;
          var roll = util.randInt(0, 2);
          if (roll === 0) {
            for (var c = 0; c < 5; c++) {
              lvl.spawnDrop('gold', rand(b.l + 60, b.r - 60), b.t + rand(10, 60));
            }
            lvl.pop('coin shower!', this.x, this.y - 30, '#ffd257');
          } else if (roll === 1) {
            for (var fd = 0; fd < 4; fd++) lvl.spawnFood(rand(b.l + 60, b.r - 60), b.t + 20, true);
            lvl.pop('feast!', this.x, this.y - 30, '#b7ffb0');
          } else {
            var hit = 0;
            for (var al = 0; al < lvl.aliens.length; al++) {
              var av = lvl.aliens[al];
              if (av.dead || av.dying) continue;
              av.damage(7, 'pet');
              lvl.beam(this.x, this.y, av.x, av.y, 'lightning', '#ffe066');
              hit++;
            }
            if (hit) { audio.play('zap'); lvl.pop('smite!', this.x, this.y - 30, '#ffe066'); }
            else { lvl.spawnDrop('diamond', this.x, this.y); }
          }
          audio.play('magic');
        }
        break;
      default:
        break;
    }

    /* movement */
    if (seeking) {
      var dx = seeking.x - this.x, dy = seeking.y - this.y;
      var dd = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      desX = (dx / dd) * speed * 1.5;
      desY = (dy / dd) * speed * 1.3;
      var touch = this.size() * 0.5 + (seeking.s || (seeking.size ? seeking.size() * 0.45 : 10));
      if (dd < touch) {
        if (kind === 'collect') seeking.collect(true);
        else if (kind === 'bite') {
          seeking.damage(this.ability.dps * dt, 'pet');
          if (util.chance(dt * 3)) { audio.play('chomp'); this.fx = 0.2; }
          lvl.burst(seeking.x + rand(-10, 10), seeking.y + rand(-10, 10), { count: 2, color: '#ffd0a8', speed: 60, size: 2, kind: 'chunk' });
        } else if (kind === 'shield' && this.timer <= 0) {
          this.timer = this.ability.interval;
          seeking.knock(this.x, this.y, this.ability.knock);
          seeking.damage(1, 'pet');
          audio.play('hit');
          lvl.burst((this.x + seeking.x) / 2, (this.y + seeking.y) / 2, { count: 10, color: '#cdf6ff', speed: 160, size: 3, kind: 'spark' });
          this.fx = 0.3;
        }
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = rand(1.6, 4);
        this.wander.x = rand(-1, 1);
        this.wander.y = rand(-0.4, 0.4);
      }
      desX = this.wander.x * speed * 0.8;
      desY = this.wander.y * speed * 0.5;
    }

    if (this.def.floor) {
      var ty = lvl.floorY - this.size() * 0.42;
      desY = (ty - this.y) * 3;
    }
    var margin = 46 * sc;
    if (this.x < b.l + margin) desX += (b.l + margin - this.x) * 2.6;
    if (this.x > b.r - margin) desX -= (this.x - (b.r - margin)) * 2.6;
    if (this.y < b.t + margin * 0.6) desY += (b.t + margin * 0.6 - this.y) * 2.6;
    if (this.y > b.b - margin * 0.6) desY -= (this.y - (b.b - margin * 0.6)) * 2.6;

    this.vx = approach(this.vx, desX, 300 * sc, dt);
    this.vy = approach(this.vy, desY, 300 * sc, dt);
    this.x = clamp(this.x + this.vx * dt, b.l, b.r);
    this.y = clamp(this.y + this.vy * dt, b.t, lvl.floorY);
    if (Math.abs(this.vx) > 6) this.dir = this.vx > 0 ? 1 : -1;
  };

  Pet.prototype.draw = function (ctx) {
    var s = this.size();
    if (this.fx > 0) {
      art.drawRing(ctx, this.x, this.y, s * (0.6 + (0.4 - this.fx) * 2.2), clamp(this.fx * 1.6, 0, 0.8), this.def.c2 || '#ffffff', 3);
    }
    art.drawPet(ctx, {
      x: this.x, y: this.y, s: s, dir: this.dir, phase: this.phase,
      c1: this.def.c1, c2: this.def.c2, shape: this.def.shape, acc: this.def.acc,
      mood: 'ok', tilt: clamp(this.vy / 300, -0.25, 0.25) * (this.dir > 0 ? 1 : -1)
    });
  };

  /* ================================================================= aliens */
  function Alien(level, key, hpMul) {
    this.level = level;
    this.def = data.aliens[key];
    this.key = key;
    this.maxHp = Math.round(this.def.hp * (hpMul || 1));
    this.hp = this.maxHp;
    var b = level.bounds;
    this.fromLeft = util.chance(0.5);
    this.x = this.fromLeft ? b.l - 120 : b.r + 120;
    this.y = rand(b.t + 80, b.b - 80);
    if (this.def.ai === 'bomber' || this.def.ai === 'golem') this.y = level.floorY - this.def.size * 0.5 * level.scale;
    if (this.def.ai === 'boss') this.y = (b.t + b.b) / 2;
    this.vx = 0; this.vy = 0;
    this.dir = this.fromLeft ? 1 : -1;
    this.phase = rand(0, TAU);
    this.state = 'enter';
    this.stateTime = 0;
    this.meals = 0;
    this.steals = 0;
    this.eatCd = 0;
    this.fireCd = (this.def.fireGap || 5) * 0.6;
    this.flash = 0;
    this.mouthOpen = 0;
    this.stun = 0;
    this.passive = false;
    this.passiveTimer = rand(6, 11);
    this.target = null;
    this.dying = false;
    this.dyingTime = 0;
    this.dead = false;
    this.life = 0;
    this.phaseIndex = 0;
    this.minionCd = 12;
    this.enterX = this.fromLeft ? b.l + rand(120, 200) : b.r - rand(120, 200);
    audio.play(this.def.ai === 'boss' ? 'boss_roar' : 'alien_spawn');
    level.alarm = 1.6;
    level.stats.aliens++;
  }
  Alien.prototype.size = function () {
    var s = this.def.size * this.level.scale;
    if (this.def.ai === 'boss') s *= util.lerp(0.6, 1, clamp(this.life / 2.5, 0, 1));
    return s;
  };
  Alien.prototype.speed = function () {
    var s = this.def.speed * this.level.scale * this.level.alienSlow;
    if (this.def.ai === 'boss' && this.phaseIndex >= 1) s *= 1.25;
    if (this.stun > 0) s *= 0.25;
    return s;
  };
  Alien.prototype.knock = function (fx, fy, force) {
    var dx = this.x - fx, dy = this.y - fy;
    var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (this.def.ai === 'boss') force *= 0.18;
    this.vx += (dx / d) * force * this.level.scale;
    this.vy += (dy / d) * force * 0.4 * this.level.scale;
    this.stun = Math.max(this.stun, 0.35);
  };
  Alien.prototype.damage = function (amount, source) {
    if (this.dying || this.dead) return;
    if (this.def.ai === 'golem' && source === 'laser') {
      this.flash = 0.4;
      if (util.chance(0.25)) this.level.pop('immune!', this.x, this.y - this.size() * 0.5, '#8ff0ff');
      audio.play('deflect');
      return;
    }
    if (this.passive && source === 'laser') {
      this.hp = Math.min(this.maxHp, this.hp + amount);
      this.level.pop('+heal', this.x, this.y - this.size() * 0.4, '#7fe4ff');
      audio.play('deflect');
      return;
    }
    this.hp -= amount;
    this.flash = 0.35;
    if (source === 'laser' || source === 'orb') audio.play('hit');
    if (this.hp <= 0) this.kill();
  };
  Alien.prototype.kill = function () {
    if (this.dying) return;
    this.dying = true;
    this.dyingTime = 0;
    this.level.stats.killed++;
    audio.play('explode');
    this.level.shake(this.def.ai === 'boss' ? 26 : 12);
    var loot = this.def.loot || {};
    var self = this;
    Object.keys(loot).forEach(function (type) {
      for (var i = 0; i < loot[type]; i++) {
        self.level.spawnDrop(type, self.x + rand(-40, 40), self.y + rand(-20, 20), { vx: rand(-60, 60), vy: rand(-90, -20) });
      }
    });
    this.level.burst(this.x, this.y, { count: 40, color: '#ffd166', speed: 320, size: 5, kind: 'spark' });
    this.level.burst(this.x, this.y, { count: 22, color: '#ff6b52', speed: 200, size: 8, kind: 'chunk' });
    this.level.ring(this.x, this.y, this.size() * 2.4, this.def.ai === 'boss' ? '#ff5c4d' : '#ffe066');
    this.level.onAlienKilled(this);
  };

  Alien.prototype.pickFishTarget = function (farthest) {
    var best = null, bestD = farthest ? -1 : Infinity;
    var list = this.level.fish;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (f.dead) continue;
      var d = dist(this.x, this.y, f.x, f.y);
      if (farthest ? d > bestD : d < bestD) { bestD = d; best = f; }
    }
    return best;
  };

  Alien.prototype.update = function (dt) {
    var lvl = this.level, b = lvl.bounds, sc = lvl.scale;
    this.phase += dt * 3;
    this.life += dt;
    this.stateTime += dt;
    if (this.flash > 0) this.flash -= dt * 2.4;
    if (this.mouthOpen > 0) this.mouthOpen -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.eatCd > 0) this.eatCd -= dt;

    if (this.dying) {
      this.dyingTime += dt;
      this.y += 40 * sc * dt;
      if (this.dyingTime > 0.7) this.dead = true;
      return;
    }

    var sp = this.speed(), desX = 0, desY = 0;

    if (this.state === 'enter') {
      desX = (this.enterX - this.x) * 2.2;
      desY = 0;
      if (Math.abs(this.x - this.enterX) < 24) this.state = 'hunt';
    } else if (this.state === 'leave') {
      desX = (this.fromLeft ? -1 : 1) * sp * 1.7;
      desY = -12 * sc;
      if (this.x < b.l - 160 || this.x > b.r + 160) this.dead = true;
    } else {
      switch (this.def.ai) {
        case 'eater':
        case 'brute':
        case 'squid':
          if (this.def.ai === 'squid') {
            this.passiveTimer -= dt;
            if (this.passiveTimer <= 0) {
              this.passive = !this.passive;
              this.passiveTimer = this.passive ? rand(3.5, 5) : rand(7, 12);
            }
          }
          if (!this.target || this.target.dead) this.target = this.pickFishTarget(false);
          if (this.target) {
            var dx = this.target.x - this.x, dy = this.target.y - this.y;
            var dd = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            desX = (dx / dd) * sp * 1.15;
            desY = (dy / dd) * sp;
            if (dd < this.size() * 0.42 + this.target.size() * 0.35 && this.eatCd <= 0) {
              this.target.consume();
              this.mouthOpen = 0.4;
              this.eatCd = 2.2;
              this.meals++;
              audio.play('chomp');
              lvl.shake(7);
              lvl.pop('eaten!', this.x, this.y - this.size() * 0.4, '#ff9aa2');
              lvl.stats.lost++;
              this.target = null;
              if (this.def.maxMeals && this.meals >= this.def.maxMeals) this.state = 'leave';
            }
          } else {
            desX = Math.sin(this.life * 0.7) * sp;
            desY = Math.cos(this.life * 0.5) * sp * 0.4;
          }
          break;

        case 'thief':
          if (!this.target || this.target.dead || this.target.collected) this.target = null;
          if (!this.target) {
            var nearest = null, nd = Infinity;
            for (var i = 0; i < lvl.drops.length; i++) {
              var dr = lvl.drops[i];
              if (dr.dead || dr.collected) continue;
              var d2 = dist(this.x, this.y, dr.x, dr.y);
              if (d2 < nd) { nd = d2; nearest = dr; }
            }
            this.target = nearest;
          }
          if (this.target) {
            var tdx = this.target.x - this.x, tdy = this.target.y - this.y;
            var tdd = Math.max(1, Math.sqrt(tdx * tdx + tdy * tdy));
            desX = (tdx / tdd) * sp;
            desY = (tdy / tdd) * sp * 0.8;
            if (tdd < this.size() * 0.5) {
              this.target.dead = true;
              this.steals++;
              audio.play('pop');
              lvl.pop('stolen!', this.x, this.y - 20, '#ff9aa2');
              lvl.burst(this.target.x, this.target.y, { count: 8, color: '#42d69a', speed: 140, size: 3, kind: 'spark' });
              this.target = null;
              if (this.steals >= 4) this.state = 'leave';
            }
          } else {
            desX = Math.sin(this.life * 1.4) * sp * 0.6;
            desY = Math.cos(this.life * 1.1) * sp * 0.4;
            if (this.stateTime > 16) this.state = 'leave';
          }
          break;

        case 'bomber':
        case 'golem':
          desY = (lvl.floorY - this.size() * 0.46 - this.y) * 3;
          desX = Math.sin(this.life * 0.5) * sp;
          this.fireCd -= dt;
          if (this.fireCd <= 0) {
            var victim = this.pickFishTarget(this.def.ai === 'bomber');
            if (victim) {
              this.fireCd = this.def.fireGap;
              var shots = this.def.ai === 'bomber' ? 3 : 2;
              for (var s = 0; s < shots; s++) {
                lvl.projectiles.push(new Projectile(lvl, this.def.ai === 'bomber' ? 'missile' : 'orb',
                  this.x + (s - 1) * 14 * sc, this.y - this.size() * 0.4, {
                    target: victim, owner: this, speed: this.def.ai === 'bomber' ? 132 : 116, damage: 1, delay: s * 0.28
                  }));
              }
              audio.play(this.def.ai === 'bomber' ? 'laser' : 'magic');
            } else this.fireCd = 1.4;
          }
          break;

        case 'boss':
          var frac = this.hp / this.maxHp;
          var wantPhase = frac < 0.32 ? 2 : (frac < 0.66 ? 1 : 0);
          if (wantPhase > this.phaseIndex) {
            this.phaseIndex = wantPhase;
            audio.play('boss_roar');
            lvl.shake(24);
            lvl.pop('THE MAW RAGES', lvl.W / 2, lvl.bounds.t + 90, '#ff5c4d');
            lvl.ring(this.x, this.y, this.size() * 2, '#ff5c4d');
          }
          if (!this.target || this.target.dead) this.target = this.pickFishTarget(false);
          if (this.target) {
            var bdx = this.target.x - this.x, bdy = this.target.y - this.y;
            var bdd = Math.max(1, Math.sqrt(bdx * bdx + bdy * bdy));
            desX = (bdx / bdd) * sp;
            desY = (bdy / bdd) * sp * 0.8;
            if (bdd < this.size() * 0.24 + this.target.size() * 0.3 && this.eatCd <= 0) {
              this.target.consume();
              this.eatCd = 5.5;
              this.mouthOpen = 0.5;
              audio.play('chomp');
              lvl.shake(10);
              lvl.stats.lost++;
              this.target = null;
            }
          } else {
            desX = Math.sin(this.life * 0.4) * sp;
            desY = Math.cos(this.life * 0.33) * sp * 0.5;
          }
          this.fireCd -= dt;
          if (this.fireCd <= 0) {
            this.fireCd = this.def.fireGap * (this.phaseIndex >= 2 ? 0.6 : this.phaseIndex >= 1 ? 0.8 : 1);
            var bv = this.pickFishTarget(true);
            if (bv) {
              var n = 1 + this.phaseIndex;
              for (var q = 0; q < n; q++) {
                lvl.projectiles.push(new Projectile(lvl, util.chance(0.5) ? 'orb' : 'missile',
                  this.x + rand(-30, 30), this.y + rand(-10, 30), { target: bv, owner: this, speed: 120, damage: 1, delay: q * 0.3 }));
              }
              audio.play('magic');
            }
          }
          this.minionCd -= dt;
          if (this.minionCd <= 0) {
            this.minionCd = this.phaseIndex >= 2 ? 12 : 16;
            if (lvl.aliens.length < 4) lvl.spawnAlien(util.chance(0.6) ? 'gnasher' : 'thief');
          }
          break;
      }
    }

    /* keep inside the tank */
    var margin = this.size() * 0.5;
    if (this.state !== 'enter' && this.state !== 'leave') {
      if (this.x < b.l + margin) desX += (b.l + margin - this.x) * 3;
      if (this.x > b.r - margin) desX -= (this.x - (b.r - margin)) * 3;
      if (this.y < b.t + margin * 0.7) desY += (b.t + margin * 0.7 - this.y) * 3;
      if (this.y > b.b - margin * 0.5) desY -= (this.y - (b.b - margin * 0.5)) * 3;
    }
    this.vx = approach(this.vx, desX, 240 * sc, dt);
    this.vy = approach(this.vy, desY, 240 * sc, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 8) this.dir = this.vx > 0 ? 1 : -1;
  };

  Alien.prototype.draw = function (ctx) {
    var s = this.size();
    var c1 = this.def.c1;
    if (this.passive) c1 = '#3f8fd0';
    if (this.dying) {
      var t = this.dyingTime / 0.7;
      art.drawAlien(ctx, {
        x: this.x, y: this.y, s: s * (1 + t * 0.3), dir: this.dir, phase: this.phase,
        shape: this.def.shape, c1: c1, c2: this.def.c2, alpha: 1 - t, flash: 1 - t, mouthOpen: true
      });
      return;
    }
    art.drawAlien(ctx, {
      x: this.x, y: this.y, s: s, dir: this.dir, phase: this.phase,
      shape: this.def.shape, c1: c1, c2: this.def.c2,
      flash: this.flash, mouthOpen: this.mouthOpen > 0,
      tilt: clamp(this.vy / 300, -0.2, 0.2) * (this.dir > 0 ? 1 : -1)
    });

    /* health bar */
    var w = Math.max(46, s * 0.9), h = 7;
    var bx = this.x - w / 2, by = this.y - s * (this.def.ai === 'boss' ? 0.62 : 0.72) - 14;
    ctx.save();
    ctx.fillStyle = 'rgba(4,20,32,0.72)';
    util.roundRect(ctx, bx - 2, by - 2, w + 4, h + 4, 4);
    ctx.fill();
    var frac = clamp(this.hp / this.maxHp, 0, 1);
    var g = ctx.createLinearGradient(bx, by, bx + w, by);
    g.addColorStop(0, frac > 0.5 ? '#7ee081' : frac > 0.25 ? '#ffd166' : '#ff6b52');
    g.addColorStop(1, frac > 0.5 ? '#4fb35a' : frac > 0.25 ? '#e0a020' : '#c0392b');
    ctx.fillStyle = g;
    util.roundRect(ctx, bx, by, Math.max(2, w * frac), h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,235,255,0.5)';
    ctx.lineWidth = 1;
    util.roundRect(ctx, bx, by, w, h, 3);
    ctx.stroke();
    ctx.restore();
    if (this.passive) {
      art.text(ctx, 'DO NOT SHOOT', this.x, by - 12, { size: 12, fill: '#8ff0ff', stroke: '#04202f', strokeW: 3 });
    }
    if (this.def.ai === 'golem') {
      art.text(ctx, 'LASER PROOF', this.x, by - 12, { size: 11, fill: '#ffe066', stroke: '#04202f', strokeW: 3 });
    }
  };

  /* ============================================================ projectiles */
  function Projectile(level, kind, x, y, o) {
    o = o || {};
    this.level = level;
    this.kind = kind;
    this.x = x; this.y = y;
    this.target = o.target || null;
    this.owner = o.owner || null;
    this.speed = (o.speed || 140) * level.scale;
    this.damage = o.damage === undefined ? 1 : o.damage;
    this.friendly = !!o.friendly;
    this.delay = o.delay || 0;
    this.s = (kind === 'missile' ? 9 : kind === 'orb' ? 10 : 7) * level.scale;
    this.age = 0;
    this.life = 14;
    this.deflected = false;
    this.dead = false;
    var ang = rand(0, TAU);
    this.vx = Math.cos(ang) * this.speed * 0.4;
    this.vy = Math.sin(ang) * this.speed * 0.4;
  }
  Projectile.prototype.deflect = function () {
    if (this.deflected || this.friendly) return false;
    this.deflected = true;
    this.target = this.owner;
    this.damage = 6;
    this.speed *= 1.5;
    audio.play('deflect');
    this.level.burst(this.x, this.y, { count: 10, color: '#9dffb0', speed: 160, size: 3, kind: 'spark' });
    return true;
  };
  Projectile.prototype.destroy = function () {
    this.dead = true;
    audio.play('explode');
    this.level.burst(this.x, this.y, { count: 14, color: '#ffd166', speed: 190, size: 4, kind: 'spark' });
    this.level.ring(this.x, this.y, 40 * this.level.scale, '#ffd166');
  };
  Projectile.prototype.update = function (dt) {
    this.age += dt;
    if (this.delay > 0) { this.delay -= dt; return; }
    if (this.age > this.life) { this.dead = true; return; }

    var t = this.target;
    if (t && (t.dead || (t.dying && !this.friendly))) t = this.target = null;
    if (!t) {
      /* nothing to chase: pick a new victim of the right sort */
      if (this.friendly || this.deflected) {
        for (var i = 0; i < this.level.aliens.length; i++) {
          var a = this.level.aliens[i];
          if (!a.dead && !a.dying) { t = this.target = a; break; }
        }
      } else {
        t = this.target = this.level.randomFish();
      }
    }
    if (t) {
      var dx = t.x - this.x, dy = t.y - this.y;
      var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      var turn = (this.kind === 'orb' ? 3.6 : 5.2) * (this.deflected ? 2 : 1);
      this.vx = approach(this.vx, (dx / d) * this.speed, this.speed * turn, dt);
      this.vy = approach(this.vy, (dy / d) * this.speed, this.speed * turn, dt);
      if (d < (this.s + (t.size ? t.size() * 0.4 : 20))) {
        if (this.friendly || this.deflected) {
          t.damage(this.damage, this.deflected ? 'orb' : 'pet');
          this.level.burst(this.x, this.y, { count: 8, color: '#ffe066', speed: 150, size: 3, kind: 'spark' });
        } else {
          /* hit a fish */
          if (t.die) {
            t.die('blast');
            this.level.shake(8);
            this.level.burst(this.x, this.y, { count: 18, color: '#ff8f4d', speed: 220, size: 4, kind: 'spark' });
            audio.play('explode');
          }
        }
        this.dead = true;
        return;
      }
    } else {
      this.vy += 40 * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    var b = this.level.bounds;
    if (this.x < b.l - 80 || this.x > b.r + 80 || this.y < b.t - 80 || this.y > b.b + 120) this.dead = true;
  };
  Projectile.prototype.draw = function (ctx) {
    if (this.delay > 0) return;
    art.drawProjectile(ctx, {
      x: this.x, y: this.y, s: this.s, kind: this.kind,
      vx: this.vx, vy: this.vy, age: this.age, deflected: this.deflected
    });
    if (!this.friendly && !this.deflected) {
      /* a clickable threat: ring it so the player knows to shoot */
      var pulse = 0.35 + 0.25 * Math.sin(this.age * 9);
      art.drawRing(ctx, this.x, this.y, this.s * 2.6, pulse, this.kind === 'orb' ? '#ffe066' : '#ff8f4d', 1.6);
    }
  };

  /* ============================================================== particles */
  function Particle(level, x, y, o) {
    this.x = x; this.y = y;
    this.vx = o.vx; this.vy = o.vy;
    this.g = o.g === undefined ? 90 : o.g;
    this.life = o.life;
    this.maxLife = o.life;
    this.size = o.size;
    this.color = o.color;
    this.kind = o.kind || 'spark';
    this.rot = rand(0, TAU);
    this.spin = rand(-6, 6);
    this.dead = false;
    this.drag = o.drag === undefined ? 1.6 : o.drag;
  }
  Particle.prototype.update = function (dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += this.g * dt;
    this.vx *= (1 - this.drag * dt);
    this.vy *= (1 - this.drag * dt * 0.6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
  };
  Particle.prototype.draw = function (ctx) {
    var t = clamp(this.life / this.maxLife, 0, 1);
    if (this.kind === 'sparkle') {
      art.drawSparkle(ctx, this.x, this.y, this.size * (1 + (1 - t) * 2.2), this.rot, this.color, t * 0.9);
    } else if (this.kind === 'ring') {
      /* expanding shockwave - reads better than a star at large sizes */
      var r = this.size * (1 + (1 - t) * 1.9);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = util.rgba(this.color, t * 0.8);
      ctx.lineWidth = 1 + this.size * 0.1 * t;
      art.circle(ctx, this.x, this.y, r);
      ctx.stroke();
      ctx.restore();
    } else if (this.kind === 'bubble') {
      ctx.save();
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = 'rgba(220,250,255,0.9)';
      ctx.fillStyle = 'rgba(180,240,255,0.18)';
      ctx.lineWidth = 1.2;
      art.circle(ctx, this.x, this.y, this.size);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (this.kind === 'chunk') {
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size, -this.size * 0.7, this.size * 2, this.size * 1.4);
      ctx.restore();
    } else if (this.kind === 'confetti') {
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size * 0.5, -this.size * 1.6, this.size, this.size * 3.2);
      ctx.restore();
    } else {
      /* Two flat circles instead of a radial gradient: at spark size the look
       * is the same and an explosion can throw hundreds of these at once. */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = this.color;
      art.circle(ctx, this.x, this.y, this.size * 2.1);
      ctx.fill();
      ctx.globalAlpha = t;
      art.circle(ctx, this.x, this.y, this.size * 0.85);
      ctx.fill();
      ctx.restore();
    }
  };

  /* ---------------------------------------------------------- floating text */
  function TextPop(x, y, str, color, size) {
    this.x = x; this.y = y;
    this.text = str;
    this.color = color || '#ffffff';
    this.size = size || 17;
    this.life = 1.3;
    this.maxLife = 1.3;
    this.vy = -46;
    this.dead = false;
  }
  TextPop.prototype.update = function (dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.y += this.vy * dt;
    this.vy *= (1 - 1.1 * dt);
  };
  TextPop.prototype.draw = function (ctx) {
    var t = clamp(this.life / this.maxLife, 0, 1);
    var pop = this.life > this.maxLife - 0.12 ? util.lerp(1.5, 1, (this.maxLife - this.life) / 0.12) : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6);
    art.text(ctx, this.text, this.x, this.y, {
      size: this.size * pop, fill: this.color, stroke: '#04202f', strokeW: 4
    });
    ctx.restore();
  };

  /* --------------------------------------------------------- transient beam */
  function Beam(x1, y1, x2, y2, kind, color) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.kind = kind || 'laser';
    this.color = color || '#ff5f4d';
    this.life = kind === 'lightning' ? 0.22 : 0.14;
    this.maxLife = this.life;
    this.seed = (Math.random() * 1e6) | 0;
    this.dead = false;
  }
  Beam.prototype.update = function (dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  };
  Beam.prototype.draw = function (ctx) {
    var t = clamp(this.life / this.maxLife, 0, 1);
    if (this.kind === 'lightning') {
      art.drawLightning(ctx, this.x1, this.y1, this.x2, this.y2, this.seed, this.color, 2 + t * 3);
    } else if (this.kind === 'magic') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = util.rgba(this.color, t * 0.8);
      ctx.lineWidth = 2 + t * 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
      ctx.restore();
    } else {
      art.drawLaser(ctx, this.x1, this.y1, this.x2, this.y2, t, this.color);
    }
  };

  CQ.ent = {
    Food: Food, Drop: Drop, Fish: Fish, Pet: Pet, Alien: Alien,
    Projectile: Projectile, Particle: Particle, TextPop: TextPop, Beam: Beam
  };
})();
