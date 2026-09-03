/* Crazee-quarium :: audio.js
 * Every sound effect is synthesised at runtime with the Web Audio API - no sample files.
 * The two music tracks are the only audio assets and play through <audio> elements.
 */
(function () {
  'use strict';
  var CQ = window.CQ, util = CQ.util;

  var SETTINGS_KEY = 'crazeequarium.audio.v1';

  var ctx = null;
  var fxBus = null;
  var noiseBuf = null;
  var unlocked = false;
  var lastPlay = {};
  var active = 0;

  var musicEl = null, endEl = null;
  var wanted = 'none';
  var fadeTimer = null;

  var settings = { fx: 0.8, music: 0.5, muted: false };

  /* ------------------------------------------------------------------ setup */

  function boot() {
    var saved = CQ.storage.load(SETTINGS_KEY, null);
    if (saved) {
      if (typeof saved.fx === 'number') settings.fx = util.clamp(saved.fx, 0, 1);
      if (typeof saved.music === 'number') settings.music = util.clamp(saved.music, 0, 1);
      settings.muted = !!saved.muted;
    }
    musicEl = document.getElementById('music-loop');
    endEl = document.getElementById('music-end');
    if (endEl) {
      endEl.addEventListener('ended', function () {
        /* Keep the tank scored: slide back to the looping theme when the finale ends. */
        if (wanted === 'end') music('loop');
      });
    }
    applyVolumes();
  }

  function save() { CQ.storage.save(SETTINGS_KEY, settings); }

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      fxBus = ctx.createGain();
      fxBus.gain.value = settings.muted ? 0 : settings.fx;
      var comp = null;
      if (ctx.createDynamicsCompressor) {
        comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 20;
        comp.ratio.value = 8;
        fxBus.connect(comp);
        comp.connect(ctx.destination);
      } else {
        fxBus.connect(ctx.destination);
      }
      /* One second of white noise, reused by every noise-based effect. */
      var len = Math.floor(ctx.sampleRate);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }

  /* Called from the first real user gesture: browsers gate audio behind one. */
  function unlock() {
    if (unlocked) { ensureCtx(); return; }
    unlocked = true;
    ensureCtx();
    if (wanted !== 'none') music(wanted);
  }

  function applyVolumes() {
    var m = settings.muted ? 0 : settings.music;
    if (musicEl) musicEl.volume = util.clamp(m, 0, 1);
    if (endEl) endEl.volume = util.clamp(m, 0, 1);
    if (fxBus) fxBus.gain.value = settings.muted ? 0 : settings.fx;
  }

  /* ------------------------------------------------------- synth primitives */

  function noteFreq(semisFromA4) { return 440 * Math.pow(2, semisFromA4 / 12); }

  function tone(o) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.15;
    var peak = Math.max(0.0004, o.gain === undefined ? 0.25 : o.gain);
    var attack = o.attack === undefined ? 0.006 : o.attack;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    var tail = g;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.fc || 1200;
      f.Q.value = o.q === undefined ? 1 : o.q;
      g.connect(f);
      tail = f;
    }
    tail.connect(o.dest || fxBus);

    var voices = o.detune ? [0, o.detune] : [0];
    for (var i = 0; i < voices.length; i++) {
      var osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      var f0 = o.f0 * Math.pow(2, voices[i] / 1200);
      osc.frequency.setValueAtTime(f0, t0);
      if (o.f1 && o.f1 !== o.f0) {
        var f1 = Math.max(8, o.f1 * Math.pow(2, voices[i] / 1200));
        if (o.linear) osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
        else osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      }
      if (o.vibrato) {
        var lfo = ctx.createOscillator();
        var lg = ctx.createGain();
        lfo.frequency.value = o.vibrato;
        lg.gain.value = o.vibratoDepth || 8;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
      }
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }
  }

  function noise(o) {
    if (!ctx || !noiseBuf) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.2;
    var peak = Math.max(0.0004, o.gain === undefined ? 0.2 : o.gain);
    var attack = o.attack === undefined ? 0.005 : o.attack;

    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;

    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(Math.max(20, o.f0 || 900), t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    f.Q.value = o.q === undefined ? 1 : o.q;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(f); f.connect(g); g.connect(o.dest || fxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  function arp(freqs, o) {
    o = o || {};
    for (var i = 0; i < freqs.length; i++) {
      tone({
        type: o.type || 'triangle',
        f0: freqs[i],
        dur: o.dur || 0.14,
        gain: (o.gain === undefined ? 0.16 : o.gain) * (o.decayPerStep ? Math.pow(0.9, i) : 1),
        delay: (o.delay || 0) + i * (o.step || 0.07)
      });
      if (o.bell) {
        tone({ type: 'sine', f0: freqs[i] * 2, dur: (o.dur || 0.14) * 1.6, gain: 0.05, delay: (o.delay || 0) + i * (o.step || 0.07) });
      }
    }
  }

  /* ----------------------------------------------------------- sound recipes */

  var C5 = noteFreq(3), D5 = noteFreq(5), E5 = noteFreq(7), F5 = noteFreq(8),
      G5 = noteFreq(10), A5 = noteFreq(12), B5 = noteFreq(14), C6 = noteFreq(15),
      D6 = noteFreq(17), E6 = noteFreq(19), G6 = noteFreq(22), C7 = noteFreq(27);

  var recipes = {
    click: function () {
      tone({ type: 'square', f0: 480, f1: 660, dur: 0.05, gain: 0.09 });
    },
    tick: function () {
      tone({ type: 'square', f0: 1100, dur: 0.025, gain: 0.05 });
    },
    back: function () {
      tone({ type: 'square', f0: 420, f1: 240, dur: 0.09, gain: 0.09 });
    },
    denied: function () {
      tone({ type: 'square', f0: 200, f1: 150, dur: 0.13, gain: 0.09, filter: 'lowpass', fc: 900 });
      tone({ type: 'square', f0: 150, f1: 110, dur: 0.16, gain: 0.07, delay: 0.09 });
    },
    food: function () {
      tone({ type: 'sine', f0: 880, f1: 380, dur: 0.09, gain: 0.13 });
      noise({ filter: 'bandpass', f0: 2400, f1: 900, dur: 0.06, gain: 0.04, q: 2 });
    },
    eat: function () {
      noise({ filter: 'lowpass', f0: 1500, f1: 260, dur: 0.09, gain: 0.14, q: 2 });
      tone({ type: 'triangle', f0: 240, f1: 120, dur: 0.09, gain: 0.09 });
    },
    chomp: function () {
      noise({ filter: 'lowpass', f0: 900, f1: 140, dur: 0.16, gain: 0.22, q: 3 });
      tone({ type: 'sawtooth', f0: 180, f1: 70, dur: 0.18, gain: 0.12, filter: 'lowpass', fc: 700 });
    },
    coin: function (o) {
      var p = (o && o.pitch) || 1;
      tone({ type: 'triangle', f0: B5 * p, dur: 0.055, gain: 0.13 });
      tone({ type: 'triangle', f0: E6 * p, dur: 0.13, gain: 0.11, delay: 0.05 });
      tone({ type: 'sine', f0: E6 * 2 * p, dur: 0.09, gain: 0.03, delay: 0.05 });
    },
    coin_big: function () {
      arp([C6, E6, G6, C7], { type: 'triangle', step: 0.055, dur: 0.16, gain: 0.13, bell: true });
    },
    gem: function () {
      tone({ type: 'sine', f0: C7, dur: 0.5, gain: 0.09 });
      arp([G6, C7, E6 * 2], { type: 'sine', step: 0.05, dur: 0.3, gain: 0.07 });
      noise({ filter: 'highpass', f0: 6000, dur: 0.2, gain: 0.03 });
    },
    grow: function () {
      tone({ type: 'sine', f0: 420, f1: 900, dur: 0.26, gain: 0.13 });
      tone({ type: 'triangle', f0: 630, f1: 1350, dur: 0.22, gain: 0.06, delay: 0.04 });
    },
    born: function () {
      tone({ type: 'sine', f0: 620, f1: 1250, dur: 0.14, gain: 0.11 });
      tone({ type: 'sine', f0: 1250, f1: 1000, dur: 0.1, gain: 0.07, delay: 0.13 });
    },
    hungry: function () {
      tone({ type: 'triangle', f0: 300, f1: 220, dur: 0.18, gain: 0.06 });
    },
    fish_die: function () {
      tone({ type: 'sawtooth', f0: 320, f1: 70, dur: 0.55, gain: 0.13, filter: 'lowpass', fc: 800, q: 1.5 });
      noise({ filter: 'lowpass', f0: 700, f1: 150, dur: 0.4, gain: 0.06 });
    },
    laser: function () {
      tone({ type: 'sawtooth', f0: 1500, f1: 180, dur: 0.09, gain: 0.11, filter: 'lowpass', fc: 3000 });
      noise({ filter: 'bandpass', f0: 3200, f1: 700, dur: 0.06, gain: 0.05, q: 1.5 });
    },
    hit: function () {
      noise({ filter: 'lowpass', f0: 1000, f1: 180, dur: 0.12, gain: 0.16, q: 2 });
      tone({ type: 'square', f0: 150, f1: 90, dur: 0.1, gain: 0.08 });
    },
    deflect: function () {
      tone({ type: 'square', f0: 1400, f1: 2100, dur: 0.12, gain: 0.08, filter: 'bandpass', fc: 1800, q: 6, detune: 22 });
      noise({ filter: 'highpass', f0: 5000, dur: 0.1, gain: 0.04 });
    },
    explode: function () {
      noise({ filter: 'lowpass', f0: 2200, f1: 80, dur: 0.55, gain: 0.3, q: 1.2 });
      tone({ type: 'sine', f0: 140, f1: 40, dur: 0.5, gain: 0.2 });
      tone({ type: 'sawtooth', f0: 260, f1: 60, dur: 0.3, gain: 0.08, filter: 'lowpass', fc: 600 });
    },
    zap: function () {
      noise({ filter: 'bandpass', f0: 3400, f1: 900, dur: 0.14, gain: 0.12, q: 3 });
      tone({ type: 'sawtooth', f0: 900, f1: 180, dur: 0.12, gain: 0.08 });
    },
    spike: function () {
      tone({ type: 'square', f0: 700, f1: 1500, dur: 0.07, gain: 0.06 });
    },
    alien_spawn: function () {
      tone({ type: 'sawtooth', f0: 78, f1: 58, dur: 1.3, gain: 0.16, filter: 'lowpass', fc: 320, vibrato: 5.5, vibratoDepth: 6 });
      noise({ filter: 'lowpass', f0: 240, f1: 110, dur: 1.3, gain: 0.1 });
      tone({ type: 'square', f0: 880, dur: 0.09, gain: 0.07 });
      tone({ type: 'square', f0: 660, dur: 0.12, gain: 0.07, delay: 0.14 });
    },
    alert: function () {
      tone({ type: 'square', f0: 880, dur: 0.08, gain: 0.07 });
      tone({ type: 'square', f0: 660, dur: 0.1, gain: 0.07, delay: 0.12 });
    },
    boss_roar: function () {
      tone({ type: 'sawtooth', f0: 62, f1: 44, dur: 1.9, gain: 0.26, filter: 'lowpass', fc: 260, vibrato: 3.2, vibratoDepth: 9 });
      tone({ type: 'square', f0: 96, f1: 70, dur: 1.6, gain: 0.1, filter: 'lowpass', fc: 400 });
      noise({ filter: 'lowpass', f0: 400, f1: 90, dur: 1.9, gain: 0.16 });
    },
    buy: function () {
      tone({ type: 'square', f0: 740, dur: 0.05, gain: 0.09 });
      tone({ type: 'square', f0: 990, dur: 0.07, gain: 0.09, delay: 0.05 });
      noise({ filter: 'highpass', f0: 4200, dur: 0.09, gain: 0.05, delay: 0.02 });
    },
    upgrade: function () {
      arp([C5, E5, G5, C6], { type: 'triangle', step: 0.06, dur: 0.15, gain: 0.13, bell: true });
    },
    egg_piece: function () {
      arp([E5, G5, B5, D6, E6], { type: 'sine', step: 0.075, dur: 0.3, gain: 0.12, bell: true });
      noise({ filter: 'highpass', f0: 6000, dur: 0.3, gain: 0.03, delay: 0.1 });
    },
    hatch: function () {
      noise({ filter: 'bandpass', f0: 900, f1: 3200, dur: 0.3, gain: 0.09, q: 2 });
      arp([C6, D6, E6, G6, C7], { type: 'sine', step: 0.06, dur: 0.35, gain: 0.11, bell: true, delay: 0.15 });
    },
    level_win: function () {
      arp([C5, E5, G5], { type: 'square', step: 0.11, dur: 0.16, gain: 0.1 });
      arp([C6, C6, G5, C6, E6], { type: 'triangle', step: 0.13, dur: 0.24, gain: 0.13, delay: 0.34, bell: true });
      tone({ type: 'sine', f0: C7, dur: 0.9, gain: 0.07, delay: 0.85 });
    },
    level_fail: function () {
      arp([noteFreq(10), noteFreq(6), noteFreq(1), noteFreq(-2)], { type: 'sawtooth', step: 0.17, dur: 0.4, gain: 0.11 });
      noise({ filter: 'lowpass', f0: 500, f1: 90, dur: 0.9, gain: 0.06, delay: 0.2 });
    },
    fanfare: function () {
      arp([C5, E5, G5, C6, E6, G6, C7], { type: 'triangle', step: 0.09, dur: 0.4, gain: 0.13, bell: true });
      tone({ type: 'sine', f0: C5 / 2, dur: 1.6, gain: 0.09 });
    },
    sparkle: function () {
      for (var i = 0; i < 5; i++) {
        tone({ type: 'sine', f0: util.rand(1400, 3600), dur: 0.14, gain: 0.05, delay: i * 0.05 });
      }
    },
    splash: function () {
      noise({ filter: 'bandpass', f0: 1400, f1: 320, dur: 0.32, gain: 0.14, q: 0.8 });
    },
    bubble: function () {
      tone({ type: 'sine', f0: util.rand(260, 420), f1: util.rand(700, 1100), dur: 0.11, gain: 0.05 });
    },
    pop: function () {
      tone({ type: 'sine', f0: 1200, f1: 520, dur: 0.06, gain: 0.07 });
    },
    interest: function () {
      tone({ type: 'triangle', f0: 700, dur: 0.08, gain: 0.07 });
      tone({ type: 'triangle', f0: 1050, dur: 0.12, gain: 0.06, delay: 0.07 });
    },
    heal: function () {
      tone({ type: 'sine', f0: 620, f1: 1100, dur: 0.2, gain: 0.07 });
      tone({ type: 'sine', f0: 930, f1: 1650, dur: 0.18, gain: 0.04, delay: 0.05 });
    },
    magic: function () {
      tone({ type: 'sine', f0: 500, f1: 1800, dur: 0.24, gain: 0.07, vibrato: 18, vibratoDepth: 40 });
      noise({ filter: 'highpass', f0: 5200, dur: 0.22, gain: 0.03 });
    }
  };

  var minGap = {
    coin: 0.02, food: 0.03, eat: 0.04, laser: 0.05, hit: 0.04, bubble: 0.12,
    click: 0.04, tick: 0.02, spike: 0.03, pop: 0.04, hungry: 0.4
  };

  function play(name, opts) {
    if (settings.muted || settings.fx <= 0) return;
    var fn = recipes[name];
    if (!fn) return;
    if (!ensureCtx()) return;
    var t = ctx.currentTime;
    var gap = minGap[name] === undefined ? 0.03 : minGap[name];
    if (lastPlay[name] !== undefined && t - lastPlay[name] < gap) return;
    lastPlay[name] = t;
    if (active > 26) return;
    active++;
    window.setTimeout(function () { active--; }, 180);
    try { fn(opts); } catch (e) { /* never let audio break a frame */ }
  }

  /* ---------------------------------------------------------------- music */

  function tryPlay(el) {
    if (!el) return;
    var p = el.play();
    if (p && p.catch) p.catch(function () { /* waiting on a user gesture */ });
  }

  function fadeTo(el, target, ms, done) {
    if (!el) { if (done) done(); return; }
    if (fadeTimer) { window.clearInterval(fadeTimer); fadeTimer = null; }
    var from = el.volume, steps = Math.max(1, Math.round(ms / 40)), i = 0;
    fadeTimer = window.setInterval(function () {
      i++;
      el.volume = util.clamp(util.lerp(from, target, i / steps), 0, 1);
      if (i >= steps) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
        if (done) done();
      }
    }, 40);
  }

  function music(which) {
    wanted = which;
    if (!musicEl || !endEl) return;
    if (which === 'loop') {
      if (!endEl.paused) { endEl.pause(); endEl.currentTime = 0; }
      musicEl.volume = 0;
      tryPlay(musicEl);
      fadeTo(musicEl, settings.muted ? 0 : settings.music, 900);
    } else if (which === 'end') {
      var vol = settings.muted ? 0 : settings.music;
      fadeTo(musicEl, 0, 500, function () {
        musicEl.pause();
        endEl.currentTime = 0;
        endEl.volume = vol;
        tryPlay(endEl);
      });
    } else {
      musicEl.pause();
      endEl.pause();
    }
  }

  CQ.audio = {
    settings: settings,
    boot: boot,
    unlock: unlock,
    play: play,
    music: music,
    isUnlocked: function () { return unlocked; },
    musicWanted: function () { return wanted; },
    setFx: function (v) { settings.fx = util.clamp(v, 0, 1); if (settings.fx > 0) settings.muted = false; applyVolumes(); save(); },
    setMusic: function (v) {
      settings.music = util.clamp(v, 0, 1);
      if (settings.music > 0) settings.muted = false;
      applyVolumes();
      save();
      if (settings.music > 0 && wanted !== 'none') {
        var el = wanted === 'end' ? endEl : musicEl;
        if (el && el.paused) tryPlay(el);
      }
    },
    setMuted: function (b) { settings.muted = !!b; applyVolumes(); save(); if (!settings.muted && wanted !== 'none') music(wanted); },
    toggleMuted: function () { CQ.audio.setMuted(!settings.muted); return settings.muted; }
  };
})();
