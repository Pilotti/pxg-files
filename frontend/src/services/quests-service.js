import { apiRequest } from "./api.js"

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return
    searchParams.append(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

export const questsService = {
  listByCharacter(characterId) {
    return apiRequest(`/quests${buildQuery({ character_id: characterId })}`)
  },

  getCatalog(filters = {}) {
    return apiRequest(`/quests/catalog${buildQuery(filters)}`)
  },

  activate(templateId, characterId) {
    return apiRequest(`/quests/${templateId}/activate?character_id=${characterId}`, {
      method: "POST",
    })
  },

  complete(templateId, characterId) {
    return apiRequest(`/quests/${templateId}/complete?character_id=${characterId}`, {
      method: "PATCH",
    })
  },

  uncomplete(templateId, characterId) {
    return apiRequest(`/quests/${templateId}/uncomplete?character_id=${characterId}`, {
      method: "PATCH",
    })
  },

  remove(templateId, characterId) {
    return apiRequest(`/quests/${templateId}?character_id=${characterId}`, {
      method: "DELETE",
    })
  },
}
