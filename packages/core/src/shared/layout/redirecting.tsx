/**
 * Page shown in static mode instead of an HTTP redirect (there is no server): a
 * `<meta http-equiv="refresh">` React hoists into `<head>`, plus a plain link as a fallback.
 */
export function Redirecting({ to }: { to: string }) {
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
