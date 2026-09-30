import { Box, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiAbout, getBffAbout } from "../api/client";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { KeyValueList } from "../components/KeyValueList";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

const NA = "—";

/**
 * `unknown` is a value a server really sends when its build had no git
 * metadata. It is never printed: a commit rendered as the word "unknown" reads
 * as a commit named unknown, on the one page whose job is to say which code is
 * running.
 */
export function display(value: string | undefined): string {
  return value && value !== "unknown" ? value : NA;
}

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

/**
 * Which build of each deliverable is deployed.
 *
 * The portal (BFF plus this bundle) and the application API are deployed
 * separately and can disagree, which is the first thing worth checking when a
 * screen and an endpoint disagree about a field. Each card reports its own
 * failure, so an API that is down does not hide the portal's answer.
 */
export function About() {
  const { t, i18n } = useTranslation();
  const bffQuery = useQuery({ queryKey: ["about", "bff"], queryFn: getBffAbout });
  const apiQuery = useQuery({ queryKey: ["about", "api"], queryFn: getApiAbout });

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
