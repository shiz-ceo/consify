// Required by Next.js for static export (harmless in server mode).
export const dynamic = "force-static";

import { createSitemap } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

export default createSitemap(docsivi);
