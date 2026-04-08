import Providers from '@/components/providers'
import '@/styles/global.css'
import '@/styles/dashboard-page.css'
import '@/styles/auth-page.css'
import '@/styles/configuracoes-page.css'
import '@/styles/account-characters-section.css'
import '@/styles/character-modal.css'
import '@/styles/admin-page.css'
import '@/styles/admin-login-page.css'
import '@/styles/quests-page.css'
import '@/styles/tasks-page.css'
import '@/styles/app-toast.css'
import '@/styles/status-overlay.css'
import '@/styles/error-boundary.css'

export const metadata = {
  title: 'PXG Files',
  description: 'Game companion app',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
