import { useNavigate } from "@/lib/react-router-compat"
import { useAuth } from "../context/auth-context.jsx"
import "../styles/topbar.css"

export default function Topbar() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <header className="topbar">
      <div className="topbar__content">
        <div className="topbar__left">
          <div className="topbar__brand">
            <span className="topbar__brand-icon" aria-hidden="true">⚙</span>
            <span className="topbar__brand-name">PXG Files</span>
          </div>
        </div>

        <div className="topbar__right">
          <button
            type="button"
            className="topbar__icon-button"
            onClick={() => navigate("/configuracoes")}
            aria-label="Abrir configurações"
            title="Configurações"
          >
            <span className="topbar__icon-button-symbol" aria-hidden="true">⚙</span>
          </button>

          <button
            type="button"
            className="topbar__button topbar__button--ghost"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
