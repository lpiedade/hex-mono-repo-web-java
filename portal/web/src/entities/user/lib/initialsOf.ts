/**
 * Two-letter avatar initials derived from a subject, uppercased: the first
 * letters of its first two words (split on spaces, dots, underscores, `@` and
 * dashes), or its first two characters when it is one word.
 */
export function initialsOf(subject: string | undefined): string {
  if (!subject) return "··";
  const parts = subject
    .trim()
    .split(/[\s._@-]+/)
    .filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : subject.slice(0, 2);
  return letters.toUpperCase();
}
