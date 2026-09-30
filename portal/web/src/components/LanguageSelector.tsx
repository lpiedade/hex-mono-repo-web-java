import LanguageIcon from "@mui/icons-material/Language";
import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  persistLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../i18n";

// Language names are shown as autonyms (each in its own language) so a user can
// always find their language regardless of the active locale. Autonyms do not
// change per active locale, so they are a static map here rather than bundle
// entries.
const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "en-US": "English",
  "pt-BR": "Português (Brasil)",
};

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const current: SupportedLocale = isSupportedLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE;

  function handleSelect(locale: SupportedLocale) {
    void i18n.changeLanguage(locale);
    persistLocale(locale);
    setAnchorEl(null);
  }

  return (
    <>
      <Tooltip title={t("language.select")}>
        <IconButton
          color="inherit"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={t("language.select")}
          aria-haspopup="menu"
        >
          <LanguageIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        {SUPPORTED_LOCALES.map((locale) => (
          <MenuItem
            key={locale}
            lang={locale}
            selected={locale === current}
            onClick={() => handleSelect(locale)}
          >
            <ListItemText>{LOCALE_LABELS[locale]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
