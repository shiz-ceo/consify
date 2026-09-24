import { createDocsPage } from "docsivi/next";
import { docsivi } from "@/lib/docsivi";

const docsPage = createDocsPage(docsivi);

export default docsPage.Page;
export const generateStaticParams = docsPage.generateStaticParams;
export const generateMetadata = docsPage.generateMetadata;
