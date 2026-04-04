function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function getStoredValue(key) {
  if (!hasWindow()) return null
  return window.localStorage.getItem(key)
}

export function setStoredValue(key, value) {
  if (!hasWindow()) return

  if (value === null || value === undefined || value === "") {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, String(value))
}

export function removeStoredValue(key) {
  if (!hasWindow()) return
  window.localStorage.removeItem(key)
}

export function clearStoredValues(keys = []) {
  if (!hasWindow()) return
  keys.forEach((key) => window.localStorage.removeItem(key))
}
