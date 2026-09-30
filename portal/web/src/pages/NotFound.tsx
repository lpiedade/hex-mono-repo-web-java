import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";

/**
 * The catch-all. It says the address matched nothing instead of redirecting,
 * because a silent redirect reads as "the link worked and showed the wrong
 * page", and the user never learns the link was stale.
 */
export function NotFound() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <PageHeader
      title={t("notFound.title")}
      subtitle={t("notFound.body", { path: pathname })}
      actions={
        <Button component={RouterLink} to="/" variant="outlined">
          {t("notFound.home")}
        </Button>
      }
    />
  );
}
