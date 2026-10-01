import { defineLocale } from "./define.ts";

/** The strings of consify itself in English: the ones every other language falls back to. */
export const coreMessages = {
  notFound: "This page could not be found.",
  backToHome: "Back to the home page",
  footerSections: "Explore",
  footerRights: "All rights reserved.",
  notTranslated: "This page has not been translated yet. The {language} version is shown.",
  openOriginal: "Open the {language} address",
  llmsHint: "The pages as text for AI agents",
  rssHint: "Follow in a feed reader",
} as const;

export const en = defineLocale({ label: "English", messages: coreMessages });
