import { describe, expect, test } from "bun:test";
import { removals, stripScalarCredit } from "../src/vite/scalar-credit.ts";

const [apiReference, footer] = removals as [(typeof removals)[number], (typeof removals)[number]];

// The relevant part of @scalar/api-reference ApiReference.vue.script.js (pinned version).
const apiReferenceSource = `footer: withCtx(() => [renderSlot(_ctx.$slots, "sidebar-end", normalizeProps(guardReactiveProps(slotProps.value)), () => [createVNode(unref(ScalarSidebarFooter), { class: "darklight-reference" }, {
								description: withCtx(() => [createElementVNode("a", _hoisted_3, toDisplayString(unref(apiReferenceLocalization).translate("footer.poweredByScalar")), 1)]),
								toggle: withCtx(() => [!mergedConfig.value.hideDarkModeToggle ? 1 : 2]),
								default: withCtx(() => [createVNode(unref(OpenApiClientButton), { key: 0 })]),
								_: 1
							})])])`;

// The relevant part of @scalar/components ScalarSidebarFooter.vue.script.js (pinned version).
const footerSource = `[renderSlot(_ctx.$slots, "default"), createElementVNode("div", _hoisted_1, [createElementVNode("div", _hoisted_2, [renderSlot(_ctx.$slots, "description", {}, () => [_cache[0] || (_cache[0] = createElementVNode("a", {
				class: "no-underline hover:underline",
				href: "https://www.scalar.com",
				target: "_blank"
			}, " Powered by Scalar ", -1))])]), renderSlot(_ctx.$slots, "toggle", {}, () => [createVNode(unref(ScalarColorModeToggle_default))])])]`;

describe("api-reference: the description slot", () => {
  test("is emptied, the rest of the footer stays", () => {
    const result = stripScalarCredit(apiReferenceSource, apiReference);
    expect(result.changed).toBe(true);
    expect(result.code).not.toContain("poweredByScalar");
    expect(result.code).toContain("description: withCtx(() => [])");
    expect(result.code).toContain("toggle: withCtx");
    expect(result.code).toContain("OpenApiClientButton");
  });

  test("every occurrence is replaced (OpenAPI and AsyncAPI sidebars)", () => {
    const result = stripScalarCredit(`${apiReferenceSource}\n${apiReferenceSource}`, apiReference);
    expect(result.code.match(/description: withCtx\(\(\) => \[\]\)/g)?.length).toBe(2);
  });

  test("its module is matched, similar names are not", () => {
    const dir = "/n/@scalar/api-reference/dist/components";
    expect(apiReference.module.test(`${dir}/ApiReference.vue.script.js`)).toBe(true);
    expect(apiReference.module.test(`${dir}/ApiReferenceOther.vue.script.js`)).toBe(false);
  });
});

describe("components: the footer fallback", () => {
  test("is replaced, so an empty slot renders nothing", () => {
    const result = stripScalarCredit(footerSource, footer);
    expect(result.changed).toBe(true);
    expect(result.code).not.toContain("Powered by Scalar");
    expect(result.code).toContain('renderSlot(_ctx.$slots, "description", {}, () => [])');
    expect(result.code).toContain('renderSlot(_ctx.$slots, "toggle"');
  });

  test("its module is matched", () => {
    const path =
      "/n/@scalar/components/dist/components/ScalarSidebar/ScalarSidebarFooter.vue.script.js";
    expect(footer.module.test(path)).toBe(true);
  });
});

test("code of another shape is reported as unchanged", () => {
  const other = "const a = 1;";
  expect(stripScalarCredit(other, apiReference)).toEqual({ code: other, changed: false });
  expect(stripScalarCredit(other, footer)).toEqual({ code: other, changed: false });
});
