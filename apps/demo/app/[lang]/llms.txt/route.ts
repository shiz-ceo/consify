import { createLlmsRoutes } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

const llms = createLlmsRoutes(docsivi);

export const revalidate = false;
export const GET = llms.index;
export const generateStaticParams = llms.generateStaticParams;
