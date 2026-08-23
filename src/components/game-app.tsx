import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Coins,
  Flag,
  Map,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameEngine } from "@/game/engine";
import { LEVELS } from "@/game/levels";
import { touch } from "@/game/input";
import { unlockAudio } from "@/game/audio";
import { useGameStore } from "@/game/store";
import { cn } from "@/lib/utils";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const phase = useGameStore((s) => s.phase);
  const ready = useGameStore((s) => s.ready);
  const coins = useGameStore((s) => s.coins);
  const total = useGameStore((s) => s.totalCoins);
  const levelName = useGameStore((s) => s.levelName);
  const levelId = useGameStore((s) => s.levelId);
  const deaths = useGameStore((s) => s.deaths);
  const unlocked = useGameStore((s) => s.unlocked);
  const best = useGameStore((s) => s.best);
  const mute = useGameStore((s) => s.mute);
  const checkpointOn = useGameStore((s) => s.checkpointOn);
  const [touchUi, setTouchUi] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
    setTouchUi(coarse);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    void engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== "dead") return;
    const t = window.setTimeout(() => engineRef.current?.respawnFromCheckpoint(), 1100);
    return () => window.clearTimeout(t);
  }, [phase, deaths]);

  const startLevel = (id: number) => {
    unlockAudio();
    engineRef.current?.playLevel(id);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ touchAction: "none" }}
      />

      {phase === "playing" && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center gap-2">
            <HudChip>
              <Coins className="size-3.5 text-muted" />
              <span className="tabular-nums">
                {coins}
                <span className="text-muted">/{total}</span>
              </span>
            </HudChip>
            <HudChip>
              <Flag className="size-3.5 text-muted" />
              <span>{levelName}</span>
            </HudChip>
            {checkpointOn && (
              <HudChip>
                <span className="text-muted">Sjekkpunkt</span>
              </HudChip>
            )}
          </div>
          <div className="pointer-events-auto flex gap-2">
            <Button
              variant="subtle"
              size="icon"
              aria-label={mute ? "Lyd på" : "Lyd av"}
              onClick={() => engineRef.current?.toggleMute()}
            >
              {mute ? <VolumeOff /> : <Volume2 />}
            </Button>
            <Button variant="subtle" size="icon" aria-label="Pause" onClick={() => engineRef.current?.pause()}>
              <Pause />
            </Button>
          </div>
        </header>
      )}

      {touchUi && phase === "playing" && <TouchPad />}


      {phase === "title" && (
        <Overlay>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Nordisk klippeløype</p>
          <h1 className="font-display text-5xl font-medium leading-tight tracking-tight sm:text-6xl">Fjordhopp</h1>
          <p className="max-w-sm text-base leading-relaxed text-muted">
            Løp, hopp og dobbelthopp langs mosegrodde hyller. Samle mynter, nå sjekkpunktet og reis flagget på toppen.
          </p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
            <Button size="lg" disabled={!ready} onClick={() => startLevel(1)}>
              <Play /> Start
            </Button>
            <Button variant="outline" size="lg" onClick={() => engineRef.current?.toSelect()}>
              <Map /> Velg nivå
            </Button>
          </div>
          <ControlsHint />
        </Overlay>
      )}

      {phase === "select" && (
        <Overlay>
          <h2 className="font-display text-3xl tracking-tight">Velg nivå</h2>
          <p className="text-sm text-muted">Fullfør et nivå for å låse opp det neste.</p>
          <div className="mt-2 grid w-full max-w-lg gap-3">
            {LEVELS.map((lvl) => {
              const locked = lvl.id > unlocked;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={locked}
                  onClick={() => startLevel(lvl.id)}
                  className={cn(
                    "rounded-xl border border-border bg-surface p-4 text-left transition-colors duration-150",
                    locked ? "opacity-40" : "hover:border-border-strong hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl tracking-tight">{lvl.name}</span>
                    <span className="text-xs uppercase tracking-wider text-muted">
                      {locked ? "Låst" : `Beste ${best[lvl.id] ?? 0}/${lvl.coins.length}`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{lvl.blurb}</p>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" onClick={() => engineRef.current?.toTitle()}>
            Tilbake
          </Button>
        </Overlay>
      )}

      {phase === "paused" && (
        <Overlay dim>
          <h2 className="font-display text-3xl tracking-tight">Pause</h2>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Button size="lg" onClick={() => engineRef.current?.resume()}>
              <Play /> Fortsett
            </Button>
            <Button variant="outline" onClick={() => engineRef.current?.retryLevel()}>
              <RotateCcw /> Start nivået på nytt
            </Button>
            <Button variant="ghost" onClick={() => engineRef.current?.toSelect()}>
              Velg nivå
            </Button>
          </div>
        </Overlay>
      )}

      {phase === "dead" && (
        <Overlay dim>
          <h2 className="font-display text-3xl tracking-tight">Du falt</h2>
          <p className="text-sm text-muted">
            {checkpointOn ? "Du starter på siste sjekkpunkt." : "Du starter på begynnelsen."} Fall {deaths}.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Button size="lg" onClick={() => engineRef.current?.respawnFromCheckpoint()}>
              <RotateCcw /> Prøv igjen
            </Button>
            <Button variant="outline" onClick={() => engineRef.current?.retryLevel()}>
              Start nivået på nytt
            </Button>
            <Button variant="ghost" onClick={() => engineRef.current?.toSelect()}>
              Velg nivå
            </Button>
          </div>
        </Overlay>
      )}

      {phase === "win" && (
        <Overlay dim>
          <h2 className="font-display text-3xl tracking-tight">Flagget er nådd</h2>
          <p className="text-sm text-muted">
            {coins} av {total} mynter · {deaths} fall
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            {levelId < 3 && unlocked >= levelId + 1 && (
              <Button size="lg" onClick={() => startLevel(levelId + 1)}>
                <Flag /> Neste nivå
              </Button>
            )}
            <Button variant="outline" onClick={() => engineRef.current?.retryLevel()}>
              Spill på nytt
            </Button>
            <Button variant="ghost" onClick={() => engineRef.current?.toSelect()}>
              Velg nivå
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-6 text-center",
        dim ? "bg-bg/72" : "bg-bg/55",
      )}
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-[32px] border border-border bg-surface/92 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
        {children}
      </div>
    </div>
  );
}

function HudChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface/88 px-3 py-2 text-sm font-medium tabular-nums backdrop-blur-sm">
      {children}
    </div>
  );
}

function ControlsHint() {
  return (
    <p className="max-w-md text-xs leading-relaxed text-subtle">
      A/D eller piltaster for å løpe. Mellomrom, W eller pil opp for hopp. Hopp igjen i lufta for dobbelthopp. S + hopp for å
      falle gjennom hyller.
    </p>
  );
}

function hold(flag: "left" | "right" | "jump", on: boolean) {
  touch[flag] = on;
}

function TouchPad() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex gap-3">
        <TouchKey label="Venstre" onHold={(v) => hold("left", v)} />
        <TouchKey label="Høyre" onHold={(v) => hold("right", v)} />
      </div>
      <TouchKey label="Hopp" wide onHold={(v) => hold("jump", v)} />
    </div>
  );
}

function TouchKey({
  label,
  onHold,
  wide,
}: {
  label: string;
  onHold: (v: boolean) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "select-none rounded-lg border border-border-strong bg-surface/80 text-sm font-medium text-fg backdrop-blur-sm",
        wide ? "h-16 min-w-28 px-6" : "size-16",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}
