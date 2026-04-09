import AdminTabs from "./admin-tabs.jsx"

export default function AdminShell({ adminName, activeTab, onTabChange, onLogout, children }) {
  return (
    <div className="admin-page">
      <div className="admin-page__backdrop" />

      <div className="admin-page__shell">
        <header className="admin-page__topbar">
          <div className="admin-page__topbar-main">
            <span className="admin-page__eyebrow">Admin</span>
            <h1 className="admin-page__title">Painel administrativo</h1>
            <p className="admin-page__subtitle">
              Gerencie apenas o que ainda existe no produto: templates, itens OCR, catalogos e permissoes do sistema.
            </p>
          </div>

          <div className="admin-page__topbar-actions">
            <span className="admin-page__admin-badge">{adminName || "admin"}</span>
            <button type="button" className="admin-page__ghost-button" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        <AdminTabs activeTab={activeTab} onTabChange={onTabChange} />
        {children}
      </div>
    </div>
  )
}
