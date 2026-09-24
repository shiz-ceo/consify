import { blog } from "docsivi:blog";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "takumi-js/response";
import { docsivi, requireLang } from "../../../shared/router.ts";
import { formatDate } from "../ui/post-parts.tsx";

const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** The cover of a post as a data URI, read from `public/`. External URLs are not fetched. */
async function coverDataUri(cover: string | undefined): Promise<string | undefined> {
  if (!cover?.startsWith("/")) return undefined;
  const type = mimeTypes[cover.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return undefined;
  try {
    const bytes = await readFile(join(process.cwd(), "public", cover));
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function hue(text: string): number {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h % 360;
}

/**
 * `/{lang}/blog/{slug}/og.png`: the image for social networks. It uses the cover of the post as its
 * background (a gradient when there is none) with the title and the date on top.
 */
export async function loader({ params }: { params: Record<string, string | undefined> }) {
  const lang = requireLang(params);
  const { config } = docsivi;
  const found = config.blog && blog && params.slug ? await blog.post(params.slug, lang) : undefined;
  if (!found) throw new Response("Not found", { status: 404 });
  const { post } = found;

  const image = await coverDataUri(post.cover);
  const h = hue(post.slug);
  const background = image
    ? undefined
    : `linear-gradient(135deg, hsl(${h} 55% 18%), hsl(${(h + 55) % 360} 65% 38%))`;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        color: "white",
        backgroundColor: "#0f0f0f",
        ...(background ? { backgroundImage: background } : {}),
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          padding: "64px",
          gap: "20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "68px", fontWeight: 800, lineHeight: 1.1 }}>
          {post.title}
        </p>
        <p style={{ margin: 0, fontSize: "30px", color: "rgba(255,255,255,0.8)" }}>
          {config.site.name} · {formatDate(post.date, lang)}
        </p>
      </div>
    </div>,
    { width: 1200, height: 630, format: "png" },
  );
}
