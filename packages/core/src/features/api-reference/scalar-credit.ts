/**
 * Removes the "Powered by Scalar" link from the sidebar of the Scalar API reference. Scalar is MIT
 * licensed, which does not ask for a credit in the interface.
 *
 * The link exists in two places, and both have to go: `ApiReference.vue` (in `@scalar/api-reference`)
 * puts it into the `description` slot of the sidebar footer, and `ScalarSidebarFooter.vue` (in
 * `@scalar/components`) renders the same link when that slot is empty. Emptying them removes the
 * element itself, not just its visibility. The code is matched by shape, and the pinned Scalar
 * version is known to match; if a newer version changes it, the plugin warns (the CSS in
 * `scalar.css` still hides the label in that case).
 */

interface Removal {
  /** File the code lives in. */
  module: RegExp;
  /** The code to replace and what to put there. */
  find: RegExp;
  replace: string;
}

export const removals: readonly Removal[] = [
  {
    module: /@scalar\/api-reference\/dist\/components\/ApiReference\.vue\.script\.js$/,
    find: /description:\s*withCtx\(\(\)\s*=>\s*\[\s*createElementVNode\(\s*"a"\s*,\s*_hoisted_\d+\s*,\s*toDisplayString\(\s*unref\(\s*apiReferenceLocalization\s*\)\.translate\(\s*"footer\.poweredByScalar"\s*\)\s*\)\s*,\s*1\s*\)\s*\]\s*\)/g,
    replace: "description: withCtx(() => [])",
  },
  {
    module:
      /@scalar\/components\/dist\/components\/ScalarSidebar\/ScalarSidebarFooter\.vue\.script\.js$/,
    find: /\(\)\s*=>\s*\[\s*_cache\[0\]\s*\|\|\s*\(_cache\[0\]\s*=\s*createElementVNode\(\s*"a"\s*,\s*\{[^}]*scalar\.com[^}]*\}\s*,\s*"\s*Powered by Scalar\s*"\s*,\s*-1\s*\)\s*\)\s*\]/g,
    replace: "() => []",
  },
];

export function stripScalarCredit(
  code: string,
  removal: Removal,
): { code: string; changed: boolean } {
  const next = code.replace(removal.find, removal.replace);
  return { code: next, changed: next !== code };
}

/** A plugin for Vite and for the Rolldown dependency pre-bundling of Vite (same hook shape). */
export function scalarCreditPlugin() {
  return {
    name: "docsivi:no-scalar-credit",
    transform(this: { warn(message: string): void }, code: string, id: string) {
      const path = (id.split("?")[0] ?? id).split("\\").join("/");
      const removal = removals.find((r) => r.module.test(path));
      if (!removal) return null;
      const result = stripScalarCredit(code, removal);
      if (!result.changed) {
        this.warn(
          `docsivi: could not remove 'Powered by Scalar' from ${path.split("/").pop()}, the code of Scalar has changed. It stays hidden by CSS.`,
        );
        return null;
      }
      return { code: result.code, map: null };
    },
  };
}
