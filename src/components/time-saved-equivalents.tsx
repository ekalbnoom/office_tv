"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

type Fact = { metric: string; text: string };

// Compact, friendly number: 2,082 / 1.5M etc.
function n(x: number): string {
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(x < 10_000_000 ? 1 : 0)}M`;
  return Math.round(x).toLocaleString();
}

// Relatable equivalents, in the spirit of the LinkedIn post.
function buildFacts(hours: number, dollars: number): Fact[] {
  const f: Fact[] = [];
  const time = (text: string) => f.push({ metric: "Time saved", text });
  const cash = (text: string) => f.push({ metric: "Collected", text });

  if (hours > 0) {
    time(`${n(hours / 48.5)} full rewatches of Breaking Bad`);
    time(`${n(hours / 73.7)} binges of The Office, start to finish`);
    time(`${n(hours / 85)} runs through all of Friends`);
    time(`${n(hours / 70)} laps through Game of Thrones`);
    time(`${n(hours / 115)} full rewatches of the entire MCU`);
    time(`${n(hours / 11)} plays of Taylor Swift's whole discography`);
    time(`${n(hours * 12)} games of Wordle`);
    time(`${n(hours / 0.75)} Peloton classes`);
    time(`${n(hours / 5)} sourdough loaves, proof to plate`);
    time(`${n(hours * 3)} games of pickleball`);
    time(`${n(hours / 14)} briskets smoked low & slow`);
    time(`${n(hours / 2)} movies start to finish`);
    time(`${n(hours / 6)} flights from NYC to LA`);
    time(`${n(hours / 547.5)} years of average daily TikTok scrolling`);
    time(`a 30-min nap every day for ${n(hours / 182.5)} years`);
    time(`${n(hours / 2080)} years of full-time work`);
  }
  if (dollars > 0) {
    cash(`${n(dollars / 12)} avocado toasts`);
    cash(`${n(dollars / 6)} oat-milk lattes`);
    cash(`${n(dollars / 11)} Chipotle burritos`);
    cash(`${n(dollars / 45)} bottomless brunches`);
    cash(`${n(dollars / 35)} DoorDash orders`);
    cash(`${n(dollars / 186)} years of Netflix`);
    cash(`${n(dollars / 1000)} brand-new iPhones`);
    cash(`${n(dollars / 1300)} Eras Tour tickets (resale, obviously)`);
    cash(`${n(dollars / 1445)} Pelotons`);
    cash(`${n(dollars / 1500)} months of average US rent`);
    cash(`${n(dollars / 38000)} average student-loan balances paid off`);
    cash(`${n(dollars / 42000)} Tesla Model 3s`);
    cash(`${n(dollars / 84000)} starter-home down payments`);
    cash(`${n(dollars / 420000)} median US homes`);
  }
  return f;
}

function shuffle<T>(arr: T[], avoidFirst?: T): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  // Don't immediately repeat the last-shown item at the top of the new cycle.
  if (avoidFirst !== undefined && r.length > 1 && r[0] === avoidFirst) {
    [r[0], r[1]] = [r[1], r[0]];
  }
  return r;
}

const ROTATE_MS = 60_000;

export function TimeSavedEquivalents({
  timeSavedLabel,
  collectedCents,
}: {
  timeSavedLabel: string;
  collectedCents: number;
}) {
  const facts = useMemo(() => {
    const hours = parseFloat(timeSavedLabel.replace(/[^0-9.]/g, "")) || 0;
    return buildFacts(hours, collectedCents / 100);
  }, [timeSavedLabel, collectedCents]);

  // Start in deterministic order so server and first client render match (no
  // hydration mismatch); shuffle happens in an effect after mount.
  const [queue, setQueue] = useState<Fact[]>(facts);
  const [i, setI] = useState(0);

  useEffect(() => {
    setQueue(shuffle(facts));
    setI(0);
  }, [facts]);

  useEffect(() => {
    if (queue.length <= 1) return;
    const t = setInterval(() => {
      setI((prev) => {
        const next = prev + 1;
        if (next >= queue.length) {
          // Cycled through everything — reshuffle for a fresh, non-repeating run.
          setQueue((q) => shuffle(q, q[q.length - 1]));
          return 0;
        }
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [queue]);

  if (queue.length === 0) return null;
  const fact = queue[i] ?? queue[0];

  return (
    <div className="flex items-center justify-center gap-3 text-muted">
      <Sparkles className="h-5 w-5 flex-none text-signal" aria-hidden />
      <p className="text-center text-lg 2xl:text-xl">
        <span className="font-semibold uppercase tracking-[0.18em] text-signal">
          {fact.metric}
        </span>
        <span className="px-2 text-line">·</span>
        that&apos;s about <span className="font-semibold text-foreground">{fact.text}</span>
      </p>
    </div>
  );
}
