import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './assets/css/components.css'
import App from './App.jsx'
import '@fortawesome/fontawesome-free/css/all.min.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
