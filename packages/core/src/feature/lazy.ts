import { type ComponentType, type LazyExoticComponent, lazy } from "react";

type AnyComponent = ComponentType<any>;

/**
 * Components of a module that is loaded when one of them is first drawn. For the MDX components of
 * a package: its `index.ts` is read by Node with `docs.config.ts`, so it must not import the
 * components (JSX, stylesheets) itself.
 *
 * @example
 * components: lazyComponents(() => import("./mdx.tsx"), ["Authors", "Figure"]),
 */
export function lazyComponents<const Name extends string>(
  load: () => Promise<Record<Name, AnyComponent>>,
  names: readonly Name[],
): Record<Name, LazyExoticComponent<AnyComponent>> {
  let module: ReturnType<typeof load> | undefined;
  const once = () => {
    module ??= load();
    return module;
  };
  const components = {} as Record<Name, LazyExoticComponent<AnyComponent>>;
  for (const name of names) {
    components[name] = lazy(() => once().then((m) => ({ default: m[name] })));
  }
  return components;
}
