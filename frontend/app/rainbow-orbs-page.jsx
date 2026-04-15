import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import "../styles/rainbow-orbs-page.css"

export default function RainbowOrbsPage() {
  return (
    <AppShell>
      <Topbar />
      <section className="rainbow-orbs-page">
        <div className="rainbow-orbs-page__map-stage" />
      </section>
    </AppShell>
  )
}
