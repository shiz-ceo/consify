"use client";

import { useState } from "react";

// <Counter /> is an interactive example: any client component can live in custom/components.
export default function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div className="my-4 flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card p-4">
      <button
        type="button"
        className="rounded-md bg-fd-primary px-3 py-1.5 text-sm font-medium text-fd-primary-foreground"
        onClick={() => setCount((c) => c + 1)}
      >
        Add job
      </button>
      <span className="text-sm text-fd-muted-foreground">
        Jobs in queue: <strong className="text-fd-foreground">{count}</strong>
      </span>
      <button
        type="button"
        className="ml-auto text-sm text-fd-muted-foreground underline"
        onClick={() => setCount(start)}
      >
        Reset
      </button>
    </div>
  );
}
