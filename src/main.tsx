import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource/forum/cyrillic-400.css'
import '@fontsource/forum/latin-400.css'
import '@fontsource/cormorant-sc/cyrillic-700.css'
import '@fontsource/cormorant-sc/latin-700.css'
import './index.css'
import App from './App'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
