import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectPackageManager } from "../../src/registry/package-manager.ts";

describe("detectPackageManager", () => {
  let cwd: string;
  const originalUserAgent = process.env.npm_config_user_agent;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-package-manager-"));
    delete process.env.npm_config_user_agent;
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    if (originalUserAgent === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = originalUserAgent;
  });

  test("finds the package manager from npm_config_user_agent, same as create-consify", () => {
    process.env.npm_config_user_agent = "bun/1.2.0 npm/? node/v24";
    expect(detectPackageManager(cwd)).toBe("bun");
    process.env.npm_config_user_agent = "pnpm/9.0.0 npm/? node/v22";
    expect(detectPackageManager(cwd)).toBe("pnpm");
    process.env.npm_config_user_agent = "yarn/4.0.0 npm/? node/v22";
    expect(detectPackageManager(cwd)).toBe("yarn");
  });

  test("falls back to sniffing a lockfile in cwd when no user agent is set", () => {
    expect(detectPackageManager(cwd)).toBe("npm"); // no lockfile at all yet
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(cwd)).toBe("pnpm");
  });

  test("bun.lock takes precedence when present", () => {
    writeFileSync(join(cwd, "bun.lock"), "");
    expect(detectPackageManager(cwd)).toBe("bun");
  });

  test("yarn.lock is detected", () => {
    writeFileSync(join(cwd, "yarn.lock"), "");
    expect(detectPackageManager(cwd)).toBe("yarn");
  });

  test("defaults to npm when nothing else matches, same as create-consify", () => {
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22";
    expect(detectPackageManager(cwd)).toBe("npm");
    delete process.env.npm_config_user_agent;
    expect(detectPackageManager(cwd)).toBe("npm");
  });
});
