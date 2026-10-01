/**
 * One nginx `server { }` block (or `location { }` fragment, for the path-based case) for one site.
 * It is meant to be `include`d from an admin's own `nginx.conf`, never a whole config of its own:
 * a machine running several consify sites (or other applications) `include`s one of these per site.
 */

export type Upstream =
  /** A static build: nginx reads the files itself, no process to run. */
  | { kind: "files"; root: string }
  /** A server build behind a reverse proxy: a plain address (`127.0.0.1:4000`) or a Docker service. */
  | { kind: "proxy"; target: string }
  /** A server build listening on a Unix socket instead of a TCP port. */
  | { kind: "socket"; path: string };

export interface ServerBlockOptions {
  slug: string;
  upstream: Upstream;
  defaultLanguage: string;
  /** A domain gets its own `server {}`; a path shares an existing domain via a `location {}`. */
  domain?: string | undefined;
  path?: string | undefined;
  /** Adds the HTTP/3 (QUIC) listener and `Alt-Svc` header. Needs nginx built with ngx_http_v3_module. */
  http3?: boolean | undefined;
}

function contentBlock(upstream: Upstream, base: string, defaultLanguage: string): string {
  if (upstream.kind === "proxy" || upstream.kind === "socket") {
    const target = upstream.kind === "socket" ? `unix:${upstream.path}:` : upstream.target;
    return `    location ${base} {
        proxy_pass http://${target};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }`;
  }
  const prefix = base.replace(/\/+$/, "");
  if (prefix) {
    // shared domain: everything is scoped under the path, the other locations of that server {} stay untouched
    return `    # a static build has no server, so \`${prefix}/\` is a real redirect here instead of the meta-refresh
    # page the build makes for hosts that cannot do this (see \`consify build\` static mode)
    location = ${prefix}/ {
        return 302 ${prefix}/${defaultLanguage}/;
    }

    location ^~ ${prefix}/ {
        alias ${upstream.root}/;
        try_files $uri $uri/ =404;
        error_page 404 ${prefix}/404/index.html;
    }

    location ^~ ${prefix}/assets/ {
        alias ${upstream.root}/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }`;
  }
  return `    root ${upstream.root};

    # a static build has no server, so \`/\` is a real redirect here instead of the meta-refresh
    # page the build makes for hosts that cannot do this (see \`consify build\` static mode)
    location = / {
        return 302 /${defaultLanguage}/;
    }

    location ${base} {
        try_files $uri $uri/ =404;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    error_page 404 /404/index.html;`;
}

export function serverBlock(options: ServerBlockOptions): string {
  const { slug, upstream, domain, path, defaultLanguage, http3 = true } = options;
  const base = path ?? "/";
  const body = contentBlock(upstream, base, defaultLanguage);

  if (path) {
    // shares an existing domain: one location block to add inside that server {}
    return `# ${slug} — add this inside the server {} of the domain that hosts it
${body}
`;
  }

  const host = domain ?? "docs.example.com";
  const http3Lines = http3
    ? `    listen 443 quic reuseport;
    http3 on;
    add_header Alt-Svc 'h3=":443"; ma=86400';
`
    : "";
  const http3Comment = http3
    ? `# Requires nginx with the QUIC module for HTTP/3 (nginx >= 1.25, \`nginx -V\` lists
# \`--with-http_v3_module\`). Without it, delete the two \`quic\`/\`http3\` lines below: the site
# still works over HTTP/2.
#
# Open UDP/443 in the firewall too — HTTP/3 runs over QUIC, not TCP.
`
    : "";

  return `# ${slug}
${http3Comment}server {
    listen 443 ssl;
${http3Lines}    server_name ${host};

    ssl_certificate     /etc/letsencrypt/live/${host}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${host}/privkey.pem;

${body}
}

server {
    listen 80;
    server_name ${host};
    location / {
        return 301 https://$host$request_uri;
    }
}
`;
}
