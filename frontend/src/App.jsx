import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/auth-context.jsx"
import { CharacterProvider } from "./context/character-context.jsx"
import { UIProvider } from "./context/ui-context.jsx"
import ErrorBoundary from "./components/error-boundary.jsx"
import UIFeedbackLayer from "./components/ui-feedback-layer.jsx"
import PublicRoute from "./components/public-route.jsx"
import PrivateRoute from "./components/private-route.jsx"
import CharacterRoute from "./components/character-route.jsx"
import AdminRoute from "./components/admin-route.jsx"
import AdminPublicRoute from "./components/admin-public-route.jsx"

import LoginPage from "./pages/login-page.jsx"
import CadastroPage from "./pages/cadastro-page.jsx"
import FirstCharacterPage from "./pages/first-character-page.jsx"
import HomePage from "./pages/home-page.jsx"
import HuntsPage from "./pages/hunts-page.jsx"
import TasksPage from "./pages/tasks-page.jsx"
import QuestsPage from "./pages/quests-page.jsx"
import DiariasPage from "./pages/diarias-page.jsx"
import ConfiguracoesPage from "./pages/configuracoes-page.jsx"
import AdminLoginPage from "./pages/admin-login-page.jsx"
import AdminPage from "./pages/admin-page.jsx"

import "./styles/dashboard-page.css"
import "./styles/auth-page.css"
import "./styles/configuracoes-page.css"
import "./styles/account-characters-section.css"
import "./styles/admin-page.css"
import "./styles/admin-login-page.css"
import "./styles/quests-page.css"
import "./styles/tasks-page.css"
import "./styles/app-toast.css"
import "./styles/status-overlay.css"
import "./styles/error-boundary.css"

function ProtectedWithCharacter({ children }) {
  return (
    <PrivateRoute>
      <CharacterRoute>{children}</CharacterRoute>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <UIProvider>
        <AuthProvider>
          <CharacterProvider>
            <BrowserRouter>
              <UIFeedbackLayer />

              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />

                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />

                <Route
                  path="/cadastro"
                  element={
                    <PublicRoute>
                      <CadastroPage />
                    </PublicRoute>
                  }
                />

                <Route
                  path="/primeiro-personagem"
                  element={
                    <PrivateRoute>
                      <FirstCharacterPage />
                    </PrivateRoute>
                  }
                />

                <Route
                  path="/selecionar-personagem"
                  element={<Navigate to="/primeiro-personagem" replace />}
                />

                <Route
                  path="/inicio"
                  element={
                    <ProtectedWithCharacter>
                      <HomePage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/hunts"
                  element={
                    <ProtectedWithCharacter>
                      <HuntsPage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/tasks"
                  element={
                    <ProtectedWithCharacter>
                      <TasksPage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/quests"
                  element={
                    <ProtectedWithCharacter>
                      <QuestsPage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/diarias"
                  element={
                    <ProtectedWithCharacter>
                      <DiariasPage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/configuracoes"
                  element={
                    <ProtectedWithCharacter>
                      <ConfiguracoesPage />
                    </ProtectedWithCharacter>
                  }
                />

                <Route
                  path="/admin/login"
                  element={
                    <AdminPublicRoute>
                      <AdminLoginPage />
                    </AdminPublicRoute>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrowserRouter>
          </CharacterProvider>
        </AuthProvider>
      </UIProvider>
    </ErrorBoundary>
  )
}
