import HomeIcon from "@mui/icons-material/Home";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Button, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { browser } from "@/shared/api";
import { useDocumentTitle } from "@/shared/lib";
import { PageHeader } from "@/shared/ui";

/**
 * The two ways out of a screen that failed: reload — which is also what fixes
 * a lazily loaded screen whose chunk a newer deployment has replaced — or go
 * back to the landing page.
 */
function ErrorActions() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
      <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => browser.reload()}>
        {t("routeError.reload")}
      </Button>
      <Button component={RouterLink} to="/" variant="outlined" startIcon={<HomeIcon />}>
        {t("routeError.home")}
      </Button>
    </Stack>
  );
}

/**
 * A screen that failed to render — or whose code failed to load — shown in its
 * place, inside the shell, so the navigation stays in reach.
 *
 * It shows one stable, localized message and never the error itself: a thrown
 * value's message or stack can name internals, and a user can do nothing with
 * either. React Router has already written the error to the console for
 * whoever debugs it. Each route declares this as its `errorElement`
 * (`router.tsx`).
 */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={t("routeError.title")}
      subtitle={t("routeError.body")}
      actions={<ErrorActions />}
    />
  );
}

/**
 * The last resort: the shell itself failed to render, so this stands in for
 * the whole page — its own `main` landmark, its own document title — and
 * depends on nothing the shell provides.
 */
export function RootError() {
  const { t } = useTranslation();
  useDocumentTitle(t("routeError.title"));

  return (
    <Box component="main" sx={{ p: { xs: 2, sm: 3 } }}>
      <RouteError />
    </Box>
  );
}
