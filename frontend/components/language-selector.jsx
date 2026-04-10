import { useI18n } from "@/context/i18n-context.jsx"

export default function LanguageSelector({ className = "" }) {
  const { language, options, setLanguage, t } = useI18n()

  return (
    <label className={`language-selector ${className}`.trim()}>
      <span className="language-selector__label">{t("common.language")}</span>
      <select
        className="language-selector__select"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t("common.language")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
