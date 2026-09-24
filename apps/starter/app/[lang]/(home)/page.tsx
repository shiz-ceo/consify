import { createHomeMetadata, createHomePage } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

export default createHomePage(docsivi);
export const generateMetadata = createHomeMetadata(docsivi);
