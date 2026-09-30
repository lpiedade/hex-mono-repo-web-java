import { Box, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiErrorBanner, KeyValueList, PageHeader, SectionCard } from "@/shared/ui";
import { buildQueries } from "../api/buildQueries";
import { display, NA } from "../lib/buildInfo";
import { BuiltAt } from "./BuiltAt";

/**
 * Which build of each deliverable is deployed.
 *
 * The portal (BFF plus this bundle) and the application API are deployed
 * separately and can disagree, which is the first thing worth checking when a
 * screen and an endpoint disagree about a field. Each card reports its own
 * failure, so an API that is down does not hide the portal's answer.
 */
export function BuildPage() {
  const { t, i18n } = useTranslation();
  const bffQuery = useQuery(buildQueries.bff());
  const apiQuery = useQuery(buildQueries.api());

  const loading = bffQuery.isLoading || apiQuery.isLoading;

  return (
    <>
      <PageHeader
        title={t("about.title")}
        subtitle={t("about.subtitle")}
        state={loading ? "loading" : "ready"}
      />

      <Stack gap={2}>
        <SectionCard title={t("about.portal")}>
          {bffQuery.isError ? (
            <Box sx={{ mb: 2 }}>
              <ApiErrorBanner error={bffQuery.error} />
            </Box>
          ) : null}
          <KeyValueList
            items={[
              { key: t("about.version"), value: display(bffQuery.data?.build.version) },
              { key: t("about.commit"), value: display(bffQuery.data?.build.commit) },
              {
                key: t("about.builtAt"),
                value: <BuiltAt iso={bffQuery.data?.build.builtAt} locale={i18n.language} />,
              },
              {
                key: t("about.portalApiVersion"),
                value: bffQuery.data ? String(bffQuery.data.portalApiVersion) : NA,
              },
              { key: t("about.bundleCommit"), value: display(import.meta.env.VITE_GIT_COMMIT) },
              {
                key: t("about.bundleBuiltAt"),
                value: <BuiltAt iso={import.meta.env.VITE_BUILD_TIME} locale={i18n.language} />,
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={t("about.api")}>
          {apiQuery.isError ? (
            <Box sx={{ mb: 2 }}>
              <ApiErrorBanner error={apiQuery.error} />
            </Box>
          ) : null}
          <KeyValueList
            items={[
              { key: t("about.version"), value: display(apiQuery.data?.build.version) },
              { key: t("about.commit"), value: display(apiQuery.data?.build.commit) },
              {
                key: t("about.builtAt"),
                value: <BuiltAt iso={apiQuery.data?.build.builtAt} locale={i18n.language} />,
              },
            ]}
          />
        </SectionCard>
      </Stack>
    </>
  );
}
