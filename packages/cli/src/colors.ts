/**
 * Minimal ANSI coloring for CLI output — no dependency, just the codes `consify` actually uses.
 * Respects `NO_COLOR` (https://no-color.org) and only colors when stdout is a real terminal.
 */

const enabled = !process.env.NO_COLOR && process.stdout.isTTY === true;

function wrap(code: number): (text: string) => string {
  return (text) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);
}

export const color = {
  green: wrap(32),
  red: wrap(31),
  yellow: wrap(33),
  cyan: wrap(36),
  dim: wrap(2),
  bold: wrap(1),
};
