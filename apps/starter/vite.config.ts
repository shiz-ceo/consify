import { consify } from "consify/vite";
import { defineConfig } from "vite";
import config from "./docs.config.ts";

export default defineConfig({ plugins: [consify(config)] });
