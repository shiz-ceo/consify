/**
 * Thrown by registry code (and available to any command) for an expected, user-facing failure
 * (bad specifier, 404, auth missing, schema validation failed, etc.) — caught at the top of each
 * action handler and printed as a plain error line + exit 1, instead of a stack trace.
 */
export class CliError extends Error {}

/**
 * Wraps an action body: prints `error.message` and returns exit code 1 for a `CliError`, re-throws
 * anything else (a real bug should still produce a stack trace, not be swallowed).
 */
export async function runAction(body: () => Promise<number>): Promise<number> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}
