import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/pt-serif/cyrillic-400.css'
import '@fontsource/pt-serif/cyrillic-700.css'
import '@fontsource/pt-serif/latin-400.css'
import '@fontsource/pt-serif/latin-700.css'
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
