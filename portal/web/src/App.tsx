import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import { GlobalErrorSnackbar } from "./components/GlobalErrorSnackbar";
import { ContentFallback } from "./layout/ContentFallback";
import { createQueryClient } from "./queryClient";
import { appRouter, type AppRouter } from "./router";
import { ColorModeProvider } from "./theme/ColorModeProvider";

const queryClient = createQueryClient();

interface AppProps {
  /**
   * Test seam: a memory router over the same `routes`, so a suite exercises
   * this composition rather than a copy of it. Omitted, the browser router.
   */
  router?: AppRouter;
}

export function App({ router }: AppProps) {
  return (
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router ?? appRouter()} fallbackElement={<ContentFallback />} />
        {/* Beside the router, not inside it: a screen that fails to render is
            replaced by its route's error element, and failures keep being
            reported while it is on screen. */}
        <GlobalErrorSnackbar />
      </QueryClientProvider>
    </ColorModeProvider>
  );
}
