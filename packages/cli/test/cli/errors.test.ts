import { describe, expect, test } from "bun:test";
import { CliError, runAction } from "../../src/cli/errors.ts";

describe("CliError / runAction", () => {
  test("a CliError thrown inside runAction prints the message and returns 1", async () => {
    const error = console.error;
    const messages: string[] = [];
    console.error = (...args: unknown[]) => messages.push(args.join(" "));
    try {
      const result = await runAction(async () => {
        throw new CliError("something the user did wrong");
      });
      expect(result).toBe(1);
      expect(messages).toEqual(["something the user did wrong"]);
    } finally {
      console.error = error;
    }
  });

  test("a plain Error re-throws instead of being swallowed", async () => {
    await expect(
      runAction(async () => {
        throw new Error("a real bug");
      }),
    ).rejects.toThrow("a real bug");
  });

  test("a successful body returns its own exit code", async () => {
    expect(await runAction(async () => 0)).toBe(0);
  });
});
