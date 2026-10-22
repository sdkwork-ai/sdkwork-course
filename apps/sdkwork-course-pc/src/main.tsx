import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { configureCourseAdminHost } from './bootstrap/consoleHost'
import './index.css'

configureCourseAdminHost()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
