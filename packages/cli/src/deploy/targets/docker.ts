import { githubRepoSlug } from "../git.ts";
import { ciChecks, ciHeader } from "../snippets/ci.ts";
import { serverBlock } from "../snippets/nginx.ts";
import type { DeployTarget } from "../types.ts";

const staticDockerfile = `# Multi-stage: the build needs Bun, the site only needs a place to serve static files from.
FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# nginx alone serves the result: no Node or Bun in the final image (a few MB, not a few hundred).
FROM nginx:1.27-alpine
COPY --from=build /app/build/client /usr/share/nginx/html
COPY deploy/docker-nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
`;

const serverDockerfile = `FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npx", "consify", "start"]
`;

/** Inside the container, both flavors listen on the same port, so the front nginx never needs to know which one is inside. */
const containerPort = 3000;

export const docker: DeployTarget = {
  id: "docker",
  label: "Docker",
  description: "A container per site, reachable only from a shared nginx you already run.",
  modes: ["static", "server"],
  flags: ["--name <slug>", "--domain <host>", "--path </prefix>", "--ci"],

  write({ slug, domain, path, config, cwd, ci }) {
    const isStatic = config.deploy.mode === "static";
    const image = `ghcr.io/${githubRepoSlug(cwd) ?? "your-org/your-repo"}/${slug}`;
    const files = [
      {
        path: "Dockerfile",
        content: isStatic ? staticDockerfile : serverDockerfile,
      },
      {
        path: ".dockerignore",
        content: `node_modules\nbuild\n.consify\n.git\n`,
      },
      {
        path: "docker-compose.yml",
        content: `services:
  ${slug}:
    ${ci ? `image: ${image}:latest` : "build: ."}
    restart: unless-stopped
    # not published to the host: only reachable from the "web" network, by other containers
    # (your shared nginx, if it also runs in Docker) — nothing to collide with another site over
    expose:
      - "${containerPort}"
    networks: [web]

networks:
  web:
    external: true
`,
      },
    ];

    if (ci) {
      files.push({
        path: ".github/workflows/deploy.yml",
        content: `${ciHeader("Deploy")}
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
${ciChecks}

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${image}:latest,${image}:\${{ github.sha }}

      - name: Copy compose files
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete
          path: docker-compose.yml deploy/
          remote_path: \${{ secrets.DEPLOY_PATH }}
          remote_host: \${{ secrets.DEPLOY_HOST }}
          remote_user: \${{ secrets.DEPLOY_USER }}
          remote_key: \${{ secrets.DEPLOY_SSH_KEY }}
      - name: Pull and restart
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.DEPLOY_HOST }}
          username: \${{ secrets.DEPLOY_USER }}
          key: \${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd \${{ secrets.DEPLOY_PATH }}
            docker compose pull
            docker compose up -d
`,
      });
    }

    if (isStatic) {
      files.push({
        path: "deploy/docker-nginx.conf",
        content: `# Inside the container: nginx here only serves the files, this is not the internet-facing nginx.
server {
    listen ${containerPort};
    server_name _;
    root /usr/share/nginx/html;

    location = / {
        return 302 /${config.i18n.defaultLanguage}/;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    error_page 404 /404/index.html;
}
`,
      });
    }

    files.push({
      path: `deploy/nginx/${slug}.conf`,
      content: serverBlock({
        slug,
        domain,
        path,
        defaultLanguage: config.i18n.defaultLanguage,
        upstream: { kind: "proxy", target: `${slug}:${containerPort}` },
      }),
    });

    return files;
  },

  notes({ slug, cwd, ci }) {
    const notes = [
      `Create the shared network once, if it does not exist yet: docker network create web. Every consify site (and anything else you front with the same nginx) joins it the same way.`,
      `deploy/nginx/${slug}.conf is a fragment for your OWN nginx (in Docker or on the host) — include it, get a certificate for the domain it names, then reload nginx. It never listens on a host port directly.`,
    ];
    if (ci) {
      notes.push(
        `On the server, first: mkdir -p /path/to/${slug} && cd /path/to/${slug} && docker network create web (if it does not exist) — that folder only ever needs docker-compose.yml and deploy/, the workflow copies them itself.`,
        `Add these secrets to the GitHub repository (Settings → Secrets and variables → Actions): DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY (a private key whose public half is in that user's authorized_keys) and DEPLOY_PATH (the /path/to/${slug} above). GITHUB_TOKEN for ghcr.io is already there.`,
        githubRepoSlug(cwd)
          ? `Every push to main that touches the site now checks, builds, pushes ghcr.io/${githubRepoSlug(cwd)}/${slug} and restarts it on the server — see .github/workflows/deploy.yml.`
          : `Every push to main that touches the site now checks, builds and deploys — see .github/workflows/deploy.yml. It could not read a GitHub remote to fill in the image name, so it wrote the placeholder your-org/your-repo in docker-compose.yml and the workflow: replace both with the real ${slug} package your repository pushes to.`,
        "Make the package public (or add a registry login step) if the server pulling it is not itself authenticated to ghcr.io — a private package needs `docker login ghcr.io` with a token that can read: packages, run once on the server.",
      );
    } else {
      notes.push(
        `Build and start: docker compose up -d --build. The container is named "${slug}" on the "web" network — that is also its hostname for the nginx proxy.`,
        "To update: pull the new code, `docker compose up -d --build` again. A short gap while the container restarts is normal for a docs site; ask if you need a zero-downtime (blue/green) setup instead, or pass --ci to automate this over SSH from GitHub Actions.",
      );
    }
    return notes;
  },
};
