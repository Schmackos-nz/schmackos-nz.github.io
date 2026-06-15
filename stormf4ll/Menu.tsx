import { useEffect, useState } from "react";
import Menu from "./Menu";
import GameView from "./GameView";
import { Session } from "../engine/Session";

export type MatchConfig = {
  hunter: string;
  squadSize: number;
  difficulty: "easy" | "normal" | "hard";
};

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [config, setConfig] = useState<MatchConfig>({ hunter: "vanguard", squadSize: 1, difficulty: "normal" });

  useEffect(() => {
    Session.onStart = () => setScreen("game"); // a host started the match
    return () => { Session.onStart = null; };
  }, []);

  const play = () => { if (Session.role === "host") Session.startHostMatch(); setScreen("game"); };
  const exit = () => { Session.leave(); setScreen("menu"); };

  return screen === "menu"
    ? <Menu config={config} setConfig={setConfig} onPlay={play} />
    : <GameView config={config} onExit={exit} />;
}
