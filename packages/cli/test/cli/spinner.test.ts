import { describe, expect, test } from "bun:test";
import { spinner } from "../../src/cli/spinner.ts";

// `process.stdout.isTTY` is `false` in the test runner (as in CI), so `spinner()` always takes its
// non-animated, plain-line fallback path — the only realistically testable behavior without
// mocking a real TTY, which is not worth doing for this.
describe("spinner (non-TTY)", () => {
  test("prints a plain line for the initial message", () => {
    const log = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      spinner("working…");
      expect(lines).toEqual(["working…"]);
    } finally {
      console.log = log;
    }
  });

  test("update/succeed/fail each print a plain line", () => {
    const log = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      const s = spinner("working…");
      s.update("still working…");
      s.succeed("done");
      const s2 = spinner("second");
      s2.fail("nope");
      expect(lines).toEqual(["working…", "still working…", "done", "second", "nope"]);
    } finally {
      console.log = log;
    }
  });

  test("succeed/fail fall back to the last message when none is given", () => {
    const log = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      const s = spinner("initial");
      s.succeed();
      expect(lines).toEqual(["initial", "initial"]);
    } finally {
      console.log = log;
    }
  });
});
