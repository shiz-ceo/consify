import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";

export default defineConfig({
  site: { name: "My Docs", description: "Documentation site built with consify" },
  i18n: { defaultLanguage: "en", languages: ["en"] },
  features: [docs()],
});
