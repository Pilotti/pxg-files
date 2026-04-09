import { ADMIN_TABS } from "./admin-constants.js"

export default function AdminTabs({ activeTab, onTabChange }) {
  return (
    <div className="admin-page__tabs">
      {ADMIN_TABS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={activeTab === value ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
          onClick={() => onTabChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
