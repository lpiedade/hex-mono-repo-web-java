import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

/**
 * The landing page. It fetches nothing, so it renders the same whether or not
 * the API answers — a starting point, not a dashboard. Replace it with the
 * project's own overview once there is something to summarize.
 */
export function Home() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("home.title")} subtitle={t("home.subtitle")} />
      <SectionCard title={t("home.items.title")}>
        <Stack gap={2} alignItems="flex-start">
          <Typography color="text.secondary">{t("home.items.body")}</Typography>
          <Button
            component={RouterLink}
            to="/items"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
          >
            {t("home.items.cta")}
          </Button>
        </Stack>
      </SectionCard>
    </>
  );
}
