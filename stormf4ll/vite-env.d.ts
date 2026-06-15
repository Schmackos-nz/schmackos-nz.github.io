import { useEffect, useRef, useState } from "react";
import { Game } from "../engine/Game";
import { Session } from "../engine/Session";
import Hud from "./Hud";
import type { MatchConfig } from "./App";

type Props = { config: MatchConfig; onExit: () => void };

export default function GameView({ config, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const game = new Game(canvasRef.current!, miniRef.current!, {
      hunter: config.hunter, difficulty: config.difficulty, squadSize: config.squadSize,
      role: Session.role, roster: Session.roster, myName: Session.handle,
    });
    gameRef.current = game;
    game.start();
    Session.setGame(game); // route in-match net messages here (replays buffered ones)
    let raf = 0, acc = 0, last = performance.now();
    const tick = (now: number) => { acc += now - last; last = now; if (acc >= 50) { acc = 0; setTick((t) => (t + 1) % 1000000); } raf = requestAnimationFrame(tick); }; // ~20 fps HUD
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); Session.clearGame(); game.destroy(); gameRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const game = gameRef.current;
  return (
    <div id="game" className="screen">
      <canvas ref={canvasRef} id="canvas" />
      {game && <Hud game={game} onExit={onExit} />}
      {/* minimap canvas is referenced by the engine for drawing */}
      <div id="minimap" style={{ display: game && game.phase === "choose" ? "none" : undefined }}>
        <canvas ref={miniRef} width={160} height={160} />
      </div>
    </div>
  );
}
