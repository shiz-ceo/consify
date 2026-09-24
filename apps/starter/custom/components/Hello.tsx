// Example custom component: file name = tag name, default export = component.
// Use it in any .mdx file as <Hello name="docs" /> without importing it.
export default function Hello({ name = "world" }: { name?: string }) {
  return <p className="custom-hello">Hello, {name}! (from custom/components/Hello.tsx)</p>;
}
