import type { Feature } from "../shared/feature.ts";
import { search } from "./search/feature.ts";
import { seo } from "./seo/feature.ts";
import { site } from "./site/feature.ts";

/**
 * The parts every site has, whatever the config says: the language redirect and the 404 page
 * (`site`), search, sitemap and robots (`seo`). They are not sections and have no link in the
 * navigation, but they are described the same way as a feature.
 */
export const system: readonly Feature[] = [site, search, seo];
