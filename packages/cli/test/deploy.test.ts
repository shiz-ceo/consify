import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDeploy } from "../src/deploy/command.ts";
import { slugify } from "../src/deploy/slug.ts";
import { serverBlock } from "../src/deploy/snippets/nginx.ts";
import { deployTargets, findTarget } from "../src/deploy/targets-list.ts";
import { runDoctor } from "../src/doctor.ts";
import { runServeSocketCommand } from "../src/serve-socket.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-deploy-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function config(extra = "") {
  writeFileSync(
    join(cwd, "docs.config.ts"),
    `export default { site: { name: "Lattice Docs" }, i18n: { defaultLanguage: "en", languages: ["en"] }, deploy: { mode: "static" }, features: [], mdx: { plugins: [] } ${extra} };`,
  );
}

const silent = async <T>(run: () => Promise<T>): Promise<{ result: T; out: string }> => {
  const log = console.log;
  const error = console.error;
  let out = "";
  console.log = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
  console.error = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
  try {
    return { result: await run(), out };
  } finally {
    console.log = log;
    console.error = error;
  }
};

describe("slugify", () => {
  test("keeps it URL/Docker-service safe", () => {
    expect(slugify("Lattice Docs")).toBe("lattice-docs");
    expect(slugify("  Ада!! v2  ")).toBe("v2");
    expect(slugify("")).toBe("site");
  });
});

describe("the registry", () => {
  test("every target has a unique id", () => {
    const ids = deployTargets.map((target) => target.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findTarget("docker")?.label).toBe("Docker");
    expect(findTarget("nope")).toBeUndefined();
  });
});

describe("nginx server block", () => {
  test("a domain gets its own server {}, with HTTP/3 by default", () => {
    const block = serverBlock({
      slug: "docs",
      domain: "docs.example.com",
      defaultLanguage: "en",
      upstream: { kind: "files", root: "/var/www/docs/current" },
    });
    expect(block).toContain("server_name docs.example.com;");
    expect(block).toContain("listen 443 quic reuseport;");
    expect(block).toContain("http3 on;");
    expect(block).toContain("root /var/www/docs/current;");
    expect(block).toContain("return 302 /en/;");
  });

  test("http3: false drops the QUIC lines but keeps the rest", () => {
    const block = serverBlock({
      slug: "docs",
      domain: "docs.example.com",
      defaultLanguage: "en",
      http3: false,
      upstream: { kind: "proxy", target: "127.0.0.1:4000" },
    });
    expect(block).not.toContain("quic");
    expect(block).not.toContain("http3 on;");
    expect(block).toContain("proxy_pass http://127.0.0.1:4000;");
  });

  test("a path shares an existing domain instead of a server block of its own", () => {
    const block = serverBlock({
      slug: "docs",
      path: "/docs/",
      defaultLanguage: "en",
      upstream: { kind: "proxy", target: "docs:3000" },
    });
    expect(block).not.toContain("server_name");
    expect(block).not.toContain("ssl_certificate");
    expect(block).toContain("location /docs/ {");
  });
});

describe("consify deploy", () => {
  test("list and check run without a target", async () => {
    config(', site: { name: "Lattice Docs", url: "https://example.com" }');
    expect((await silent(() => runDeploy({ target: "list" }, cwd))).out).toContain("github-pages");
    expect((await silent(() => runDeploy({ target: "check" }, cwd))).result).toBe(0);
  });

  test("check complains about a static site with no site.url", async () => {
    config();
    const { result, out } = await silent(() => runDeploy({ target: "check" }, cwd));
    expect(result).toBe(1);
    expect(out).toContain("site.url is not set");
  });

  test("an unknown target is an error", async () => {
    config();
    expect((await silent(() => runDeploy({ target: "nope" }, cwd))).result).toBe(1);
  });

  test("a static-only target refuses a server config", async () => {
    config(', deploy: { mode: "server" }');
    const { result, out } = await silent(() => runDeploy({ target: "github-pages" }, cwd));
    expect(result).toBe(1);
    expect(out).toContain("only serves static");
  });

  test("github-pages writes a workflow and explains the custom domain / basePath choice", async () => {
    config();
    const { result, out } = await silent(() => runDeploy({ target: "github-pages" }, cwd));
    expect(result).toBe(0);
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain("actions/deploy-pages@v4");
    expect(out).toContain("deploy.basePath");
  });

  test("does not overwrite without --force", async () => {
    config();
    await silent(() => runDeploy({ target: "netlify" }, cwd));
    const { result, out } = await silent(() => runDeploy({ target: "netlify" }, cwd));
    expect(result).toBe(1);
    expect(out).toContain("--force");
    await silent(() => runDeploy({ target: "netlify", force: true }, cwd));
  });

  test("netlify and vercel bake in the default language for the root redirect", async () => {
    config();
    await silent(() => runDeploy({ target: "netlify" }, cwd));
    expect(readFileSync(join(cwd, "netlify.toml"), "utf8")).toContain('to = "/en/"');
    await silent(() => runDeploy({ target: "vercel" }, cwd));
    expect(readFileSync(join(cwd, "vercel.json"), "utf8")).toContain('"destination": "/en/"');
  });

  test("cloudflare-pages writes _redirects and _headers", async () => {
    config();
    await silent(() => runDeploy({ target: "cloudflare-pages" }, cwd));
    expect(existsSync(join(cwd, "public/_redirects"))).toBe(true);
    expect(readFileSync(join(cwd, "public/_headers"), "utf8")).toContain("immutable");
  });

  test("docker: static mode ships an nginx-only image, server mode ships Node", async () => {
    config();
    await silent(() =>
      runDeploy({ target: "docker", name: "docs", domain: "docs.example.com" }, cwd),
    );
    expect(readFileSync(join(cwd, "Dockerfile"), "utf8")).toContain("FROM nginx:1.27-alpine");
    expect(existsSync(join(cwd, "deploy/docker-nginx.conf"))).toBe(true);
    const compose = readFileSync(join(cwd, "docker-compose.yml"), "utf8");
    expect(compose).toContain("docs:");
    expect(compose).not.toContain("ports:");
    const front = readFileSync(join(cwd, "deploy/nginx/docs.conf"), "utf8");
    expect(front).toContain("proxy_pass http://docs:3000;");

    rmSync(cwd, { recursive: true, force: true });
    cwd = mkdtempSync(join(tmpdir(), "consify-deploy-"));
    config(', deploy: { mode: "server" }');
    await silent(() => runDeploy({ target: "docker", name: "docs" }, cwd));
    expect(readFileSync(join(cwd, "Dockerfile"), "utf8")).toContain("FROM node:22-alpine");
    expect(existsSync(join(cwd, "deploy/docker-nginx.conf"))).toBe(false);
  });

  test("nginx target: static serves files, server proxies to a local port", async () => {
    config();
    await silent(() =>
      runDeploy({ target: "nginx", name: "docs", domain: "docs.example.com" }, cwd),
    );
    expect(readFileSync(join(cwd, "deploy/nginx/docs.conf"), "utf8")).toContain(
      "root /var/www/docs/current;",
    );

    rmSync(cwd, { recursive: true, force: true });
    cwd = mkdtempSync(join(tmpdir(), "consify-deploy-"));
    config(', deploy: { mode: "server" }');
    const { out } = await silent(() =>
      runDeploy({ target: "nginx", name: "docs", domain: "docs.example.com" }, cwd),
    );
    expect(readFileSync(join(cwd, "deploy/nginx/docs.conf"), "utf8")).toContain(
      "proxy_pass http://127.0.0.1:4000;",
    );
    expect(out).toContain("systemd");
    expect(readFileSync(join(cwd, "deploy/systemd/docs.service"), "utf8")).toContain(
      "Environment=PORT=4000",
    );
  });

  test("nginx target: --port changes the proxied port", async () => {
    config(', deploy: { mode: "server" }');
    await silent(() => runDeploy({ target: "nginx", name: "docs", port: "5050" }, cwd));
    expect(readFileSync(join(cwd, "deploy/nginx/docs.conf"), "utf8")).toContain(
      "proxy_pass http://127.0.0.1:5050;",
    );
    expect(readFileSync(join(cwd, "deploy/systemd/docs.service"), "utf8")).toContain(
      "Environment=PORT=5050",
    );
  });

  test("nginx target: --socket proxies to a Unix socket instead of a port, and skips consify start's normal port entirely", async () => {
    config(', deploy: { mode: "server" }');
    const { out } = await silent(() =>
      runDeploy({ target: "nginx", name: "docs", socket: "/run/docs.sock" }, cwd),
    );
    const nginxConf = readFileSync(join(cwd, "deploy/nginx/docs.conf"), "utf8");
    expect(nginxConf).toContain("proxy_pass http://unix:/run/docs.sock:;");
    expect(nginxConf).not.toContain("127.0.0.1");
    const unit = readFileSync(join(cwd, "deploy/systemd/docs.service"), "utf8");
    expect(unit).toContain("Environment=SOCKET_PATH=/run/docs.sock");
    // systemd needs an absolute executable
    expect(unit).toContain(
      "ExecStart=/var/www/docs/current/node_modules/.bin/consify start --socket /run/docs.sock",
    );
    expect(out).toContain("/run/docs.sock");
  });

  test("nginx target: a static site gets no systemd unit (there is no process to run)", async () => {
    config();
    await silent(() => runDeploy({ target: "nginx", name: "docs" }, cwd));
    expect(existsSync(join(cwd, "deploy/systemd/docs.service"))).toBe(false);
  });

  test("docker --ci writes a workflow, and switches the compose file to a pulled image", async () => {
    config();
    const { out } = await silent(() =>
      runDeploy({ target: "docker", name: "docs", ci: true }, cwd),
    );
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain("docker/build-push-action");
    expect(workflow).toContain("bunx consify doctor");
    expect(workflow).toContain("appleboy/ssh-action");
    const compose = readFileSync(join(cwd, "docker-compose.yml"), "utf8");
    expect(compose).toContain("image: ghcr.io/your-org/your-repo/docs:latest");
    expect(compose).not.toContain("build: .");
    expect(out).toContain("DEPLOY_PATH");
  });

  test("docker --ci reads the real image name from a GitHub remote", async () => {
    config();
    execFileSync("git", ["init", "-q"], { cwd });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:Shiz-Ceo/Lattice.git"], {
      cwd,
    });
    await silent(() => runDeploy({ target: "docker", name: "docs", ci: true }, cwd));
    const compose = readFileSync(join(cwd, "docker-compose.yml"), "utf8");
    expect(compose).toContain("image: ghcr.io/shiz-ceo/lattice/docs:latest");
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain(
      "ghcr.io/shiz-ceo/lattice/docs:latest,ghcr.io/shiz-ceo/lattice/docs:${{ github.sha }}",
    );
  });

  test("nginx --ci: static mode uploads build/client and never restarts a service", async () => {
    config();
    const { out } = await silent(() =>
      runDeploy({ target: "nginx", name: "docs", domain: "docs.example.com", ci: true }, cwd),
    );
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain("path: build/client/");
    expect(workflow).not.toContain("systemctl restart");
    expect(workflow).not.toContain("bun install --production");
    expect(existsSync(join(cwd, "deploy/systemd/docs.service"))).toBe(false);
    expect(out).not.toContain("Install and enable deploy/systemd");
  });

  test("nginx --ci: server mode uploads the whole project and restarts the systemd unit", async () => {
    config(', deploy: { mode: "server" }');
    const { out } = await silent(() =>
      runDeploy({ target: "nginx", name: "docs", domain: "docs.example.com", ci: true }, cwd),
    );
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain("path: ./");
    expect(workflow).toContain("bun install --production --frozen-lockfile");
    expect(workflow).toContain("systemctl restart docs");
    expect(out).toContain("systemctl enable docs");
  });

  test("the workflows both check before deploying, and only on a relevant path", async () => {
    config();
    await silent(() => runDeploy({ target: "nginx", name: "docs", ci: true }, cwd));
    const workflow = readFileSync(join(cwd, ".github/workflows/deploy.yml"), "utf8");
    expect(workflow).toContain('paths: ["content/**"');
    expect(workflow.indexOf("bun run build")).toBeLessThan(workflow.indexOf("Upload release"));
  });
});

describe("consify doctor", () => {
  test("reports a missing config and returns a non-zero exit code", async () => {
    // no docs.config.ts written: loadConfig itself throws "was not found"
    const { result, out } = await silent(() => runDoctor(cwd));
    expect(result).toBe(1);
    expect(out).toContain("docs.config.ts");
  });

  test("passes with a minimal valid config", async () => {
    config();
    const { result } = await silent(() => runDoctor(cwd));
    expect(result).toBe(0);
  });
});

describe("consify start --socket", () => {
  test("reports a missing build instead of an unhandled listen error", async () => {
    const { result, out } = await silent(() =>
      runServeSocketCommand("./build/server/index.js", join(cwd, "docs.sock"), cwd),
    );
    expect(result).toBe(1);
    expect(out).toContain("Build not found");
  });
});
