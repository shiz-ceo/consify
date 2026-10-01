import type { Locale } from "./define.ts";
import { coreMessages, en } from "./en.ts";
import { ru } from "./ru.ts";

export { defineLocale, type Locale, type UiKey } from "./define.ts";

/** The languages that ship with consify. The others come from `custom/locales`. */
export const builtinLocales: Readonly<Record<string, Locale>> = { en, ru };

/** Keys of the strings of consify itself. */
export const coreMessageKeys = Object.keys(coreMessages) as readonly CoreMessageKey[];
export type CoreMessageKey = keyof typeof coreMessages;
