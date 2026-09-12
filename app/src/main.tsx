import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gallery/fallback.css'
import './gallery/gallery.css'
import './tokens/tokens.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
