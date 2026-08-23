export type Phase = "title" | "select" | "playing" | "paused" | "dead" | "win";

export type Rect = { x: number; y: number; w: number; h: number };

export type Platform = Rect & {
  oneWay?: boolean;
};

export type Mover = Rect & {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  vx: number;
  vy: number;
};

export type Coin = Rect & { id: number };
export type Spike = Rect;
export type Checkpoint = Rect & { id: number };

export type LevelDef = {
  id: number;
  name: string;
  blurb: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: Platform[];
  movers: Mover[];
  coins: Coin[];
  spikes: Spike[];
  checkpoints: Checkpoint[];
  flag: Rect;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
};

export type ControlsProbe = {
  getX: () => number;
  getY: () => number;
  getVx: () => number;
  getFacing: () => number;
  getGrounded: () => boolean;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
