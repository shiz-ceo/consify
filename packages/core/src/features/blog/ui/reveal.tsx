"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

const RevealContext = createContext(true);

/**
 * The container of the side columns of a post. They are shown while the container is in the upper
 * three quarters of the screen and hidden again when the reader scrolls back above it, so the
 * effect repeats in both directions and every column changes state at the same moment.
 */
export function RevealGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShown(entry?.isIntersecting ?? false),
      { rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <RevealContext.Provider value={shown}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </RevealContext.Provider>
  );
}

/** Fades in (with a small rise) while its `RevealGroup` is reached. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const shown = useContext(RevealContext);
  return (
    <div
      className={`transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
