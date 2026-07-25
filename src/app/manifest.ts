import type { MetadataRoute } from 'next'

// Manifest da PWA do técnico. Servido em /manifest.webmanifest.
// Cores vêm dos tokens da identidade visual (docs/visual-identity/tokens.md):
// --bg #050814 (fundo/splash), gradiente cyan→blue na marca.
// Ícones são placeholders da marca Wave — trocar quando a logo oficial chegar
// (ver public/brands/wave/README.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wave Ops Hub',
    short_name: 'Wave Ops',
    description: 'Painel do técnico: visitas, pagamentos, IQI e aprovações.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050814',
    theme_color: '#050814',
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
