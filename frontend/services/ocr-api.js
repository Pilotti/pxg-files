const OCR_API_URL = process.env.NEXT_PUBLIC_OCR_API_URL || process.env.NEXT_PUBLIC_API_URL

export async function extractText(file) {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch(`${OCR_API_URL}/ocr`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Erro ao processar imagem')
    }

    const data = await response.json()
    return data.text
  } catch (error) {
    throw new Error(error.message || 'Erro de conexão com servidor')
  }
}
