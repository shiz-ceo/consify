// <ApiEndpoint method="POST" path="/v2/jobs" /> renders an HTTP method badge with a path.
const colors: Record<string, string> = {
  GET: "bg-fd-info/15 text-fd-info",
  POST: "bg-fd-success/15 text-fd-success",
  PUT: "bg-fd-warning/15 text-fd-warning",
  DELETE: "bg-fd-error/15 text-fd-error",
};

export default function ApiEndpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="my-4 flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-3 py-2 font-mono text-sm">
      <span className={`rounded px-2 py-0.5 text-xs font-bold ${colors[method] ?? ""}`}>
        {method}
      </span>
      <span>{path}</span>
    </div>
  );
}
