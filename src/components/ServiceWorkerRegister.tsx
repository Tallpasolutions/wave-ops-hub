'use client'

import { useEffect } from 'react'

// Registra o service worker da PWA (/sw.js) uma vez, após o carregamento.
// Sem UI — só efeito colateral. O SW cuida de instalabilidade e fallback offline.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Falha no registro não deve quebrar o app — segue como web normal.
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
