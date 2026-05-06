# Logos por Tenant

## Estrutura de pastas

```
public/brands/
├── tallpa/                  # Logo da Tallpa Solutions (rodapés, "Powered by")
│   ├── logo.svg
│   ├── logo-mark.svg
│   ├── logo-white.svg
│   └── favicon.ico
├── wave/                    # Logo da Wave Telecom
│   ├── logo.svg
│   ├── logo-mark.svg
│   ├── logo-white.svg
│   └── favicon.ico
└── _placeholder/            # Fallback genérico para tenants novos
    ├── logo.svg
    ├── logo-mark.svg
    ├── logo-white.svg
    └── favicon.ico
```

## Como adicionar a logo de um tenant

1. Recebe os arquivos do cliente (idealmente em SVG)
2. Cria pasta `public/brands/<slug>/` (slug = mesma string usada em `tenants.brand_path`)
3. Coloca os 4 arquivos com os nomes exatos acima
4. Sistema usa automaticamente quando `tenants.brand_path = '<slug>'`

## Especificações dos arquivos

### `logo.svg` — Logo completa horizontal
- **Uso:** header desktop, splash screen, telas grandes
- **Largura sugerida:** 200-400px
- **Altura:** ajustada proporcionalmente (40-60px)
- **Fundo:** transparente
- **Cores:** versão original/oficial do cliente

### `logo-mark.svg` — Símbolo isolado
- **Uso:** header mobile, miniatura, ícone de avatar
- **Tamanho:** quadrado, 64x64 a 128x128
- **Fundo:** transparente
- **Cores:** versão original/oficial

### `logo-white.svg` — Versão monocromática branca
- **Uso:** sobre gradiente cyan/azul (botões, banners de destaque)
- **Cores:** apenas branco (`#FFFFFF`) ou tons de cinza
- **Estrutura:** mesmo desenho da logo principal mas sem cores

### `favicon.ico` — Favicon do navegador
- **Tamanhos:** múltiplos embutidos (16x16, 32x32, 48x48)
- Pode também ser `favicon.svg` se preferir SVG (suporte moderno)

## Componente `<TenantLogo />`

Implementação de referência:

```tsx
// src/components/ui/TenantLogo.tsx
import { useTenant } from '@/lib/tenant';

interface TenantLogoProps {
  variant?: 'full' | 'mark' | 'white';
  className?: string;
  alt?: string;
}

export function TenantLogo({ variant = 'full', className, alt }: TenantLogoProps) {
  const tenant = useTenant();
  const brandPath = tenant?.brandPath ?? '_placeholder';

  const fileMap = {
    full: 'logo.svg',
    mark: 'logo-mark.svg',
    white: 'logo-white.svg',
  };

  return (
    <img
      src={`/brands/${brandPath}/${fileMap[variant]}`}
      alt={alt ?? tenant?.nome ?? 'Logo'}
      className={className}
    />
  );
}
```

## Onde aparece cada variante

| Tela / Local | Variante | Tenant |
|---|---|---|
| Header desktop do app | `full` | Tenant ativo |
| Header mobile do app | `mark` | Tenant ativo |
| Login screen | `full` | Tenant detectado por subdomínio |
| Footer "Powered by Tallpa" | `mark` | Tallpa (sempre) |
| Splash de aprovação de fechamento | `full` | Tenant ativo |
| Recibos PDF gerados | `full` | Tenant ativo |
| Favicon do browser | `favicon.ico` | Tenant ativo |

## Para placeholder (`_placeholder`)

Este é o fallback quando um tenant ainda não tem logo customizada. Usa o "T" do Tallpa em estilo neutro:

```svg
<!-- public/brands/_placeholder/logo-mark.svg -->
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="44" text-anchor="middle"
        font-family="Poppins, sans-serif" font-weight="800" font-size="32"
        fill="#051127">T</text>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#00D4FF"/>
      <stop offset="100%" stop-color="#1E6BFF"/>
    </linearGradient>
  </defs>
</svg>
```

## Onde está a logo da Wave

⚠️ **Pendente:** Jhoni precisa adicionar os arquivos da Wave Telecom em `public/brands/wave/` antes do go-live. Até lá, o sistema cai no `_placeholder` e mostra o "T" genérico.
