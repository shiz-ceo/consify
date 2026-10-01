import * as Twoslash from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Banner } from "fumadocs-ui/components/banner";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Badge } from "./badge.tsx";
import { CodeHtml } from "./code-html.tsx";
import { Features, Hero } from "./home-parts.tsx";
import { MdxImage, MdxVideo } from "./media.tsx";
import { Mermaid } from "./mermaid.tsx";
import { SiteLink } from "./site-link.tsx";
import { TwoslashPopups } from "./twoslash-popups.tsx";
import { Video } from "./video.tsx";

/** Components available in every `.mdx` file without imports. */
export const builtinComponents = {
  ...defaultMdxComponents,
  ...Twoslash,
  // `/docs` and other addresses of the site get the language of the page
  a: SiteLink,
  img: MdxImage,
  video: MdxVideo,
  Accordion,
  Accordions,
  Badge,
  Banner,
  CodeHtml,
  Features,
  File,
  Files,
  Folder,
  Hero,
  Mermaid,
  Step,
  Steps,
  Tab,
  Tabs,
  TwoslashPopups,
  TypeTable,
  Video,
} satisfies MDXComponents;
