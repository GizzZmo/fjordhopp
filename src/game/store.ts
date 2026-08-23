import { create } from "zustand";
import type { Phase } from "./types";

const SAVE_KEY = "fjordhopp-v1";

export type SaveData = {
  v: 1;
  unlocked: number;
  best: Record<number, number>;
  mute: boolean;
};

function loadSave(): SaveData {
  const fallback: SaveData = { v: 1, unlocked: 1, best: {}, mute: false };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.v !== 1) return fallback;
    return { ...fallback, ...parsed, v: 1 };
  } catch {
    return fallback;
  }
}

function persist(partial: Partial<SaveData>) {
  if (typeof localStorage === "undefined") return;
  const next = { ...loadSave(), ...partial };
  localStorage.setItem(SAVE_KEY, JSON.stringify(next));
}

export type Hud = {
  phase: Phase;
  levelId: number;
  levelName: string;
  coins: number;
  totalCoins: number;
  deaths: number;
  checkpointOn: boolean;
  unlocked: number;
  best: Record<number, number>;
  mute: boolean;
  ready: boolean;
};

type GameStore = Hud & {
  setHud: (patch: Partial<Hud>) => void;
  completeLevel: (levelId: number, coins: number) => void;
  setMute: (mute: boolean) => void;
};

const initial = loadSave();

export const useGameStore = create<GameStore>((set) => ({
  phase: "title",
  levelId: 1,
  levelName: "Strandkanten",
  coins: 0,
  totalCoins: 0,
  deaths: 0,
  checkpointOn: false,
  unlocked: initial.unlocked,
  best: initial.best,
  mute: initial.mute,
  ready: false,
  setHud: (patch) => set(patch),
  completeLevel: (levelId, coins) =>
    set((s) => {
      const unlocked = Math.max(s.unlocked, Math.min(3, levelId + 1));
      const best = { ...s.best, [levelId]: Math.max(s.best[levelId] ?? 0, coins) };
      persist({ unlocked, best });
      return { unlocked, best };
    }),
  setMute: (mute) => {
    persist({ mute });
    set({ mute });
  },
}));
