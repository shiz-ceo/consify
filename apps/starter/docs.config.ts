import { defineConfig } from "docsivi";
import { externalLinks } from "./custom/plugins/external-links";

export default defineConfig({
  site: {
    name: "Docsivi Starter",
    description: "Documentation site starter",
    url: "https://docs.example.com",
    github: { repo: "example/docsivi-starter" },
  },
  i18n: {
    defaultLanguage: "en",
    languages: ["en", "ru"],
    labels: { en: "English", ru: "Русский" },
  },
  versions: {
    list: [
      { id: "v2", label: "v2 (latest)", status: "latest" },
      { id: "v1", label: "v1", status: "deprecated" },
    ],
  },
  plugins: [externalLinks],
  // deploy: { mode: "static" }, // static export for any static host (see TASKS.md, stage 14)
});
