import { ciChecks, ciHeader } from "../snippets/ci.ts";
import { serverBlock } from "../snippets/nginx.ts";
import type { DeployTarget } from "../types.ts";

const defaultPort = 4000;
const releasesToKeep = 5;

/** Self-host without Docker: nginx serves the static build itself, or proxies to `consify start`. */
export const nginx: DeployTarget = {
  id: "nginx",
  label: "Nginx (no Docker)",
  description:
    "A server block to `include` from your own nginx.conf: it never replaces the rest of it.",
  modes: ["static", "server"],
  flags: ["--domain <host>", "--path </prefix>", "--port <number>", "--socket <path>", "--ci"],

  write({ slug, domain, path, port, socket, config, ci }) {
    const isStatic = config.deploy.mode === "static";
    const files = [
      {
        path: `deploy/nginx/${slug}.conf`,
        content: serverBlock({
          slug,
          domain,
          path,
          defaultLanguage: config.i18n.defaultLanguage,
          upstream: isStatic
            ? { kind: "files", root: `/var/www/${slug}/current` }
            : socket
              ? { kind: "socket", path: socket }
              : { kind: "proxy", target: `127.0.0.1:${port ?? defaultPort}` },
        }),
      },
    ];

    if (!isStatic) {
      const listen = socket
        ? `Environment=SOCKET_PATH=${socket}`
        : `Environment=PORT=${port ?? defaultPort}`;
      files.push({
        path: `deploy/systemd/${slug}.service`,
        content: `# Copy to /etc/systemd/system/${slug}.service on the server, then:
#   systemctl daemon-reload && systemctl enable --now ${slug}
[Unit]
Description=${config.site.name} (consify)
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/${slug}/current
# systemd does not search PATH: the executable has to be an absolute path
ExecStart=/var/www/${slug}/current/node_modules/.bin/consify start${socket ? ` --socket ${socket}` : ""}
${listen}
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=2
# a normal, unprivileged user is enough — nginx reaches this over ${socket ? "the socket" : "localhost"}, not the network
User=www-data

[Install]
WantedBy=multi-user.target
`,
      });
    }

    if (ci) {
      const releaseDir = `/var/www/${slug}/releases/\${{ github.sha }}`;
      const restart = isStatic ? "" : `\n            systemctl restart ${slug}`;
      const install = isStatic
        ? ""
        : `cd ${releaseDir} && bun install --production --frozen-lockfile\n            `;
      files.push({
        path: ".github/workflows/deploy.yml",
        content: `${ciHeader("Deploy")}
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
${ciChecks}

      - name: Upload release
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete --exclude=.git --exclude=node_modules
          path: ${isStatic ? "build/client/" : "./"}
          remote_path: ${releaseDir}/
          remote_host: \${{ secrets.DEPLOY_HOST }}
          remote_user: \${{ secrets.DEPLOY_USER }}
          remote_key: \${{ secrets.DEPLOY_SSH_KEY }}

      - name: Switch and restart
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.DEPLOY_HOST }}
          username: \${{ secrets.DEPLOY_USER }}
          key: \${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            ${install}ln -sfn ${releaseDir} /var/www/${slug}/current${restart}
            cd /var/www/${slug}/releases && ls -1dt */ | tail -n +${releasesToKeep + 1} | xargs -r rm -rf
`,
      });
    }

    return files;
  },

  notes({ slug, port, socket, config, ci }) {
    const isStatic = config.deploy.mode === "static";
    const notes = [
      `Copy deploy/nginx/${slug}.conf to the server and add "include /path/to/${slug}.conf;" inside the http {} of your own nginx.conf — it is a fragment, not a replacement.`,
      "Get a certificate first (certbot or acme.sh) for the domain in the file, at the path the file expects, then reload nginx (`nginx -t && systemctl reload nginx`).",
      `Create /var/www/${slug}/releases once: mkdir -p /var/www/${slug}/releases.`,
    ];
    if (!isStatic) {
      notes.push(
        socket
          ? `deploy/systemd/${slug}.service runs consify's own small server (not @react-router/serve, which cannot bind a socket) on ${socket} — nginx proxies to it directly, no port to collide with another instance on this machine.`
          : `deploy/systemd/${slug}.service runs \`consify start\` on port ${port ?? defaultPort} — give every consify instance on this machine its own port (or pass --socket instead to avoid ports entirely).`,
      );
    }
    if (ci) {
      notes.push(
        `Add these secrets to the GitHub repository (Settings → Secrets and variables → Actions): DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY (a private key whose public half is in that user's authorized_keys).`,
      );
      if (!isStatic) {
        notes.push(
          `Install and enable deploy/systemd/${slug}.service once: systemctl daemon-reload && systemctl enable ${slug} (the workflow restarts it after every deploy, it does not need to be running yet).`,
        );
      }
      notes.push(
        `Every push to main that touches the site now checks, builds, uploads a new release under /var/www/${slug}/releases/ and swaps the "current" symlink to it — see .github/workflows/deploy.yml. It keeps the last ${releasesToKeep} releases and removes the rest.`,
      );
    } else {
      notes.push(
        isStatic
          ? `Build with \`bun run build\` and put the contents of build/client at /var/www/${slug}/current on the server (rsync, scp, or a small deploy script). A symlink swap (build into a new folder, then repoint the "current" symlink) makes updates atomic.`
          : `Build with \`bun run build\` and put the project (build/, node_modules/, package.json) at /var/www/${slug}/current on the server — that is what the systemd unit's WorkingDirectory expects. A symlink swap (build into a new folder, then repoint the "current" symlink) makes updates atomic, then \`systemctl daemon-reload && systemctl enable --now ${slug}\`.`,
        "Or pass --ci to automate all of this over SSH from GitHub Actions instead.",
      );
    }
    return notes;
  },
};
