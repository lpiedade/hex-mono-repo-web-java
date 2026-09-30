import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import { APP_BASE_PATH } from "./api/auth";
import { isReportedInline, logFailure, reportError } from "./api/errorReporting";
import { GlobalErrorSnackbar } from "./components/GlobalErrorSnackbar";
import { AppRouter } from "./router";
import { buildTheme } from "./theme";

/**
 * No request failure is silent (ADR-012).
 *
 * A factory rather than a module-level literal so `errorReporting.test.tsx`
 * exercises *this* wiring instead of a copy of it — a test that rebuilt the
 * caches itself would keep passing after someone removed them from here.
 *
 * Both caches report; only one of them shows anything, and the asymmetry is the
 * point:
 *
 * - A **mutation** is what the user just asked for, and the thing no screen
 *   renders reliably. So a failure is shown as well as logged, and a screen that
 *   renders it itself opts out with `meta: REPORTED_INLINE` to keep one failure
 *   to one visible report.
 * - A **query** is logged only: every screen renders its read failure as a page
 *   state, so a snackbar beside it would be a double report.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        reportError(error, "mutation", {
          reportedInline: isReportedInline(mutation.options.meta),
        });
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        logFailure(error, "query");
      },
    }),
  });
}

const queryClient = createQueryClient();

/** The OS preference decides the first render; the top bar toggles it after. */
function preferredColorMode(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [colorMode, setColorMode] = useState<"light" | "dark">(preferredColorMode);
  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  function toggleColorMode() {
    setColorMode((prev) => (prev === "light" ? "dark" : "light"));
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={APP_BASE_PATH}>
          <AppRouter colorMode={colorMode} onToggleColorMode={toggleColorMode} />
        </BrowserRouter>
        {/* Outside the router: a failure must still be reported on a route that
            itself failed to render. */}
        <GlobalErrorSnackbar />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
