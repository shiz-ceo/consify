import { docsivi } from "docsivi/vite";
import { defineConfig } from "vite";
import config from "./docs.config.ts";

export default defineConfig({ plugins: [docsivi(config)] });
