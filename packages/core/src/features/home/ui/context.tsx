import { createContext, useContext } from "react";
import type { Consify } from "../../../shared/instance.ts";

interface HomeContextValue {
  consify: Consify;
  lang: string;
}

const HomeContext = createContext<HomeContextValue | null>(null);

/** Gives `<Hero />` and `<Features />` the site and the language, wherever the home page is built. */
export const HomeProvider = HomeContext.Provider;

export function useHome(): HomeContextValue {
  const value = useContext(HomeContext);
  if (!value) throw new Error("<Hero /> and <Features /> only work on the home page");
  return value;
}
