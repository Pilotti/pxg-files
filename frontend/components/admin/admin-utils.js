export function formatTaskType(value) {
  const map = {
    item_delivery: "Entrega de itens",
    defeat: "Derrotar",
    capture: "Capturar",
    outro: "Outro",
  }

  if (Array.isArray(value)) {
    return value.map((item) => map[item] || item).join(", ")
  }

  return map[value] || value
}

export function formatContinent(value) {
  const map = {
    kanto: "Kanto",
    johto: "Johto",
    orange_islands: "Ilhas Laranjas",
    outland: "Outland",
    nightmare_world: "Nightmare World",
    orre: "Orre",
  }

  return map[value] || value
}

export function formatCity(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw) return ""

  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function buildQuery(filters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      params.append(key, String(value))
    }
  })

  const query = params.toString()
  return query ? `?${query}` : ""
}

export function normalizeCoordinateInput(rawCoordinate) {
  const text = String(rawCoordinate || "").trim()
  if (!text) {
    return null
  }

  const parts = text.split(/[^0-9-]+/).filter(Boolean)
  if (parts.length !== 3) {
    throw new Error("Coordenada deve ter 3 valores inteiros: x,y,z (podem ser negativos)")
  }

  const numbers = parts.map((part) => Number(part))
  const invalid = numbers.some((num) => !Number.isInteger(num))
  if (invalid) {
    throw new Error("Cada valor da coordenada deve ser inteiro valido")
  }

  const outOfRange = numbers.some((num) => num < -1000000 || num > 1000000)
  if (outOfRange) {
    throw new Error("Cada coordenada deve estar entre -1000000 e 1000000")
  }

  return `${numbers[0]},${numbers[1]},${numbers[2]}`
}

export function normalizeMinLevelInput(value) {
  if (value === "" || value === null || value === undefined) {
    return 5
  }

  return Number(value)
}
