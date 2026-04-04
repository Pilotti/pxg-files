export function captureWindowScroll() {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 }
  }

  return {
    x: window.scrollX,
    y: window.scrollY,
  }
}

export function restoreWindowScroll(position) {
  if (typeof window === "undefined" || !position) return

  const apply = () => {
    window.scrollTo({ left: position.x, top: position.y, behavior: "auto" })
  }

  apply()
  requestAnimationFrame(() => {
    apply()
    requestAnimationFrame(apply)
  })
}

export function runWithPreservedWindowScroll(callback) {
  const position = captureWindowScroll()
  const result = callback()
  restoreWindowScroll(position)
  return result
}

export async function runAsyncWithPreservedWindowScroll(callback) {
  const position = captureWindowScroll()
  try {
    return await callback()
  } finally {
    restoreWindowScroll(position)
  }
}
