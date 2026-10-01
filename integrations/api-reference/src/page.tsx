import type { PageProps } from "@consify/core";
import { lazy, Suspense, useEffect, useState } from "react";
import type { ApiSource } from "./index.ts";

// Scalar needs the browser: it is loaded after mount
const ScalarReference = lazy(() => import("./scalar.tsx"));

/** The page of an API reference: Scalar, which needs the browser, so it is drawn after mount. */
export default function ApiPage({ data }: PageProps<ApiSource>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="consify-api flex min-h-[70vh] flex-1 flex-col">
      {mounted ? (
        <Suspense fallback={null}>
          <ScalarReference source={data} />
        </Suspense>
      ) : null}
    </div>
  );
}
