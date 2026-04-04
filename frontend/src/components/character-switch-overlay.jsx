import StatusOverlay from "./status-overlay.jsx"

export default function CharacterSwitchOverlay({
  text = "Trocando de personagem..."
}) {
  return (
    <StatusOverlay
      fullscreen
      surface="default"
      title="Aguarde um instante"
      text={text}
    />
  )
}
