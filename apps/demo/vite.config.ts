import { consify } from "@consify/core/vite";
import { defineConfig } from "vite";
import config from "./docs.config.ts";

export default defineConfig({
  plugins: [consify(config)],
  // docs.config.ts reads DEMO_STATIC (the end-to-end tests build the demo as a static site), and
  // the config runs in the browser too, where there is no `process`
  define: { "process.env.DEMO_STATIC": JSON.stringify(process.env.DEMO_STATIC ?? "") },
});
