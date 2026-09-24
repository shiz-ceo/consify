import "../global.css";
import { createLangParams, createRootLayout } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

export default createRootLayout(docsivi);
export const generateStaticParams = createLangParams(docsivi);
