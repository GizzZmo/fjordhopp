import { unlockAudio, resumeAudio, sfxPlay, setMuted } from "./audio";
import { bindInput, sampleActions, setForcedKeys, clearForcedKeys } from "./input";
import { LEVELS, levelById } from "./levels";
import { useGameStore } from "./store";
import type { Floater, LevelDef, Mover, Particle, Platform, Rect } from "./types";

const STEP = 1 / 60;
const PW = 22;
const PH = 38;
const GRAVITY_UP = 1650;
const GRAVITY_APEX = 780;
const GRAVITY_DOWN = 2750;
const JUMP = -545;
const AIR_JUMP = -500;
const MAX_FALL = 980;
const RUN = 290;
const ACCEL_G = 3200;
const ACCEL_A = 1700;
const FRICTION = 2600;
const AIR_DRAG = 380;
const COYOTE = 0.1;
const BUFFER = 0.13;

const ASSET_LIST = {
  sky: "/game/sky.jpg",
  far: "/game/far.jpg",
  mid: "/game/mid.jpg",
  near: "/game/near.jpg",
  playerIdle: "/game/player-idle.png",
  playerRun: "/game/player-run.png",
  playerJump: "/game/player-jump.png",
  coin: "/game/coin.png",
  checkpoint: "/game/checkpoint.png",
  flag: "/game/flag.png",
  spike: "/game/spike.png",
  mover: "/game/mover.png",
  platLeft: "/game/plat-left.png",
  platMid: "/game/plat-mid.png",
  platRight: "/game/plat-right.png",
} as const;

type ImgKey = keyof typeof ASSET_LIST;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(src));
    im.src = src;
  });
}

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

type LiveMover = Mover & { ox: number; oy: number; sx: number; sy: number };

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  private unbind: (() => void) | null = null;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private images = {} as Record<ImgKey, HTMLImageElement>;
  private level!: LevelDef;
  private movers: LiveMover[] = [];
  private collected = new Set<number>();
  private activeCheck = -1;
  private spawn = { x: 0, y: 0 };
  private player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    buffer: 0,
    airJumps: 1,
    jumpCut: false,
    dropT: 0,
    ride: -1,
    anim: 0,
    jumpAge: 0,
    squash: 1,
    invuln: 0,
  };
  private cam = { x: 0, y: 0, look: 0 };
  private view = { w: 960, h: 540 };
  private css = { w: 960, h: 540 };
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private trauma = 0;
  private freeze = 0;
  private deathT = 0;
  private winT = 0;
  private time = 0;
  private reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.level = LEVELS[0]!;
  }

  async start() {
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const entries = await Promise.all(
      Object.entries(ASSET_LIST).map(async ([k, src]) => {
        try {
          const im = await loadImage(src);
          return [k, im] as const;
        } catch {
          return [k, null] as const;
        }
      }),
    );
    for (const [k, im] of entries) {
      if (im) this.images[k as ImgKey] = im;
    }
    this.unbind = bindInput(window);
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
    this.running = true;
    this.last = performance.now();
    this.level = LEVELS[0]!;
    this.movers = this.level.movers.map((m) => ({
      ...m,
      ox: m.x,
      oy: m.y,
      sx: Math.sign(m.vx) || 1,
      sy: Math.sign(m.vy) || 1,
    }));
    this.placePlayer(this.level.spawn.x, this.level.spawn.y);
    this.cam.x = clamp(this.player.x - this.view.w * 0.35, 0, Math.max(0, this.level.width - this.view.w));
    this.cam.y = clamp(this.player.y - this.view.h * 0.55, 0, Math.max(0, this.level.height - this.view.h));
    useGameStore.getState().setHud({ ready: true, mute: useGameStore.getState().mute });
    setMuted(useGameStore.getState().mute);
    this.installProbe();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
    if (window.__controlsTest) delete window.__controlsTest;
  }

  private onVis = () => {
    if (!document.hidden) resumeAudio();
  };

  resize = () => {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? window.innerWidth;
    const h = parent?.clientHeight ?? window.innerHeight;
    this.css.w = w;
    this.css.h = h;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const aspect = w / Math.max(1, h);
    let viewH = 540;
    let viewW = viewH * aspect;
    if (viewW < 780) {
      viewW = 780;
      viewH = viewW / aspect;
    }
    this.view.w = viewW;
    this.view.h = viewH;
  };

  playLevel(id: number) {
    unlockAudio();
    this.level = levelById(id);
    this.collected.clear();
    this.activeCheck = -1;
    this.spawn = { ...this.level.spawn };
    this.movers = this.level.movers.map((m) => ({
      ...m,
      ox: m.x,
      oy: m.y,
      sx: Math.sign(m.vx) || 1,
      sy: Math.sign(m.vy) || 1,
    }));
    this.particles.length = 0;
    this.floaters.length = 0;
    this.trauma = 0;
    this.deathT = 0;
    this.winT = 0;
    this.time = 0;
    this.placePlayer(this.spawn.x, this.spawn.y);
    this.cam.x = clamp(this.player.x - this.view.w * 0.35, 0, Math.max(0, this.level.width - this.view.w));
    this.cam.y = clamp(this.player.y - this.view.h * 0.55, 0, Math.max(0, this.level.height - this.view.h));
    useGameStore.getState().setHud({
      phase: "playing",
      levelId: this.level.id,
      levelName: this.level.name,
      coins: 0,
      totalCoins: this.level.coins.length,
      deaths: 0,
      checkpointOn: false,
    });
  }

  pause() {
    if (useGameStore.getState().phase === "playing") {
      useGameStore.getState().setHud({ phase: "paused" });
    }
  }

  resume() {
    if (useGameStore.getState().phase === "paused") {
      useGameStore.getState().setHud({ phase: "playing" });
    }
  }

  toTitle() {
    useGameStore.getState().setHud({ phase: "title" });
  }

  toSelect() {
    useGameStore.getState().setHud({ phase: "select" });
  }

  retryLevel() {
    this.playLevel(this.level.id);
  }

  respawnFromCheckpoint() {
    this.placePlayer(this.spawn.x, this.spawn.y);
    this.player.invuln = 0.8;
    this.deathT = 0;
    useGameStore.getState().setHud({ phase: "playing" });
  }

  toggleMute() {
    const next = !useGameStore.getState().mute;
    useGameStore.getState().setMute(next);
    setMuted(next);
  }

  private placePlayer(feetX: number, feetY: number) {
    this.player.x = feetX - PW / 2;
    this.player.y = feetY - PH;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.grounded = true;
    this.player.coyote = COYOTE;
    this.player.buffer = 0;
    this.player.airJumps = 1;
    this.player.jumpCut = false;
    this.player.dropT = 0;
    this.player.ride = -1;
    this.player.squash = 1;
    this.player.facing = 1;
  }

  private installProbe() {
    window.__controlsTest = {
      getX: () => this.player.x,
      getY: () => this.player.y,
      getVx: () => this.player.vx,
      getFacing: () => this.player.facing,
      getGrounded: () => this.player.grounded,
      setKeys: (codes) => setForcedKeys(codes),
    };
  }

  private loop = (now: number) => {
    if (!this.running) return;
    const raw = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const phase = useGameStore.getState().phase;
    this.acc += raw;
    if (phase === "playing") {
      while (this.acc >= STEP) {
        this.sim(STEP);
        this.acc -= STEP;
      }
    } else {
      this.acc = 0;
      this.time += raw;
      this.player.anim += raw;
      const actions = sampleActions();
      if (phase === "paused" && actions.pause) this.resume();
      if (phase === "dead" && actions.retry) this.respawnFromCheckpoint();
      if (phase === "win" && actions.retry) this.retryLevel();
    }
    this.draw(phase);
    this.raf = requestAnimationFrame(this.loop);
  };

  private sim(dt: number) {
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    this.time += dt;
    const actions = sampleActions();
    if (actions.pause) {
      this.pause();
      return;
    }
    if (actions.retry) {
      this.retryLevel();
      return;
    }

    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dropT = Math.max(0, p.dropT - dt);
    p.anim += dt;
    p.jumpAge += dt;
    p.squash += (1 - p.squash) * (1 - Math.exp(-14 * dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    this.stepMovers(dt);

    if (p.ride >= 0) {
      const m = this.movers[p.ride];
      if (m) {
        p.x += m.x - m.ox;
        p.y += m.y - m.oy;
      }
    }

    if (actions.moveX < -0.1) p.facing = -1;
    else if (actions.moveX > 0.1) p.facing = 1;

    const accel = p.grounded ? ACCEL_G : ACCEL_A;
    const target = actions.moveX * RUN;
    if (Math.abs(target) > 10) {
      if (p.vx < target) p.vx = Math.min(target, p.vx + accel * dt);
      else p.vx = Math.max(target, p.vx - accel * dt);
    } else if (p.grounded) {
      const fr = FRICTION * dt;
      if (Math.abs(p.vx) <= fr) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * fr;
    } else {
      p.vx -= p.vx * Math.min(1, AIR_DRAG * dt);
    }

    if (actions.down && (actions.jump || actions.jumpHeld) && p.grounded) {
      p.dropT = 0.2;
      p.grounded = false;
      p.coyote = 0;
    }

    if (actions.jump) p.buffer = BUFFER;
    else p.buffer = Math.max(0, p.buffer - dt);

    if (p.grounded) {
      p.coyote = COYOTE;
      p.airJumps = 1;
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
    }

    const canGround = p.buffer > 0 && (p.grounded || p.coyote > 0);
    const canAir = p.buffer > 0 && !p.grounded && p.coyote <= 0 && p.airJumps > 0;
    if (canGround) {
      p.vy = JUMP;
      p.grounded = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpCut = false;
      p.jumpAge = 0;
      p.squash = 1.16;
      p.ride = -1;
      sfxPlay.jump();
      this.burst(p.x + PW / 2, p.y + PH, 6, "#c4b8a8");
    } else if (canAir) {
      p.vy = AIR_JUMP;
      p.airJumps = 0;
      p.buffer = 0;
      p.jumpCut = false;
      p.jumpAge = 0;
      p.squash = 1.12;
      sfxPlay.double();
      this.burst(p.x + PW / 2, p.y + PH * 0.6, 5, "#a8b8ae");
    }

    if (!actions.jumpHeld && p.vy < 0 && !p.jumpCut) {
      p.vy *= 0.48;
      p.jumpCut = true;
    }

    let g = GRAVITY_DOWN;
    if (p.vy < 0) g = Math.abs(p.vy) < 58 ? GRAVITY_APEX : GRAVITY_UP;
    p.vy = Math.min(MAX_FALL, p.vy + g * dt);

    const prevBottom = p.y + PH;
    const maxStep = 10;
    const dist = Math.hypot(p.vx, p.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx * sdt;
      this.resolveX();
      p.y += p.vy * sdt;
      this.resolveY(i === 0 ? prevBottom : p.y + PH - p.vy * sdt);
    }

    p.x = clamp(p.x, 0, this.level.width - PW);

    this.pickups();
    this.hazards();
    this.camera(dt);

    if (p.y > this.level.height - 8) this.die();

    const hud = useGameStore.getState();
    if (hud.coins !== this.collected.size || hud.checkpointOn !== this.activeCheck >= 0) {
      useGameStore.getState().setHud({
        coins: this.collected.size,
        checkpointOn: this.activeCheck >= 0,
      });
    }
  }

  private stepMovers(dt: number) {
    for (const m of this.movers) {
      m.ox = m.x;
      m.oy = m.y;
      if (m.vx) {
        m.x += m.vx * m.sx * dt;
        if (m.x < m.minX) {
          m.x = m.minX;
          m.sx = 1;
        }
        if (m.x > m.maxX) {
          m.x = m.maxX;
          m.sx = -1;
        }
      }
      if (m.vy) {
        m.y += m.vy * m.sy * dt;
        if (m.y < m.minY) {
          m.y = m.minY;
          m.sy = 1;
        }
        if (m.y > m.maxY) {
          m.y = m.maxY;
          m.sy = -1;
        }
      }
    }
  }

  private solids(): Array<Platform & { ride?: number; oneWay?: boolean }> {
    const list: Array<Platform & { ride?: number; oneWay?: boolean }> = this.level.platforms.map((p) => ({ ...p }));
    this.movers.forEach((m, i) => list.push({ x: m.x, y: m.y, w: m.w, h: m.h, oneWay: true, ride: i }));
    return list;
  }

  private resolveX() {
    const p = this.player;
    const box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of this.solids()) {
      if (s.oneWay) continue;
      if (!overlap(box, s)) continue;
      if (p.vx > 0) p.x = s.x - PW;
      else if (p.vx < 0) p.x = s.x + s.w;
      else {
        const dl = p.x + PW - s.x;
        const dr = s.x + s.w - p.x;
        p.x = dl < dr ? s.x - PW : s.x + s.w;
      }
      p.vx = 0;
      box.x = p.x;
    }
  }

  private resolveY(prevBottom: number) {
    const p = this.player;
    let grounded = false;
    let ride = -1;
    const box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const s of this.solids()) {
      if (s.oneWay) {
        if (p.dropT > 0) continue;
        if (p.vy < 0) continue;
        if (prevBottom > s.y + 8) continue;
        if (!overlap(box, s)) continue;
        if (p.y + PH - s.y > 18) continue;
        p.y = s.y - PH;
        p.vy = 0;
        grounded = true;
        if (s.ride !== undefined) ride = s.ride;
        box.y = p.y;
        continue;
      }
      if (!overlap(box, s)) continue;
      if (p.vy >= 0) {
        p.y = s.y - PH;
        if (!p.grounded) {
          p.squash = 0.82;
          sfxPlay.land();
          this.burst(p.x + PW / 2, p.y + PH, 8, "#8a948c");
        }
        p.vy = 0;
        grounded = true;
      } else {
        p.y = s.y + s.h;
        p.vy = 0;
      }
      box.y = p.y;
    }
    p.grounded = grounded;
    p.ride = ride;
  }

  private pickups() {
    const p = this.player;
    const box = { x: p.x, y: p.y, w: PW, h: PH };
    for (const c of this.level.coins) {
      if (this.collected.has(c.id)) continue;
      if (!overlap(box, c)) continue;
      this.collected.add(c.id);
      sfxPlay.coin();
      this.burst(c.x + 10, c.y + 10, 10, "#d7ddd6");
      this.floaters.push({ x: c.x, y: c.y, text: "+1", life: 0.7 });
    }
    for (const cp of this.level.checkpoints) {
      if (!overlap(box, cp)) continue;
      if (this.activeCheck === cp.id) continue;
      this.activeCheck = cp.id;
      this.spawn = { x: cp.x + cp.w / 2, y: cp.y + cp.h };
      sfxPlay.checkpoint();
      this.burst(cp.x + 14, cp.y + 20, 12, "#b8c4bc");
    }
    if (overlap(box, this.level.flag)) {
      this.win();
    }
  }

  private hazards() {
    if (this.player.invuln > 0) return;
    const box = { x: this.player.x + 3, y: this.player.y + 8, w: PW - 6, h: PH - 8 };
    for (const s of this.level.spikes) {
      if (overlap(box, s)) {
        this.die();
        return;
      }
    }
  }

  private die() {
    if (useGameStore.getState().phase !== "playing") return;
    sfxPlay.death();
    this.trauma = this.reduced ? 0.15 : 0.7;
    this.freeze = 0.08;
    this.deathT = 0.9;
    this.burst(this.player.x + PW / 2, this.player.y + PH / 2, 18, "#c45c4a");
    const deaths = useGameStore.getState().deaths + 1;
    useGameStore.getState().setHud({ phase: "dead", deaths });
  }

  private win() {
    if (useGameStore.getState().phase !== "playing") return;
    sfxPlay.win();
    this.winT = 1;
    this.trauma = 0.2;
    for (let i = 0; i < 28; i++) this.burst(this.level.flag.x, this.level.flag.y + 20, 1, i % 2 ? "#e8ece8" : "#a8b8ae");
    useGameStore.getState().completeLevel(this.level.id, this.collected.size);
    useGameStore.getState().setHud({ phase: "win", coins: this.collected.size });
  }

  private camera(dt: number) {
    const p = this.player;
    this.cam.look += (p.facing * 90 - this.cam.look) * (1 - Math.exp(-3 * dt));
    const targetX = p.x + PW / 2 - this.view.w * 0.42 + this.cam.look;
    const targetY = p.y + PH / 2 - this.view.h * 0.58;
    const k = 1 - Math.exp(-5.2 * dt);
    this.cam.x += (targetX - this.cam.x) * k;
    this.cam.y += (targetY - this.cam.y) * k;
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.level.width - this.view.w));
    this.cam.y = clamp(this.cam.y, 0, Math.max(0, this.level.height - this.view.h));
  }

  private burst(x: number, y: number, n: number, color: string) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        size: 2 + Math.random() * 3,
        color,
      });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  private draw(phase: string) {
    const ctx = this.ctx;
    const { w, h } = this.css;
    ctx.fillStyle = "#0c1014";
    ctx.fillRect(0, 0, w, h);

    const sx = w / this.view.w;
    const sy = h / this.view.h;
    ctx.save();
    ctx.scale(sx, sy);

    const shake = this.reduced ? 0 : this.trauma * this.trauma;
    const ox = (Math.random() * 2 - 1) * shake * 10;
    const oy = (Math.random() * 2 - 1) * shake * 8;
    ctx.translate(ox, oy);

    this.drawParallax();

    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
    this.drawWater();
    this.drawWorld();
    this.drawActor();
    this.drawFx();
    ctx.restore();

    this.drawNear();
    ctx.restore();

    this.stepFx(STEP);
    void phase;
  }

  private drawParallax() {
    const ctx = this.ctx;
    const vw = this.view.w;
    const vh = this.view.h;
    const sky = this.images.sky;
    const far = this.images.far;
    const mid = this.images.mid;
    if (sky) ctx.drawImage(sky, 0, 0, vw, vh);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, "#121826");
      g.addColorStop(0.55, "#3d4a62");
      g.addColorStop(1, "#d9a07a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    this.tileLayer(far, -this.cam.x * 0.12, vh * 0.08, vh * 0.92);
    // Mid plate is scenery-with-water; keep it low so it doesn't look like platforms.
    this.tileLayer(mid, -this.cam.x * 0.22, vh * 0.62, vh * 0.5, 0.45);
  }

  private tileLayer(img: HTMLImageElement | undefined, x: number, y: number, h: number, alpha = 1) {
    if (!img) return;
    const ctx = this.ctx;
    const vw = this.view.w;
    const ratio = img.width / img.height;
    const dw = h * ratio;
    ctx.save();
    ctx.globalAlpha = alpha;
    let start = ((x % dw) + dw) % dw - dw;
    for (let px = start; px < vw + dw; px += dw) {
      ctx.drawImage(img, px, y, dw, h);
    }
    ctx.restore();
  }

  private drawNear() {
    this.tileLayer(this.images.near, -this.cam.x * 0.55, this.view.h * 0.35, this.view.h * 0.7, 0.28);
  }

  private drawWater() {
    const ctx = this.ctx;
    const y = this.level.height - 72;
    const g = ctx.createLinearGradient(0, y, 0, this.level.height + 40);
    g.addColorStop(0, "rgba(45, 90, 98, 0.55)");
    g.addColorStop(1, "rgba(12, 22, 28, 0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(this.cam.x - 20, y, this.view.w + 40, 200);
  }

  private drawWorld() {
    for (const plat of this.level.platforms) this.drawPlat(plat, false);
    for (const m of this.movers) this.drawPlat(m, true);
    for (const s of this.level.spikes) this.drawSpike(s);
    for (const c of this.level.coins) {
      if (this.collected.has(c.id)) continue;
      this.drawSheet(this.images.coin, 2, 2, Math.floor(this.time * 8) % 4, c.x - 6, c.y - 8, 32, 32);
    }
    for (const cp of this.level.checkpoints) {
      const on = this.activeCheck === cp.id;
      ctxGlow(this.ctx, on);
      this.drawSheet(this.images.checkpoint, 2, 2, Math.floor(this.time * 5) % 4, cp.x - 10, cp.y - 8, 48, 72);
      this.ctx.shadowBlur = 0;
    }
    this.drawSheet(this.images.flag, 2, 2, Math.floor(this.time * 6) % 4, this.level.flag.x - 8, this.level.flag.y, 56, 100);
  }

  private drawPlat(plat: Rect & { oneWay?: boolean }, moving: boolean) {
    const ctx = this.ctx;
    if (moving && this.images.mover) {
      ctx.drawImage(this.images.mover, plat.x - 2, plat.y - 10, plat.w + 4, 32);
      return;
    }
    const depth = Math.max(plat.h, plat.oneWay ? 22 : 36);
    const body = ctx.createLinearGradient(0, plat.y, 0, plat.y + Math.min(depth, 140));
    body.addColorStop(0, plat.oneWay ? "#6f7d74" : "#5c6862");
    body.addColorStop(0.14, "#3e4844");
    body.addColorStop(1, "#161c20");
    ctx.fillStyle = body;
    ctx.fillRect(plat.x, plat.y, plat.w, depth);
    ctx.fillStyle = "#9aab96";
    ctx.fillRect(plat.x, plat.y, plat.w, 5);
    ctx.fillStyle = "rgba(12,16,20,0.35)";
    ctx.fillRect(plat.x, plat.y + 5, plat.w, 3);
    const img = this.images.platMid;
    if (img) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      const th = plat.oneWay ? 22 : 28;
      const tw = 32;
      for (let x = plat.x; x < plat.x + plat.w; x += tw) {
        const slice = Math.min(tw, plat.x + plat.w - x);
        ctx.drawImage(img, x, plat.y - 5, slice, th);
      }
      ctx.restore();
    }
  }

  private drawSpike(s: Rect) {
    const img = this.images.spike;
    if (img) {
      ctxDraw(this.ctx, img, s.x - 4, s.y - 18, s.w + 8, s.h + 22);
      return;
    }
    this.ctx.fillStyle = "#4a3f42";
    this.ctx.beginPath();
    this.ctx.moveTo(s.x, s.y + s.h);
    this.ctx.lineTo(s.x + s.w / 2, s.y);
    this.ctx.lineTo(s.x + s.w, s.y + s.h);
    this.ctx.fill();
  }

  private drawActor() {
    const p = this.player;
    const flash = p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
    if (flash) return;
    let sheet = this.images.playerIdle;
    let cols = 2;
    let rows = 2;
    let frames = 4;
    let fps = 5;
    let idx = 0;
    if (!p.grounded) {
      sheet = this.images.playerJump;
      if (p.jumpAge < 0.08) idx = 0;
      else if (p.vy < -160) idx = 1;
      else if (p.vy < 70) idx = 2;
      else idx = 3;
      frames = 4;
      fps = 0;
    } else if (Math.abs(p.vx) > 28) {
      sheet = this.images.playerRun;
      cols = 3;
      rows = 2;
      frames = 6;
      fps = 11;
      idx = Math.floor(p.anim * fps) % frames;
    } else {
      idx = Math.floor(p.anim * fps) % frames;
    }
    const drawH = 48 * p.squash;
    const drawW = 36 / p.squash;
    const dx = p.x + PW / 2 - drawW / 2;
    const dy = p.y + PH - drawH;
    const ctx = this.ctx;
    ctx.save();
    if (p.facing < 0) {
      ctx.translate(dx + drawW / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + drawW / 2), 0);
    }
    this.drawSheet(sheet, cols, rows, idx, dx, dy, drawW, drawH);
    ctx.restore();
  }

  private drawSheet(
    img: HTMLImageElement | undefined,
    cols: number,
    rows: number,
    index: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) {
    if (!img) {
      this.ctx.fillStyle = "#c45c3a";
      this.ctx.fillRect(dx, dy, dw, dh);
      return;
    }
    const cw = img.width / cols;
    const ch = img.height / rows;
    const i = ((index % (cols * rows)) + cols * rows) % (cols * rows);
    const c = i % cols;
    const r = Math.floor(i / cols);
    this.ctx.drawImage(img, c * cw, r * ch, cw, ch, dx, dy, dw, dh);
  }

  private drawFx() {
    const ctx = this.ctx;
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = "600 14px Outfit, sans-serif";
    ctx.fillStyle = "#e8ece8";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / 0.7);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private stepFx(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 420 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }
}

function ctxGlow(ctx: CanvasRenderingContext2D, on: boolean) {
  ctx.shadowColor = on ? "rgba(184,196,188,0.85)" : "rgba(0,0,0,0)";
  ctx.shadowBlur = on ? 18 : 0;
}

function ctxDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(img, x, y, w, h);
}

export { clearForcedKeys };
