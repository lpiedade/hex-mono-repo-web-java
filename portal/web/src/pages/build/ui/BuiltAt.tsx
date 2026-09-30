import { Box } from "@mui/material";
import { display, NA } from "../lib/buildInfo";

/**
 * A build timestamp, in the reader's locale and the browser's zone, with the
 * zone printed so two readers in different zones do not read one build as two.
 * The `<time datetime>` keeps the instant as it arrived, and an unparseable
 * value prints as it arrived rather than as "Invalid Date".
 */
export function BuiltAt({ iso, locale }: { iso: string | undefined; locale: string }) {
  const raw = display(iso);
  if (raw === NA) return <>{NA}</>;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return <>{raw}</>;

  return (
    <Box component="time" dateTime={raw}>
      {parsed.toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })}
    </Box>
  );
}
