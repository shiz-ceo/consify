import { consify } from "../router.ts";

/**
 * Page shown in static mode instead of an HTTP redirect (there is no server): a
 * `<meta http-equiv="refresh">` React hoists into `<head>`, plus a plain link as a fallback.
 * Unlike a router redirect, a meta refresh is not given the deploy `basePath`, so it is added here.
 */
export function Redirecting({ to: target }: { to: string }) {
  const to = target.startsWith("/") ? `${consify.config.deploy.basePath ?? ""}${target}` : target;
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${to}`} />
      <link rel="canonical" href={to} />
      <p className="p-8 text-center">
        Redirecting to <a href={to}>{to}</a>…
      </p>
    </>
  );
}
