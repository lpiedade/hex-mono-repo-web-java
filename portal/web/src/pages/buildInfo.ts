/** What the build page prints for a coordinate it does not have. */
export const NA = "—";

/**
 * `unknown` is a value a server really sends when its build had no git
 * metadata. It is never printed: a commit rendered as the word "unknown" reads
 * as a commit named unknown, on the one page whose job is to say which code is
 * running.
 */
export function display(value: string | undefined): string {
  return value && value !== "unknown" ? value : NA;
}
