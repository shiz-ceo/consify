import { createSearchRoute } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

export const revalidate = false;
export const { GET } = createSearchRoute(docsivi);
