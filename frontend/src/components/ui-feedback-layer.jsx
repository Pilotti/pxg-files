import { useEffect } from "react"
import AppToast from "./app-toast.jsx"
import StatusOverlay from "./status-overlay.jsx"
import { useUI } from "../context/ui-context.jsx"

export default function UIFeedbackLayer() {
  const {
    toasts,
    dismissToast,
    currentBlockingLoader,
    clearToasts,
  } = useUI()

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== "Escape") {
        return
      }

      if (currentBlockingLoader) {
        return
      }

      if (toasts.length > 0) {
        dismissToast(toasts[toasts.length - 1].id)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [currentBlockingLoader, dismissToast, toasts])

  useEffect(() => {
    if (!currentBlockingLoader?.fullscreen) {
      document.body.classList.remove("ui-feedback-lock")
      return
    }

    document.body.classList.add("ui-feedback-lock")

    return () => {
      document.body.classList.remove("ui-feedback-lock")
    }
  }, [currentBlockingLoader])

  useEffect(() => {
    return () => {
      clearToasts()
      document.body.classList.remove("ui-feedback-lock")
    }
  }, [clearToasts])

  return (
    <>
      {currentBlockingLoader ? (
        <StatusOverlay
          title={currentBlockingLoader.title}
          text={currentBlockingLoader.text}
          fullscreen={currentBlockingLoader.fullscreen}
          surface={currentBlockingLoader.surface}
        />
      ) : null}

      {toasts.length > 0 ? (
        <div className="app-toast-region" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <AppToast
              key={toast.id}
              toast={toast}
              onClose={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
