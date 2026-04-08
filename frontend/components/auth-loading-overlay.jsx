import StatusOverlay from "./status-overlay.jsx"

export default function AuthLoadingOverlay({ text = "Carregando sua conta..." }) {
  return (
    <StatusOverlay
      fullscreen
      surface="default"
      title="Aguarde um instante"
      text={text}
    />
  )
}
