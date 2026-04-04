import Sidebar from "./sidebar.jsx"
import CharacterSwitchOverlay from "./character-switch-overlay.jsx"
import { useCharacter } from "../context/character-context.jsx"
import "../styles/app-shell.css"

export default function AppShell({ children }) {
  const { isSwitchingCharacter, characterSwitchText } = useCharacter()

  return (
    <div className="app-shell">
      {isSwitchingCharacter && (
        <CharacterSwitchOverlay text={characterSwitchText} />
      )}

      <div className="page">
        <div className="page__inner">
          <div className="app-layout">
            <Sidebar />
            <main className="app-layout__content">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
