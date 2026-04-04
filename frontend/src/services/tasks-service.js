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

export const tasksService = {
  listByCharacter(characterId) {
    return apiRequest(`/tasks${buildQuery({ character_id: characterId })}`)
  },

  getCatalog(filters = {}) {
    return apiRequest(`/tasks/catalog${buildQuery(filters)}`)
  },

  activate(templateId, characterId) {
    return apiRequest(`/tasks/${templateId}/activate?character_id=${characterId}`, {
      method: "POST",
    })
  },

  complete(templateId, characterId) {
    return apiRequest(`/tasks/${templateId}/complete?character_id=${characterId}`, {
      method: "PATCH",
    })
  },

  uncomplete(templateId, characterId) {
    return apiRequest(`/tasks/${templateId}/uncomplete?character_id=${characterId}`, {
      method: "PATCH",
    })
  },

  remove(templateId, characterId) {
    return apiRequest(`/tasks/${templateId}?character_id=${characterId}`, {
      method: "DELETE",
    })
  },
}
