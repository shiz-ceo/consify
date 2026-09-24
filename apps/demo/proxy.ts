import { createProxy } from "docsivi/next";
import docsConfig from "./docs.config";

export default createProxy(docsConfig);

// Next.js reads this statically, so it must be a literal (it cannot be re-exported).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
