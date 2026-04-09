export const ADMIN_TABS = [
  ["tasks", "Tasks"],
  ["quests", "Quests"],
  ["aliases", "Itens OCR"],
  ["npc-prices", "Precos NPC"],
  ["consumables", "Consumiveis"],
  ["users", "Usuarios"],
  ["pokemon", "Pokemon"],
  ["sidebar", "Sidebar"],
]

export const TASK_TYPES = [
  { value: "", label: "Todos os tipos" },
  { value: "item_delivery", label: "Entrega de itens" },
  { value: "defeat", label: "Derrotar" },
  { value: "capture", label: "Capturar" },
  { value: "outro", label: "Outro" },
]

export const CONTINENTS = [
  { value: "", label: "Todos os continentes" },
  { value: "kanto", label: "Kanto" },
  { value: "johto", label: "Johto" },
  { value: "orange_islands", label: "Ilhas Laranjas" },
  { value: "outland", label: "Outland" },
  { value: "nightmare_world", label: "Nightmare World" },
  { value: "orre", label: "Orre" },
]

export const TASK_INITIAL_FORM = {
  name: "",
  description: "",
  task_type: ["defeat"],
  continent: "kanto",
  min_level: "",
  nw_level: "",
  reward_text: "",
  coordinate: "",
  city: "",
  is_active: true,
}

export const QUEST_INITIAL_FORM = {
  name: "",
  description: "",
  continent: "kanto",
  city: "",
  min_level: "",
  nw_level: "",
  reward_text: "",
  is_active: true,
}

export const NPC_PRICE_INITIAL_FORM = {
  previous_name: "",
  name: "",
  unit_price: "0",
}

export const CONSUMABLE_INITIAL_FORM = {
  previous_nome: "",
  nome: "",
  preco_npc: "0",
  categoria: "",
}

export const TASK_PAGE_SIZE = 30
export const NPC_PRICE_PAGE_SIZE = 30
export const POKEMON_PAGE_SIZE = 30
export const CONSUMABLE_PAGE_SIZE = 50
