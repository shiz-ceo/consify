// `consify start --socket <path>`: the same server `@react-router/serve` runs, bound to a Unix
// socket instead of a TCP port. `@react-router/serve`'s own CLI only reads `PORT`/`HOST` and always
// calls `.listen(port)` — it has no way to bind a socket path — so this is a small server of our
// own for that one case. Everything else (static assets, compression, request handling) mirrors
// it, so the two only differ in what they bind to.
//
// This path exists for one reason: several consify instances (or other apps) can share one
// machine without each claiming a TCP port, when they are all fronted by the same nginx —
// see `consify deploy nginx --socket`.
import { chmodSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

/** Group-writable so a socket owned by this process can still be reached by nginx's own group. */
const socketMode = 0o660;

/**
 * `consify start --socket <path>`: serves a server build on a Unix socket (for nginx) instead of a
 * TCP port. Returns the exit code when the server stops; 1 if the build is missing.
 */
export async function runServeSocketCommand(
  buildPathArg: string,
  socketPath: string,
  cwd: string,
): Promise<number> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

  const buildPath = resolve(cwd, buildPathArg || "./build/server/index.js");
  if (!existsSync(buildPath)) {
    console.error(`Build not found at ${buildPath}. Run \`consify build\` first.`);
    return 1;
  }
  const build = await import(pathToFileURL(buildPath).href);

  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  const assetsDir = resolve(dirname(buildPath), "..", "client");
  app.use(
    "/assets",
    express.static(resolve(assetsDir, "assets"), { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static(assetsDir));
  app.use(express.static(resolve(cwd, "public"), { maxAge: "1h" }));
  app.use(morgan("tiny"));
  // Express 5's router (path-to-regexp v8) dropped the bare "*" wildcard — this is the same
  // "match everything" pattern @react-router/serve's own CLI uses.
  app.all("/{*splat}", createRequestHandler({ build, mode: process.env.NODE_ENV }));

  // a socket left behind by a crashed previous run would otherwise make `listen` fail with EADDRINUSE
  if (existsSync(socketPath)) unlinkSync(socketPath);

  return new Promise((resolvePromise) => {
    const server = app.listen(socketPath, () => {
      chmodSync(socketPath, socketMode);
      console.log(`[consify start] listening on ${socketPath}`);
    });
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        server.close(() => {
          if (existsSync(socketPath)) unlinkSync(socketPath);
          resolvePromise(0);
        });
      });
    }
  });
}
