const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const frameIntervalMs = 80;

export interface Spinner {
  /** Updates the message without restarting the animation. */
  update(message: string): void;
  /** Stops the spinner, clears its line, and prints `finalMessage` (a checkmark line) if given. */
  succeed(finalMessage?: string): void;
  /** Stops the spinner, clears its line, and prints `finalMessage` (an X line) if given. */
  fail(finalMessage?: string): void;
}

/** Starts a spinner with `message`. No-op animation (prints one static line) outside a real TTY. */
export function spinner(message: string): Spinner {
  const animated = process.stdout.isTTY === true && !process.env.NO_COLOR;
  if (!animated) {
    console.log(message);
    return {
      update: (m) => console.log(m),
      succeed: (m) => console.log(m ?? message),
      fail: (m) => console.log(m ?? message),
    };
  }
  let current = message;
  let frame = 0;
  const render = () => {
    process.stdout.write(`\r${frames[frame % frames.length]} ${current}`);
    frame++;
  };
  render();
  const timer = setInterval(render, frameIntervalMs);
  const stop = (symbol: string, finalMessage?: string) => {
    clearInterval(timer);
    process.stdout.write(`\r\x1b[K${symbol} ${finalMessage ?? current}\n`); // \x1b[K clears the line
  };
  return {
    update: (m) => {
      current = m;
    },
    succeed: (m) => stop("\x1b[32m✓\x1b[0m", m),
    fail: (m) => stop("\x1b[31m✗\x1b[0m", m),
  };
}
