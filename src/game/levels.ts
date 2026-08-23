import type { Checkpoint, Coin, LevelDef, Mover, Platform, Spike } from "./types";

const T = 32;

function solid(tx: number, ty: number, tw: number, th = 6): Platform {
  return { x: tx * T, y: ty * T, w: tw * T, h: th * T };
}

function shelf(tx: number, ty: number, tw: number, oneWay = true): Platform {
  return { x: tx * T, y: ty * T, w: tw * T, h: 24, oneWay };
}

function mover(
  tx: number,
  ty: number,
  tw: number,
  opts: { minX?: number; maxX?: number; minY?: number; maxY?: number; vx?: number; vy?: number },
): Mover {
  const x = tx * T;
  const y = ty * T;
  const w = tw * T;
  return {
    x,
    y,
    w,
    h: 22,
    minX: (opts.minX ?? tx) * T,
    maxX: (opts.maxX ?? tx) * T,
    minY: (opts.minY ?? ty) * T,
    maxY: (opts.maxY ?? ty) * T,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
  };
}

function coins(list: Array<[number, number]>): Coin[] {
  return list.map(([tx, ty], i) => ({ id: i, x: tx * T + 6, y: ty * T - 6, w: 20, h: 20 }));
}

function spikes(list: Array<[number, number, number]>): Spike[] {
  return list.map(([tx, ty, tw]) => ({ x: tx * T + 4, y: ty * T + 10, w: tw * T - 8, h: 22 }));
}

function checks(list: Array<[number, number]>): Checkpoint[] {
  return list.map(([tx, ty], i) => ({ id: i, x: tx * T, y: ty * T - 56, w: 28, h: 56 }));
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Strandkanten",
    blurb: "Lær å løpe, hoppe og samle mynter.",
    width: 108 * T,
    height: 24 * T,
    spawn: { x: 3.4 * T, y: 16 * T },
    platforms: [
      solid(0, 16, 16),
      solid(18, 16, 18),
      shelf(22, 12, 4),
      shelf(28, 9, 4),
      solid(40, 16, 14),
      shelf(44, 12, 5),
      solid(58, 14, 10, 8),
      shelf(70, 11, 4),
      shelf(76, 8, 4),
      solid(84, 16, 24),
      shelf(90, 12, 4),
      shelf(96, 8, 5),
      solid(100, 8, 8, 12),
    ],
    movers: [mover(36, 13, 4, { minX: 34, maxX: 39, vx: 70 })],
    coins: coins([
      [6, 15],
      [10, 15],
      [14, 15],
      [23, 11],
      [29, 8],
      [31, 8],
      [37, 12],
      [45, 11],
      [47, 11],
      [62, 13],
      [71, 10],
      [77, 7],
      [91, 11],
      [97, 7],
      [102, 7],
    ]),
    spikes: spikes([
      [16, 21, 2],
      [54, 21, 4],
    ]),
    checkpoints: checks([[46, 16]]),
    flag: { x: 104.2 * T, y: 8 * T - 96, w: 36, h: 96 },
  },
  {
    id: 2,
    name: "Fjellhylla",
    blurb: "Bruk dobbelthopp og rid bevegelige hyller.",
    width: 120 * T,
    height: 28 * T,
    spawn: { x: 3.2 * T, y: 20 * T },
    platforms: [
      solid(0, 20, 12, 8),
      shelf(14, 17, 3),
      shelf(20, 14, 3),
      shelf(26, 11, 4),
      solid(34, 16, 10, 12),
      shelf(46, 12, 4),
      solid(56, 18, 8, 10),
      shelf(66, 14, 3),
      shelf(72, 10, 3),
      solid(80, 16, 8, 12),
      shelf(90, 12, 4),
      solid(102, 10, 18, 18),
    ],
    movers: [
      mover(31, 12, 3.5, { minX: 30, maxX: 33.5, vx: 80 }),
      mover(52, 14, 3.2, { minY: 10, maxY: 16, vy: -70 }),
      mover(96, 14, 3.5, { minX: 94, maxX: 100, vx: 90 }),
    ],
    coins: coins([
      [5, 19],
      [8, 19],
      [15, 16],
      [21, 13],
      [27, 10],
      [36, 15],
      [39, 15],
      [47, 11],
      [53, 9],
      [58, 17],
      [67, 13],
      [73, 9],
      [82, 15],
      [91, 11],
      [97, 13],
      [106, 9],
      [110, 9],
      [114, 9],
    ]),
    spikes: spikes([
      [12, 25, 2],
      [44, 25, 12],
      [64, 25, 16],
      [88, 25, 14],
    ]),
    checkpoints: checks([
      [38, 16],
      [82, 16],
    ]),
    flag: { x: 116.4 * T, y: 10 * T - 96, w: 36, h: 96 },
  },
  {
    id: 3,
    name: "Toppflagget",
    blurb: "Trange hopp, pigger og det siste flagget.",
    width: 136 * T,
    height: 30 * T,
    spawn: { x: 3.2 * T, y: 22 * T },
    platforms: [
      solid(0, 22, 10, 8),
      shelf(12, 19, 3),
      shelf(18, 16, 3),
      shelf(24, 13, 3),
      solid(32, 18, 6, 12),
      shelf(40, 14, 3),
      shelf(48, 11, 3),
      solid(56, 16, 7, 14),
      shelf(66, 12, 3),
      solid(78, 20, 8, 10),
      shelf(88, 16, 3),
      shelf(94, 12, 3),
      solid(108, 14, 8, 16),
      shelf(118, 10, 4),
      solid(126, 10, 10, 20),
    ],
    movers: [
      mover(29, 14, 2.8, { minY: 11, maxY: 17, vy: -80 }),
      mover(45, 12, 2.8, { minX: 43, maxX: 48, vx: 75 }),
      mover(72, 14, 3.2, { minX: 70, maxX: 76, vx: 95 }),
      mover(102, 12, 3, { minY: 9, maxY: 16, vy: -85 }),
    ],
    coins: coins([
      [5, 21],
      [13, 18],
      [19, 15],
      [25, 12],
      [33, 17],
      [41, 13],
      [49, 10],
      [58, 15],
      [67, 11],
      [73, 13],
      [80, 19],
      [89, 15],
      [95, 11],
      [103, 10],
      [110, 13],
      [119, 9],
      [122, 9],
      [128, 9],
      [131, 9],
      [134, 9],
    ]),
    spikes: spikes([
      [10, 27, 22],
      [38, 27, 18],
      [63, 27, 15],
      [86, 27, 22],
      [116, 27, 10],
    ]),
    checkpoints: checks([
      [34, 18],
      [80, 20],
      [110, 14],
    ]),
    flag: { x: 132.6 * T, y: 10 * T - 96, w: 36, h: 96 },
  },
];

export function levelById(id: number) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0]!;
}
