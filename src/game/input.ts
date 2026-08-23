const GAME_CODES = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyP",
  "Escape",
  "KeyR",
  "KeyZ",
]);

export type Actions = {
  moveX: number;
  jump: boolean;
  jumpHeld: boolean;
  down: boolean;
  pause: boolean;
  retry: boolean;
};

const keys = new Set<string>();
const forced = new Set<string>();
let prevJump = false;
let prevPause = false;
let prevRetry = false;

export const touch = {
  left: false,
  right: false,
  jump: false,
};

function active(code: string) {
  return keys.has(code) || forced.has(code);
}

export function bindInput(target: Window | HTMLElement = window) {
  const down = (e: KeyboardEvent) => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const clear = () => keys.clear();
  target.addEventListener("keydown", down as EventListener);
  target.addEventListener("keyup", up as EventListener);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  return () => {
    target.removeEventListener("keydown", down as EventListener);
    target.removeEventListener("keyup", up as EventListener);
    window.removeEventListener("blur", clear);
  };
}

function padMoveX(): number {
  const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : [];
  if (!pads) return 0;
  for (const pad of pads) {
    if (!pad) continue;
    const lx = pad.axes[0] ?? 0;
    const mag = Math.abs(lx);
    if (mag < 0.18) {
      if (pad.buttons[14]?.pressed) return -1;
      if (pad.buttons[15]?.pressed) return 1;
      continue;
    }
    const scale = (mag - 0.18) / (1 - 0.18);
    return Math.sign(lx) * scale;
  }
  return 0;
}

function padPressed(index: number): boolean {
  const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : [];
  if (!pads) return false;
  for (const pad of pads) {
    if (pad?.buttons[index]?.pressed) return true;
  }
  return false;
}

export function sampleActions(): Actions {
  let moveX = 0;
  if (active("KeyA") || active("ArrowLeft") || touch.left) moveX -= 1;
  if (active("KeyD") || active("ArrowRight") || touch.right) moveX += 1;
  const stick = padMoveX();
  if (Math.abs(stick) > Math.abs(moveX)) moveX = stick;
  moveX = Math.max(-1, Math.min(1, moveX));

  const jumpHeld =
    active("Space") ||
    active("KeyW") ||
    active("ArrowUp") ||
    active("KeyZ") ||
    touch.jump ||
    padPressed(0);
  const jump = jumpHeld && !prevJump;
  prevJump = jumpHeld;

  const pauseHeld = active("Escape") || active("KeyP") || padPressed(9);
  const pause = pauseHeld && !prevPause;
  prevPause = pauseHeld;

  const retryHeld = active("KeyR") || padPressed(1);
  const retry = retryHeld && !prevRetry;
  prevRetry = retryHeld;

  const down =
    active("KeyS") || active("ArrowDown") || padPressed(13);

  return { moveX, jump, jumpHeld, down, pause, retry };
}

export function setForcedKeys(codes: string[]) {
  forced.clear();
  for (const c of codes) forced.add(c);
}

export function clearForcedKeys() {
  forced.clear();
}
