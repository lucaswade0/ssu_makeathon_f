import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CommunityProvider } from './features/community/provider'
import { I18nProvider } from './features/i18n/I18nProvider'
import { SimulationProvider } from './features/simulation/SimulationProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CommunityProvider>
      <I18nProvider>
        <SimulationProvider>
          <App />
        </SimulationProvider>
      </I18nProvider>
    </CommunityProvider>
  </StrictMode>,
)
