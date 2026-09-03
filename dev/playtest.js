/* Crazee-quarium playtest harness (dev only, not shipped).
 * Runs the real game loop faster than real time with a bot that plays like a
 * competent human, so the whole 21-level ladder can be verified end to end.
 * Load in the console:  var s=document.createElement('script');s.src='/dev/playtest.js';document.head.appendChild(s)
 */
window.CQTEST = (function () {
  var T = { errors: [] };

  function guard(label, fn) {
    try { fn(); return true; }
    catch (e) {
      T.errors.push(label + ': ' + (e && e.message) + ' | ' + ((e && e.stack || '').split('\n')[1] || ''));
      return false;
    }
  }

  function consumerFor(lv, type) {
    for (var i = 0; i < lv.fish.length; i++) {
      var f = lv.fish[i];
      if (f.dead || f.dying) continue;
      if (f.def.diet.kind === 'drop' && f.def.diet.types.indexOf(type) >= 0) return true;
    }
    return false;
  }

  function bot(g, lv, dt) {
    if (!lv || lv.state !== 'playing') return;
    var i;

    /* collect coins; leave fresh stars and beetles for the fish that eat them */
    for (i = 0; i < lv.drops.length; i++) {
      var d = lv.drops[i];
      if (d.dead || d.collected || d.age < 0.35) continue;
      if (d.def.edible && d.age < 3.5 && consumerFor(lv, d.type)) continue;
      if (Math.random() < 0.1) continue;
      d.collect(false);
    }

    /* Combat on a human click budget: one click every 0.2s (a brisk five a
     * second), spent on the most urgent thing. Alien damage is click-only, so
     * this is what the difficulty actually feels like. */
    lv.botFire = (lv.botFire || 0) - dt;
    if (lv.botFire <= 0) {
      var clicked = false;
      /* a shot already in flight is the priority */
      for (i = 0; i < lv.projectiles.length && !clicked; i++) {
        var pr = lv.projectiles[i];
        if (pr.dead || pr.friendly || pr.deflected || pr.delay > 0 || pr.age < 0.4) continue;
        lv.pointerAction(pr.x, pr.y, false);
        clicked = true;
      }
      for (i = 0; i < lv.aliens.length && !clicked; i++) {
        var al = lv.aliens[i];
        if (al.dead || al.dying || al.def.ai === 'golem' || al.passive) continue;
        lv.pointerAction(al.x, al.y, false);
        clicked = true;
      }
      if (clicked) lv.botFire = 0.2;
      else lv.botFire = 0.05;
    }

    /* feed whoever needs it most */
    lv.botFeed = (lv.botFeed || 0) - dt;
    if (lv.botFeed <= 0 && lv.paidFoodCount() < lv.maxFood()) {
      var hungriest = null, low = 1.1;
      for (i = 0; i < lv.fish.length; i++) {
        var f = lv.fish[i];
        if (f.dead || f.dying || f.def.diet.kind !== 'food') continue;
        var need = f.fullness - (f.def.growth.length && f.stage < f.def.stages.length - 1 ? 0.35 : 0);
        if (need < low) { low = need; hungriest = f; }
      }
      if (hungriest && low < 0.85) {
        lv.botFeed = 0.35;
        lv.spawnFood(hungriest.x + (Math.random() - 0.5) * 40, Math.max(lv.bounds.t + 8, hungriest.y - 70), false);
      } else lv.botFeed = 0.2;
    }

    /* spend */
    lv.botBuy = (lv.botBuy || 0) - dt;
    if (lv.botBuy > 0) return;
    lv.botBuy = 0.6;
    var list = lv.shopList(), by = {};
    for (i = 0; i < list.length; i++) by[list[i].key] = list[i];
    var reserve = 200 + lv.cfg.tank * 200;
    var gup = 0, counts = {};
    for (i = 0; i < lv.fish.length; i++) {
      var ff = lv.fish[i];
      if (ff.dead || ff.dying) continue;
      counts[ff.species] = (counts[ff.species] || 0) + 1;
      if (ff.species === 'guppy') gup++;
    }
    function can(it, keep) {
      return it && !it.maxed && it.afford && lv.money - it.price >= (keep === undefined ? reserve : keep);
    }
    if (gup === 0 && by.guppy && by.guppy.afford) { lv.buy(by.guppy); return; }
    if (by.maxfood && can(by.maxfood, 0) && lv.time > 6) { lv.buy(by.maxfood); return; }
    if (by.food && can(by.food, 0) && lv.time > 10) { lv.buy(by.food); return; }
    if (by.laser && can(by.laser) && lv.cfg.aliens.length && lv.time > 25) { lv.buy(by.laser); return; }
    if (by.guppy && can(by.guppy) && gup < 5) { lv.buy(by.guppy); return; }
    if (by.starcatcher && can(by.starcatcher, reserve + 150) && (counts.starcatcher || 0) < 3 && gup >= 3) { lv.buy(by.starcatcher); return; }
    if (by.cruncher && can(by.cruncher, reserve + 150) && (counts.cruncher || 0) < 2 && gup >= 5) { lv.buy(by.cruncher); return; }
    if (by.muncher && can(by.muncher, reserve + 250) && (counts.muncher || 0) < 2 && (counts.cruncher || 0) >= 1) { lv.buy(by.muncher); return; }
    if (by.carnivore && can(by.carnivore, reserve + 250) && (counts.carnivore || 0) < 4 && gup >= 5) { lv.buy(by.carnivore); return; }
    if (by.ultravore && can(by.ultravore, reserve + 500) && (counts.ultravore || 0) < 2 && (counts.carnivore || 0) >= 2) { lv.buy(by.ultravore); return; }
    if (by.breeder && can(by.breeder, reserve + 250) && (counts.breeder || 0) < 2) { lv.buy(by.breeder); return; }
    if (by.guppy && can(by.guppy) && gup < (lv.cfg.tank >= 2 ? 10 : 8)) { lv.buy(by.guppy); return; }
    if (by.egg && !by.egg.maxed && by.egg.afford && lv.money - by.egg.price >= reserve) { lv.buy(by.egg); return; }
  }

  T.reset = function () { T.errors = []; };

  T.run = function (seconds, opts) {
    opts = opts || {};
    var g = CQ.dev.game, dt = 1 / 60, steps = Math.round(seconds / dt), drew = 0;
    for (var i = 0; i < steps; i++) {
      if (!guard('update@' + g.screen, function () { g.update(dt); })) break;
      if (opts.bot !== false && !guard('bot@' + g.screen, function () { bot(g, g.level, dt); })) break;
      if (i % 40 === 0) {
        if (!guard('draw@' + g.screen, function () { g.draw(g.ctx); })) break;
        drew++;
      }
      if (opts.until && opts.until(g)) break;
    }
    return { screen: g.screen, drew: drew, errors: T.errors.slice(-6), t: g.level ? Math.round(g.level.time) : null };
  };

  T.wipe = function () {
    localStorage.clear();
    CQ.dev.game.save = {
      v: 1, unlocked: 0, pets: [], loadout: [], won: false,
      totals: { collected: 0, killed: 0, lost: 0, fed: 0, spent: 0, fails: 0, wins: 0 },
      session: null, updated: 0
    };
    return 'wiped';
  };

  /* Pets a thoughtful player would take, in preference order. */
  var PREF = ['sparky', 'turbo', 'shelly', 'fang', 'sprinkle', 'magneta', 'verdant', 'shrap', 'mama', 'nickel', 'patch', 'oracle'];

  T.pickPets = function () {
    var g = CQ.dev.game, pets = [];
    for (var w = 0; w < PREF.length && pets.length < 3; w++) {
      if (g.save.pets.indexOf(PREF[w]) >= 0) pets.push(PREF[w]);
    }
    for (var p = 0; p < g.save.pets.length && pets.length < 3; p++) {
      if (pets.indexOf(g.save.pets[p]) < 0) pets.push(g.save.pets[p]);
    }
    return pets;
  };

  T.playRange = function (from, to, maxSec) {
    var g = CQ.dev.game, out = [];
    for (var i = from; i <= to; i++) {
      T.reset();
      g.save.unlocked = Math.max(g.save.unlocked, i);
      g.clearSession();
      var pets = T.pickPets();
      g.startLevel(i, pets);
      var r = T.run(maxSec || 420, { until: function (gg) { return gg.screen !== 'game'; } });
      var lv = g.level;
      out.push({
        lvl: CQ.data.levels[i].label,
        out: g.screen === 'levelcomplete' ? 'win'
          : (g.screen === 'win' ? 'GAME WON'
            : (g.screen === 'gameover' ? 'FAIL:' + g.failReason : 'timeout')),
        secs: r.t,
        money: lv ? Math.round(lv.money) : null,
        eggs: lv ? lv.eggPieces : null,
        lost: lv ? lv.stats.lost : null,
        kills: lv ? lv.stats.killed : null,
        pets: pets.join(','),
        err: r.errors
      });
      if (g.screen === 'levelcomplete') g.afterLevelComplete();
      if (g.screen === 'win') break;
    }
    return out;
  };

  return T;
})();
