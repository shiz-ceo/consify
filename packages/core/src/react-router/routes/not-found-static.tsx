import { NotFound } from "../not-found-view.tsx";

/** Static mode: there is no server to send a 404 status, and a `loader` is not allowed on a route that is not pre-rendered. */
export default function NotFoundStaticRoute() {
  return <NotFound />;
}
