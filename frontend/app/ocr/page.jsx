'use client'

import { useState } from 'react'
import { extractText } from '@/services/ocr-api'

export default function OCRPage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Selecione uma imagem')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const text = await extractText(file)
      setResult(text)
    } catch (err) {
      setError(err.message || 'Erro ao processar imagem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>OCR - Extrator de Texto</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !file}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: loading || !file ? 0.5 : 1,
          }}
        >
          {loading ? 'Processando...' : 'Extrair Texto'}
        </button>
      </form>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          borderRadius: '4px',
          color: '#721c24'
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>Resultado:</h2>
          <textarea
            value={result}
            readOnly
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '10px',
              fontFamily: 'monospace',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(result)
              alert('Copiado!')
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Copiar Texto
          </button>
        </div>
      )}
    </div>
  )
}
