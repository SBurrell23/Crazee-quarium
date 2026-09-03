/* Crazee-quarium :: data.js
 * Every tunable in the game: fish, coins, aliens, pets, shop prices and the 21 level ladder.
 */
(function () {
  'use strict';
  var CQ = window.CQ;

  /* ------------------------------------------------------------ coins etc. */
  var drops = {
    bronze:   { value: 5,    s: 11, sink: 62,  linger: 2.6, sound: 'coin', pitch: 0.9 },
    silver:   { value: 15,   s: 13, sink: 58,  linger: 2.8, sound: 'coin', pitch: 1.0 },
    gold:     { value: 30,   s: 15, sink: 54,  linger: 3.0, sound: 'coin', pitch: 1.12 },
    treasure: { value: 250,  s: 17, sink: 50,  linger: 3.6, sound: 'coin_big' },
    star:     { value: 25,   s: 13, sink: 34,  linger: 5.0, sound: 'coin', pitch: 1.25, edible: true },
    beetle:   { value: 150,  s: 9,  sink: -30, linger: 0,   sound: 'coin_big', edible: true, rise: true },
    diamond:  { value: 400,  s: 16, sink: 46,  linger: 4.0, sound: 'gem' },
    pearl:    { value: 1000, s: 15, sink: 42,  linger: 4.4, sound: 'gem' },
    goldbar:  { value: 2500, s: 14, sink: 40,  linger: 4.6, sound: 'coin_big' }
  };

  /* ----------------------------------------------------------------- fish */
  var fish = {
    guppy: {
      key: 'guppy', name: 'Guppy', shape: 'guppy',
      c1: '#ffb03a', c2: '#ff7a4d',
      price: 100, priceStep: 100,
      stages: [
        { size: 36, drop: 'bronze', dropTime: 12.0 },
        { size: 54, drop: 'silver', dropTime: 10.0 },
        { size: 74, drop: 'gold',   dropTime: 8.5 }
      ],
      growth: [3, 7],
      diet: { kind: 'food' },
      fullTime: 34, starveTime: 18,
      speed: 48,
      desc: 'Feeds on flakes. Grows twice and drops steadily better coins.'
    },
    carnivore: {
      key: 'carnivore', name: 'Carnivore', shape: 'carnivore',
      c1: '#e0563f', c2: '#7d2418',
      price: 900, priceStep: 350,
      stages: [{ size: 62, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'fish', species: ['guppy'], maxStage: 1 },
      produce: { on: 'eat', type: 'drop:diamond' },
      fullTime: 50, starveTime: 26,
      speed: 58,
      desc: 'Hunts small and medium guppies. Coughs up a diamond after each meal.'
    },
    starcatcher: {
      key: 'starcatcher', name: 'Starcatcher', shape: 'starcatcher',
      c1: '#7fb2ff', c2: '#2c3855',
      price: 700, priceStep: 200,
      stages: [{ size: 58, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'drop', types: ['star'] },
      produce: { on: 'eat', type: 'drop:diamond' },
      fullTime: 46, starveTime: 26,
      speed: 42, floor: true,
      desc: 'Walks the sea floor catching falling stars, then makes diamonds.'
    },
    cruncher: {
      key: 'cruncher', name: 'Guppycruncher', shape: 'cruncher',
      c1: '#6fae21', c2: '#2f5b0d',
      price: 900, priceStep: 300,
      stages: [{ size: 66, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'fish', species: ['guppy'], maxStage: 1 },
      produce: { on: 'timer', type: 'drop:beetle', interval: 10.5 },
      fullTime: 52, starveTime: 26,
      speed: 56,
      desc: 'Eats guppies and farms beetles that float up the tank.'
    },
    muncher: {
      key: 'muncher', name: 'Beetlemuncher', shape: 'muncher',
      c1: '#f2c14e', c2: '#8a5f10',
      price: 1500, priceStep: 450,
      stages: [{ size: 72, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'drop', types: ['beetle'] },
      produce: { on: 'eat', type: 'drop:pearl' },
      fullTime: 48, starveTime: 26,
      speed: 60,
      desc: 'Snaps up beetles and turns them into pearls.'
    },
    ultravore: {
      key: 'ultravore', name: 'Ultravore', shape: 'ultravore',
      c1: '#3d5a80', c2: '#1b2a41',
      price: 3800, priceStep: 1100,
      stages: [{ size: 96, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'fish', species: ['carnivore'], maxStage: 9 },
      produce: { on: 'eat', type: 'drop:goldbar' },
      fullTime: 72, starveTime: 38,
      speed: 54,
      desc: 'Apex hunter. Swallows carnivores whole and leaves gold bars behind.'
    },
    breeder: {
      key: 'breeder', name: 'Breeder', shape: 'breeder',
      c1: '#c86ad6', c2: '#7a2f92',
      price: 2000, priceStep: 700,
      stages: [{ size: 74, drop: null, dropTime: 0 }],
      growth: [],
      diet: { kind: 'food' },
      produce: { on: 'timer', type: 'fish:guppy', interval: 15 },
      fullTime: 40, starveTime: 22,
      speed: 44,
      desc: 'Well fed, she keeps the tank stocked with fresh guppies.'
    }
  };

  /* --------------------------------------------------------------- aliens */
  var aliens = {
    gnasher: {
      key: 'gnasher', name: 'Gnasher', shape: 'gnasher', ai: 'eater',
      hp: 9, size: 80, speed: 74, c1: '#4a86d8', c2: '#dff1ff',
      maxMeals: 1, loot: { treasure: 2 },
      desc: 'Grabs one fish, then leaves full.'
    },
    maulrog: {
      key: 'maulrog', name: 'Maulrog', shape: 'maulrog', ai: 'brute',
      hp: 26, size: 94, speed: 62, c1: '#f08a2e', c2: '#c0392b',
      loot: { treasure: 3 },
      desc: 'Never full. Keeps eating until it is driven off.'
    },
    thief: {
      key: 'thief', name: 'Snatcher', shape: 'thief', ai: 'thief',
      hp: 11, size: 66, speed: 168, c1: '#42d69a', c2: '#1b6b52',
      loot: { treasure: 2 },
      desc: 'Steals loose coins instead of fish. Fast.'
    },
    bomber: {
      key: 'bomber', name: 'Bombardier', shape: 'bomber', ai: 'bomber',
      hp: 24, size: 88, speed: 38, c1: '#7a8794', c2: '#3d4750',
      loot: { treasure: 3, diamond: 1 }, fireGap: 4.6,
      desc: 'Sits on the floor lobbing missiles. Shoot the missiles down.'
    },
    squid: {
      key: 'squid', name: 'Psychosquid', shape: 'squid', ai: 'squid',
      hp: 42, size: 106, speed: 66, c1: '#8e44ad', c2: '#f39c12',
      loot: { treasure: 4, diamond: 1 },
      desc: 'Eats everything. Heals if you shoot it while it glows blue.'
    },
    golem: {
      key: 'golem', name: 'Cyclogolem', shape: 'golem', ai: 'golem',
      hp: 36, size: 98, speed: 34, c1: '#6d6a7c', c2: '#ffe066',
      loot: { treasure: 4, diamond: 1 }, fireGap: 5.0,
      desc: 'Immune to your laser. Click its energy orbs to send them back.'
    },
    maw: {
      key: 'maw', name: 'The Maw', shape: 'maw', ai: 'boss',
      hp: 620, size: 300, speed: 26, c1: '#5a1030', c2: '#ff5c4d',
      loot: { treasure: 10, diamond: 4, pearl: 2 }, fireGap: 3.4,
      desc: 'It ate the last aquarium. Do not let it eat this one.'
    }
  };

  /* ----------------------------------------------------------------- pets */
  var pets = [
    { key: 'shelly',  name: 'Shelly',  shape: 'snail',    c1: '#f2a65a', c2: '#7ec850', acc: 'none',       size: 54, floor: true,
      ability: { kind: 'collect', radius: 90 }, desc: 'Crawls the floor and pockets coins you missed.' },
    { key: 'nickel',  name: 'Nickel',  shape: 'fish',     c1: '#9ad3ff', c2: '#5f9ee0', acc: 'coinbadge',  size: 48,
      ability: { kind: 'dripCoin', interval: 9, drop: 'bronze' }, desc: 'Drips a bronze coin every 9 seconds.' },
    { key: 'mama',    name: 'Mama',    shape: 'blob',     c1: '#ff8fb1', c2: '#d45b83', acc: 'none',       size: 60,
      ability: { kind: 'spawnGuppy', interval: 24 }, desc: 'Delivers a free baby guppy every 24 seconds.' },
    { key: 'sparky',  name: 'Sparky',  shape: 'eel',      c1: '#ffe066', c2: '#8ff0ff', acc: 'none',       size: 72,
      ability: { kind: 'zap', interval: 3.6, damage: 3 }, desc: 'Arcs lightning into the nearest alien.' },
    { key: 'verdant', name: 'Verdant', shape: 'star',     c1: '#5fd68a', c2: '#2f7a4a', acc: 'none',       size: 52,
      ability: { kind: 'dripCoin', interval: 7, drop: 'gold' }, desc: 'Drops a gold coin every 7 seconds and never eats.' },
    { key: 'nibbles', name: 'Nibbles', shape: 'fish',     c1: '#e05263', c2: '#7d1f2b', acc: 'spikes',     size: 50,
      ability: { kind: 'bite', dps: 4.5 }, desc: 'Charges aliens and chews on them relentlessly.' },
    { key: 'sprinkle', name: 'Sprinkle', shape: 'jelly',  c1: '#b8a1ff', c2: '#6f5bc4', acc: 'none',       size: 62,
      ability: { kind: 'dropFood', interval: 5.5 }, desc: 'Rains free food that does not count against your limit.' },
    { key: 'patch',   name: 'Patch',   shape: 'fish',     c1: '#f4f9ff', c2: '#e04b52', acc: 'cross',      size: 50,
      ability: { kind: 'heal', interval: 5, amount: 0.5 }, desc: 'Tops up the hungriest fish in the tank.' },
    { key: 'vaultbug', name: 'Vaultbug', shape: 'crab',   c1: '#d4a24c', c2: '#8a5f10', acc: 'coinbadge',  size: 58, floor: true,
      ability: { kind: 'interest', interval: 10, rate: 0.03, cap: 400 }, desc: 'Pays 3% interest on your cash every 10 seconds.' },
    { key: 'magneta', name: 'Magneta', shape: 'manta',    c1: '#7fb2ff', c2: '#2f5fa8', acc: 'goggles',    size: 74,
      ability: { kind: 'magnet', radius: 190 }, desc: 'Drags nearby coins in and swallows them for you.' },
    { key: 'bulwark', name: 'Bulwark', shape: 'turtle',   c1: '#5f9e6e', c2: '#c8a24c', acc: 'none',       size: 68,
      ability: { kind: 'shield', interval: 2.4, knock: 260 }, desc: 'Rams aliens away from your fish.' },
    { key: 'wizzy',   name: 'Wizzy',   shape: 'seahorse', c1: '#a86ad6', c2: '#ffe066', acc: 'hat',        size: 62,
      ability: { kind: 'upgradeCoin', interval: 4.5 }, desc: 'Transmutes a loose coin into the next tier up.' },
    { key: 'shrap',   name: 'Shrap',   shape: 'puffer',   c1: '#8d99a4', c2: '#e7eef4', acc: 'spikes',     size: 58,
      ability: { kind: 'spikes', interval: 4.5, count: 3, damage: 2 }, desc: 'Fires a volley of three spikes at aliens.' },
    { key: 'oracle',  name: 'Oracle',  shape: 'jelly',    c1: '#8ff0ff', c2: '#2f8fa8', acc: 'antenna',    size: 60,
      ability: { kind: 'oracle', slow: 0.72, warn: 6 }, desc: 'Warns you early and drags every alien to a crawl.' },
    { key: 'grubby',  name: 'Grubby',  shape: 'crab',     c1: '#9cc954', c2: '#5f8f30', acc: 'none',       size: 56, floor: true,
      ability: { kind: 'dripCoin', interval: 13, drop: 'beetle' }, desc: 'Farms a beetle every 13 seconds.' },
    { key: 'nacre',   name: 'Nacre',   shape: 'oyster',   c1: '#f0d5e8', c2: '#b9a9d6', acc: 'none',       size: 64, floor: true,
      ability: { kind: 'dripCoin', interval: 28, drop: 'pearl' }, desc: 'Grows a pearl every 28 seconds.' },
    { key: 'fang',    name: 'Fang',    shape: 'shark',    c1: '#4a6a8a', c2: '#1b2a41', acc: 'none',       size: 86,
      ability: { kind: 'bite', dps: 9 }, desc: 'A pet shark. Aliens hate it.' },
    { key: 'scrubber', name: 'Scrubber', shape: 'fish',   c1: '#c8b48a', c2: '#8a7a52', acc: 'gear',       size: 54, floor: true,
      ability: { kind: 'scavenge' }, desc: 'Recycles dead fish and wasted food into coins.' },
    { key: 'turbo',   name: 'Turbo',   shape: 'fish',     c1: '#ff8f4d', c2: '#e0402f', acc: 'fin_flame',  size: 54,
      ability: { kind: 'boost', nutrition: 0.6, drops: 0.22 }, desc: 'Every fish eats better and drops coins faster.' },
    { key: 'zenith',  name: 'Zenith',  shape: 'star',     c1: '#ffd257', c2: '#ff8f4d', acc: 'halo',       size: 60,
      ability: { kind: 'wildcard', interval: 17 }, desc: 'Grants a random blessing: cash, a feast, or a smiting.' }
  ];

  /* --------------------------------------------------------- shop upgrades */
  var upgrades = {
    food: {
      name: 'Food Quality', icon: 'food', max: 3,
      prices: [0, 200, 450],
      tiers: [
        { nutrition: 1, sink: 52, label: 'Flakes' },
        { nutrition: 2, sink: 42, label: 'Pellets' },
        { nutrition: 3, sink: 34, label: 'Pills' }
      ]
    },
    maxfood: {
      name: 'Food Amount', icon: 'plus', max: 4,
      prices: [0, 150, 350, 600],
      values: [3, 5, 7, 9]
    },
    laser: {
      name: 'Laser', icon: 'laser', max: 3,
      prices: [0, 600, 1500],
      damage: [1, 2, 3.5]
    }
  };

  /* ---------------------------------------------------------------- tanks */
  var tanks = [
    { name: 'Coral Cove',    theme: 0 },
    { name: 'Starlit Shelf', theme: 1 },
    { name: 'Beetle Trench', theme: 2 },
    { name: 'The Abyss',     theme: 3 },
    { name: 'The Maw',       theme: 4 }
  ];

  /* --------------------------------------------------------------- levels */
  function lvl(o) { return o; }

  var levels = [
    /* ---- Tank 1 : Coral Cove ---- */
    lvl({
      tank: 0, num: 1, name: 'First Splash', startMoney: 320,
      startFish: [{ species: 'guppy', count: 2, stage: 0 }],
      shop: ['food', 'maxfood', 'guppy'], eggPrice: 170,
      aliens: [], fishCap: 20,
      tip: 'Click the water to drop food. Feed guppies until they grow, then click their coins.'
    }),
    lvl({
      tank: 0, num: 2, name: 'Uninvited', startMoney: 300,
      startFish: [{ species: 'guppy', count: 2, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy'], eggPrice: 290,
      aliens: ['gnasher'], alienStart: 52, alienGap: [40, 56], fishCap: 20,
      tip: 'Aliens arrive from the sides. Click one over and over to blast it.'
    }),
    lvl({
      tank: 0, num: 3, name: 'Meat Eater', startMoney: 340,
      startFish: [{ species: 'guppy', count: 3, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'carnivore'], eggPrice: 420,
      aliens: ['gnasher'], alienStart: 46, alienGap: [36, 52], fishCap: 22,
      tip: 'Carnivores eat your small guppies and make diamonds. Keep the guppy supply up.'
    }),
    lvl({
      tank: 0, num: 4, name: 'Two Front', startMoney: 360,
      startFish: [{ species: 'guppy', count: 3, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'carnivore'], eggPrice: 560,
      aliens: ['gnasher', 'maulrog'], alienStart: 44, alienGap: [34, 50], fishCap: 22,
      tip: 'Maulrog never gets full. Upgrade the laser before it shows up.'
    }),
    lvl({
      tank: 0, num: 5, name: 'Cove Keeper', startMoney: 420,
      startFish: [{ species: 'guppy', count: 3, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'carnivore'], eggPrice: 740,
      aliens: ['gnasher', 'maulrog', 'thief'], alienStart: 40, alienGap: [30, 46], alienHp: 1.15, fishCap: 24,
      tip: 'Snatchers go for loose coins. Collect fast or let a pet do it.'
    }),

    /* ---- Tank 2 : Starlit Shelf ---- */
    lvl({
      tank: 1, num: 1, name: 'Falling Stars', startMoney: 500, starGuppies: 0.5,
      startFish: [{ species: 'guppy', count: 3, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'starcatcher'], eggPrice: 800,
      aliens: ['gnasher', 'thief'], alienStart: 46, alienGap: [34, 50], fishCap: 24,
      tip: 'Guppies here drop stars. Starcatchers walk the floor and turn stars into diamonds.'
    }),
    lvl({
      tank: 1, num: 2, name: 'Shelf Life', startMoney: 520, starGuppies: 0.5,
      startFish: [{ species: 'guppy', count: 3, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'starcatcher', 'carnivore'], eggPrice: 920,
      aliens: ['gnasher', 'thief', 'bomber'], alienStart: 44, alienGap: [32, 48], fishCap: 24,
      tip: 'Bombardiers dig in on the floor. Shoot their missiles before they reach a fish.'
    }),
    lvl({
      tank: 1, num: 3, name: 'Crossfire', startMoney: 560, starGuppies: 0.55,
      startFish: [{ species: 'guppy', count: 4, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'starcatcher', 'carnivore'], eggPrice: 1080,
      aliens: ['gnasher', 'maulrog', 'bomber'], alienStart: 42, alienGap: [30, 46], alienHp: 1.1, fishCap: 26,
      tip: 'Two aliens at once is normal now. Pick pets that fight back.'
    }),
    lvl({
      tank: 1, num: 4, name: 'Deep Blue Debt', startMoney: 600, starGuppies: 0.55,
      startFish: [{ species: 'guppy', count: 4, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'starcatcher', 'carnivore'], eggPrice: 1250,
      aliens: ['maulrog', 'bomber', 'thief'], alienStart: 40, alienGap: [28, 44], alienHp: 1.2, fishCap: 26,
      tip: 'Diamonds are worth 400. A pair of fed starcatchers pays for everything.'
    }),
    lvl({
      tank: 1, num: 5, name: 'Shelf Keeper', startMoney: 680, starGuppies: 0.6,
      startFish: [{ species: 'guppy', count: 4, stage: 1 }, { species: 'starcatcher', count: 1, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'starcatcher', 'carnivore'], eggPrice: 1450,
      aliens: ['maulrog', 'bomber', 'thief', 'gnasher'], alienStart: 36, alienGap: [26, 42], alienHp: 1.3, fishCap: 28,
      tip: 'Upgrade food early: better food means fewer clicks per fish.'
    }),

    /* ---- Tank 3 : Beetle Trench ---- */
    lvl({
      tank: 2, num: 1, name: 'Beetle Farm', startMoney: 1200,
      startFish: [{ species: 'guppy', count: 4, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'cruncher', 'muncher'], eggPrice: 1400,
      aliens: ['gnasher', 'maulrog'], alienStart: 44, alienGap: [32, 48], alienHp: 1.2, fishCap: 28,
      tip: 'Crunchers eat guppies and grow beetles. Beetlemunchers turn beetles into pearls.'
    }),
    lvl({
      tank: 2, num: 2, name: 'Trench Warfare', startMoney: 1300,
      startFish: [{ species: 'guppy', count: 5, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'cruncher', 'muncher'], eggPrice: 1550,
      aliens: ['maulrog', 'bomber', 'squid'], alienStart: 42, alienGap: [30, 46], alienHp: 1.3, fishCap: 30,
      tip: 'The Psychosquid heals when it turns blue. Stop shooting until it turns purple again.'
    }),
    lvl({
      tank: 2, num: 3, name: 'Pearl Rush', startMoney: 1400,
      startFish: [{ species: 'guppy', count: 5, stage: 1 }, { species: 'cruncher', count: 1, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'cruncher', 'muncher'], eggPrice: 1700,
      aliens: ['squid', 'bomber', 'thief'], alienStart: 40, alienGap: [28, 44], alienHp: 1.4, fishCap: 30,
      tip: 'Beetles float upward and vanish at the surface. Click them or keep munchers nearby.'
    }),
    lvl({
      tank: 2, num: 4, name: 'Sunless', startMoney: 1500,
      startFish: [{ species: 'guppy', count: 6, stage: 1 }, { species: 'cruncher', count: 1, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'cruncher', 'muncher'], eggPrice: 1900,
      aliens: ['squid', 'maulrog', 'bomber'], alienStart: 38, alienGap: [26, 42], alienHp: 1.5, fishCap: 32,
      tip: 'Three aliens can share the tank down here. Defense pets earn their keep.'
    }),
    lvl({
      tank: 2, num: 5, name: 'Trench Keeper', startMoney: 1700,
      startFish: [{ species: 'guppy', count: 6, stage: 1 }, { species: 'cruncher', count: 1, stage: 0 }, { species: 'muncher', count: 1, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'cruncher', 'muncher'], eggPrice: 2150,
      aliens: ['squid', 'maulrog', 'bomber', 'thief'], alienStart: 36, alienGap: [24, 40], alienHp: 1.6, fishCap: 32,
      tip: 'Keep the chain fed from the bottom up: guppies, then crunchers, then munchers.'
    }),

    /* ---- Tank 4 : The Abyss ---- */
    lvl({
      tank: 3, num: 1, name: 'Abyssal Nursery', startMoney: 2100,
      startFish: [{ species: 'breeder', count: 1, stage: 0 }, { species: 'guppy', count: 3, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore'], eggPrice: 1750,
      aliens: ['maulrog', 'squid'], alienStart: 44, alienGap: [30, 46], alienHp: 1.4, fishCap: 34,
      tip: 'Feed the Breeder and she stocks the tank for you. Carnivores do the rest.'
    }),
    lvl({
      tank: 3, num: 2, name: 'Eye of the Deep', startMoney: 2300,
      startFish: [{ species: 'breeder', count: 1, stage: 0 }, { species: 'guppy', count: 4, stage: 1 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore', 'ultravore'], eggPrice: 2150,
      aliens: ['golem', 'maulrog', 'squid'], alienStart: 42, alienGap: [28, 44], alienHp: 1.5, fishCap: 34,
      tip: 'The Cyclogolem ignores your laser. Click its orbs to fling them back at it.'
    }),
    lvl({
      tank: 3, num: 3, name: 'Gold Bars', startMoney: 2500,
      startFish: [{ species: 'breeder', count: 1, stage: 0 }, { species: 'guppy', count: 4, stage: 1 }, { species: 'carnivore', count: 1, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore', 'ultravore'], eggPrice: 2350,
      aliens: ['golem', 'squid', 'bomber'], alienStart: 40, alienGap: [26, 42], alienHp: 1.6, fishCap: 36,
      tip: 'Ultravores eat carnivores and drop gold bars worth 2,500 each.'
    }),
    lvl({
      tank: 3, num: 4, name: 'Pressure', startMoney: 2700,
      startFish: [{ species: 'breeder', count: 1, stage: 0 }, { species: 'guppy', count: 5, stage: 1 }, { species: 'carnivore', count: 2, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore', 'ultravore'], eggPrice: 2550,
      aliens: ['golem', 'squid', 'maulrog', 'bomber'], alienStart: 38, alienGap: [24, 40], alienHp: 1.75, fishCap: 36,
      tip: 'Everything down here hits harder. Spend on the laser, then on the food chain.'
    }),
    lvl({
      tank: 3, num: 5, name: 'Abyss Keeper', startMoney: 3100,
      startFish: [{ species: 'breeder', count: 1, stage: 0 }, { species: 'guppy', count: 6, stage: 1 }, { species: 'carnivore', count: 2, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore', 'ultravore'], eggPrice: 2800,
      aliens: ['golem', 'squid', 'maulrog', 'bomber', 'thief'], alienStart: 34, alienGap: [22, 38], alienHp: 1.9, fishCap: 38,
      tip: 'Last egg before the deep water. Bring your three best pets.'
    }),

    /* ---- Tank 5 : The Maw ---- */
    lvl({
      tank: 4, num: 1, name: 'The Maw', startMoney: 4000, boss: 'maw',
      startFish: [{ species: 'breeder', count: 2, stage: 0 }, { species: 'guppy', count: 8, stage: 2 }, { species: 'carnivore', count: 2, stage: 0 }],
      shop: ['food', 'maxfood', 'laser', 'guppy', 'breeder', 'carnivore', 'ultravore'],
      eggPrice: 0, aliens: ['gnasher', 'thief'], alienStart: 30, alienGap: [26, 40], alienHp: 1.6,
      bossStart: 42, fishCap: 40,
      tip: 'No egg here. Keep your tank alive and put The Maw down for good.'
    })
  ];

  /* Level 21 is the finale; the other twenty each hatch one pet. */
  for (var i = 0; i < levels.length; i++) {
    levels[i].index = i;
    levels[i].petIndex = i < pets.length ? i : -1;
    levels[i].label = (levels[i].tank + 1) + '-' + levels[i].num;
    if (levels[i].boss) levels[i].petIndex = -1;
  }

  CQ.data = {
    drops: drops,
    fish: fish,
    aliens: aliens,
    pets: pets,
    upgrades: upgrades,
    tanks: tanks,
    levels: levels,
    maxPets: 3,
    petByKey: function (key) {
      for (var i = 0; i < pets.length; i++) if (pets[i].key === key) return pets[i];
      return null;
    },
    petIndexByKey: function (key) {
      for (var i = 0; i < pets.length; i++) if (pets[i].key === key) return i;
      return -1;
    }
  };
})();
