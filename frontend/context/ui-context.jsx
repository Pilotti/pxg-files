import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

const UIContext = createContext(null)
const MAX_TOASTS = 4
const DEFAULT_TOAST_DURATION = 3200
const ERROR_TOAST_DURATION = 4400
const WARNING_TOAST_DURATION = 3800

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeToast(options = {}) {
  const type = ["success", "error", "warning", "info"].includes(options.type)
    ? options.type
    : "info"

  const fallbackDuration = type === "error"
    ? ERROR_TOAST_DURATION
    : type === "warning"
      ? WARNING_TOAST_DURATION
      : DEFAULT_TOAST_DURATION

  return {
    id: options.id || createId("toast"),
    type,
    title: options.title || (
      type === "success"
        ? "Sucesso"
        : type === "error"
          ? "Erro"
          : type === "warning"
            ? "Atenção"
            : "Informação"
    ),
    message: options.message || "",
    duration: typeof options.duration === "number" ? options.duration : fallbackDuration,
  }
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [blockingLoaders, setBlockingLoaders] = useState([])
  const toastTimeoutsRef = useRef(new Map())
  const loaderMetaRef = useRef(new Map())

  const dismissToast = useCallback((toastId) => {
    const timeoutId = toastTimeoutsRef.current.get(toastId)

    if (timeoutId) {
      clearTimeout(timeoutId)
      toastTimeoutsRef.current.delete(toastId)
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const clearToasts = useCallback(() => {
    toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
    toastTimeoutsRef.current.clear()
    setToasts([])
  }, [])

  const showToast = useCallback((options) => {
    const nextToast = normalizeToast(options)

    setToasts((current) => {
      const withoutSameId = current.filter((toast) => toast.id !== nextToast.id)
      const deduped = withoutSameId.filter(
        (toast) => !(toast.type === nextToast.type && toast.message === nextToast.message && toast.title === nextToast.title)
      )
      return [...deduped.slice(-(MAX_TOASTS - 1)), nextToast]
    })

    const existingTimeout = toastTimeoutsRef.current.get(nextToast.id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    if (nextToast.duration > 0) {
      const timeoutId = setTimeout(() => {
        dismissToast(nextToast.id)
      }, nextToast.duration)

      toastTimeoutsRef.current.set(nextToast.id, timeoutId)
    }

    return nextToast.id
  }, [dismissToast])

  const showSuccess = useCallback((message, options = {}) => {
    return showToast({ ...options, type: "success", message })
  }, [showToast])

  const showError = useCallback((message, options = {}) => {
    return showToast({ ...options, type: "error", message })
  }, [showToast])

  const showInfo = useCallback((message, options = {}) => {
    return showToast({ ...options, type: "info", message })
  }, [showToast])

  const showWarning = useCallback((message, options = {}) => {
    return showToast({ ...options, type: "warning", message })
  }, [showToast])

  const showApiError = useCallback((error, fallbackMessage = "Ocorreu um erro inesperado.", options = {}) => {
    const message = error?.message || fallbackMessage
    return showError(message, options)
  }, [showError])

  const showBlockingLoader = useCallback((options = {}) => {
    const id = options.id || createId("loader")
    const loader = {
      id,
      title: options.title || "Aguarde um instante",
      text: options.text || "Carregando...",
      surface: options.surface || "default",
      fullscreen: options.fullscreen !== false,
      minDuration: typeof options.minDuration === "number" ? options.minDuration : 0,
    }

    loaderMetaRef.current.set(id, {
      shownAt: Date.now(),
      minDuration: loader.minDuration,
    })

    setBlockingLoaders((current) => {
      const filtered = current.filter((item) => item.id !== id)
      return [...filtered, loader]
    })

    return id
  }, [])

  const hideBlockingLoader = useCallback(async (loaderId) => {
    const meta = loaderMetaRef.current.get(loaderId)

    if (meta) {
      const elapsed = Date.now() - meta.shownAt
      const remaining = Math.max(0, meta.minDuration - elapsed)

      if (remaining > 0) {
        await wait(remaining)
      }
    }

    loaderMetaRef.current.delete(loaderId)
    setBlockingLoaders((current) => current.filter((loader) => loader.id !== loaderId))
  }, [])

  const runBlockingTask = useCallback(async (task, options = {}) => {
    const loaderId = showBlockingLoader(options)

    try {
      return await task()
    } finally {
      await hideBlockingLoader(loaderId)
    }
  }, [hideBlockingLoader, showBlockingLoader])

  const currentBlockingLoader = blockingLoaders.length
    ? blockingLoaders[blockingLoaders.length - 1]
    : null

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      toastTimeoutsRef.current.clear()
      loaderMetaRef.current.clear()
    }
  }, [])

  const value = useMemo(() => ({
    toasts,
    dismissToast,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showApiError,
    clearToasts,
    blockingLoaders,
    currentBlockingLoader,
    isBlocking: Boolean(currentBlockingLoader),
    showBlockingLoader,
    hideBlockingLoader,
    runBlockingTask,
  }), [
    toasts,
    dismissToast,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showApiError,
    clearToasts,
    blockingLoaders,
    currentBlockingLoader,
    showBlockingLoader,
    hideBlockingLoader,
    runBlockingTask,
  ])

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const context = useContext(UIContext)

  if (!context) {
    throw new Error("useUI must be used within UIProvider")
  }

  return context
}
