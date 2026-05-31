import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
      aria-label={language === "en" ? "Switch to Bangla" : "Switch to English"}
    >
      {language === "en" ? t("lang.switchToBn") : t("lang.switchToEn")}
    </Button>
  );
}
