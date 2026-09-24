import { createOgRoute } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

const og = createOgRoute(docsivi);

export const revalidate = false;
export const GET = og.GET;
export const generateStaticParams = og.generateStaticParams;
