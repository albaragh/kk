import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const MidnightRush = lazy(() => import("@/components/game/MidnightRush"));

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <BootScreen />;
  return (
    <Suspense fallback={<BootScreen />}>
      <MidnightRush />
    </Suspense>
  );
}

export function BootScreen() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg text-fg">
      <p className="font-display text-5xl tracking-widest text-primary">MIDNIGHT RUSH</p>
      <p className="text-lg text-muted">أساطير السرعة</p>
      <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-1/2 animate-pulse bg-accent" />
      </div>
    </main>
  );
}
