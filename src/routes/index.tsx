import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameRoot } from "@/game/GameRoot";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  return (
    <main className="game-shell">
      {live ? <GameRoot /> : <Boot />}
    </main>
  );
}

function Boot() {
  return (
    <div className="flex h-full flex-col justify-end bg-ink p-8 pb-16 text-moon">
      <p className="text-sm text-sand">عالم مفتوح</p>
      <h1 className="font-display text-5xl">ممالك الشفق</h1>
      <p className="mt-3 max-w-md text-mist">القمر انشقّ. المدينة تنتظر أن تقف.</p>
    </div>
  );
}
