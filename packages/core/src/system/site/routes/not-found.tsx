import { NotFound } from "../../../shared/layout/not-found-view.tsx";

/** Unknown URLs: the page is shown by the root error boundary, so the response is a real 404. */
export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export default function NotFoundRoute() {
  return <NotFound />;
}
