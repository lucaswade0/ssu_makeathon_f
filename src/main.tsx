import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CommunityProvider } from './features/community/provider'
import { SimulationProvider } from './features/simulation/SimulationProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CommunityProvider>
      <SimulationProvider>
        <App />
      </SimulationProvider>
    </CommunityProvider>
  </StrictMode>,
)
