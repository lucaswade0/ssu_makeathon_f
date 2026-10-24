import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CommunityProvider } from './features/community/provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CommunityProvider>
      <App />
    </CommunityProvider>
  </StrictMode>,
)
