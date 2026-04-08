# Guia: Integrando Componentes React Antigos

Seu projeto antigo usa React Router. Para migrar os componentes para Next.js App Router:

## Diferenças Principais

### Rotas

**Antes (React Router + Vite):**
```javascript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/hunts" element={<HuntsPage />} />
</Routes>
```

**Depois (Next.js App Router):**
```
app/
├─ page.jsx (home)
├─ login/
│  └─ page.jsx
├─ hunts/
│  └─ page.jsx
└─ ocr/
   └─ page.jsx
```

### Navegação

**Antes:**
```javascript
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()
navigate('/login')
```

**Depois:**
```javascript
import { useRouter } from 'next/navigation'
const router = useRouter()
router.push('/login')
```

### Links

**Antes:**
```javascript
import { Link } from 'react-router-dom'
<Link to="/hunts">Hunts</Link>
```

**Depois:**
```javascript
import Link from 'next/link'
<Link href="/hunts">Hunts</Link>
```

---

## Como Migrar Componentes

### 1. **Criar arquivo de página**

Se você tem `src/pages/hunts-page.jsx`, crie:

```
app/hunts/page.jsx
```

**Conteúdo:**
```javascript
'use client'

import HuntsPage from '@/pages/hunts-page'

export default function Page() {
  return <HuntsPage />
}
```

> **Nota:** Next.js pages são server components por padrão. Use `'use client'` se precisar de estado React.

### 2. **Atualizar imports relativos →  aliases**

**Antes:**
```javascript
import { AuthProvider } from '../../context/auth-context'
```

**Depois:**
```javascript
import { AuthProvider } from '@/context/auth-context'
```

### 3. **Hooks de navegação**

Se usa `useNavigate()` do React Router:
```javascript
import { useRouter } from 'next/navigation'

export default function MyComponent() {
  const router = useRouter()
  
  const handleClick = () => {
    router.push('/hunts')
  }
  
  return <button onClick={handleClick}>Go</button>
}
```

### 4. **Protected Routes**

**Seu padrão:**
```javascript
<PrivateRoute>
  <CharacterRoute>
    <HuntsPage />
  </CharacterRoute>
</PrivateRoute>
```

**Em Next.js - criar middleware:**

```javascript
// middleware.js (na raiz de app/ ou src/)
import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('token')?.value
  
  if (!token && request.nextUrl.pathname.startsWith('/hunts')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/hunts/:path*', '/quests/:path*', '/ocr']
}
```

---

## Pages Antigos para Migrar

No seu projeto, você tem:

| Arquivo | Para → | Novo Path |
|---------|--------|-----------|
| `login-page.jsx` | `app/login/page.jsx` |
| `cadastro-page.jsx` | `app/cadastro/page.jsx` |
| `home-page.jsx` | `app/dashboard/page.jsx` |
| `hunts-page.jsx` | `app/hunts/page.jsx` |
| `quests-page.jsx` | `app/quests/page.jsx` |
| `tasks-page.jsx` | `app/tasks/page.jsx` |
| `admin-page.jsx` | `app/admin/page.jsx` |

### Exemplo: Migrar hunts-page

**1. Criar:** `app/hunts/page.jsx`

```javascript
'use client'

import HuntsPage from '@/pages/hunts-page'
import ProtectedWithCharacter from '@/components/protected-with-character'

export default function Page() {
  return (
    <ProtectedWithCharacter>
      <HuntsPage />
    </ProtectedWithCharacter>
  )
}
```

**2. Criar:** `components/protected-with-character.jsx`

```javascript
'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useEffect } from 'react'

export default function ProtectedWithCharacter({ children }) {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  if (!user) return null
  return children
}
```

---

## Contextos React

Seus contextos já estão criados em `context/` (versões stub).

Você pode:
1. **Copiar os antigos** diretamente (se já são 'use client')
2. **Adaptar se necessário** (remover React Router hooks)

Exemplo mínimo que já existe:
```javascript
// context/auth-context.jsx
'use client'
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

---

## CSS e Styles

Você pode manter seus CSS:
1. **CSS Modules:** `app/hunts/page.module.css`
2. **CSS Global:** importar em `app/layout.jsx`
3. **Tailwind:** (não configurado ainda, mas recomendado)

Você já tem stubs em `styles/` prontos.

---

## API Calls

Se seus componentes chamam API:

**Antes:**
```javascript
const response = await fetch('/api/hunts')
```

**Depois (mesmo URL, mas com base URL):**
```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL

async function getHunts() {
  const response = await fetch(`${API_URL}/hunts`)
  return response.json()
}
```

---

## Estrutura Recomendada Pós-Migração

```
app/
├─ page.jsx □ (home)
├─ login/
│  └─ page.jsx
├─ dashboard/
│  └─ page.jsx
├─ hunts/
│  ├─ page.jsx
│  └─ [id]/
│     └─ page.jsx
├─ quests/
│  └─ page.jsx
├─ tasks/
│  └─ page.jsx
├─ admin/
│  └─ page.jsx
└─ ocr/
   └─ page.jsx ✨ (novo)

lib/
├─ api.js
└─ utils.js

services/ (já existe)
├─ ocr-api.js ✨

styles/ (já existe)
```

---

## Checklist de Migração

- [ ] Copiar `src/pages` para `app/`
- [ ] Converter rotas (React Router → App Router)
- [ ] Atualizar imports (relativos → `@/` aliases)
- [ ] Adicionar `'use client'` em components com estado
- [ ] Testar navegação
- [ ] Integrar contextos
- [ ] Migrar CSS
- [ ] Testar cada página
- [ ] Deploy

---

## Exemplos de Páginas Migradas

### Migração Completa: auth-page

**App/login/page.jsx:**
```javascript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import '@/styles/auth-page.css'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      // Sua lógica aqui
      setUser({ email })
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-container">
      <form onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Login</button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
```

---

## Referências

- [Next.js App Router](https://nextjs.org/docs/app)
- [Migration from Create React App](https://nextjs.org/docs/app/building-your-application/upgrading/from-cra)
- [React Router to Next.js](https://nextjs.org/docs/app/building-your-application/routing)

---

**Dúvidas? Veja os arquivos em `app/` que já estão preparados!**
