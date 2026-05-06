# Tokens Visuais — Identidade Tallpa

> Toda interface do Wave Ops Hub segue estes tokens. Eles são derivados do dashboard de referência aprovado em `public/dashboard-reference/dashboard-wave-abril-2026.html`. Antes de criar qualquer componente novo, abra esse HTML e use como espelho visual.

---

## Cores

### CSS Variables (cole exatamente assim em `globals.css`)

```css
:root {
  /* Backgrounds */
  --bg: #050814;           /* Fundo principal absoluto */
  --bg-1: #0A0F22;         /* Fundo de cards (gradiente top) */
  --bg-2: #0D1530;         /* Fundo de cards (gradiente bottom) */

  /* Borders */
  --line: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(255, 255, 255, 0.10);

  /* Text */
  --text: #FFFFFF;          /* Texto principal */
  --text-2: #9AA3BD;        /* Texto secundário (subtítulos, descrições) */
  --text-3: #5A6385;        /* Texto terciário (labels, eyebrows) */

  /* Brand */
  --cyan: #00D4FF;
  --blue: #1E6BFF;
  --grad: linear-gradient(135deg, #00D4FF 0%, #1E6BFF 100%);
  --grad-soft: linear-gradient(135deg, rgba(0,212,255,0.18) 0%, rgba(30,107,255,0.10) 100%);

  /* Status / Semantic */
  --green: #2EE6A8;         /* Sucesso, finalizado */
  --amber: #FFB547;         /* Atenção, improdutiva */
  --red: #FF5470;           /* Erro, não finalizado */
}
```

### Background do `body`
```css
body {
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(0,212,255,0.08), transparent 60%),
    radial-gradient(900px 500px at -10% 30%, rgba(30,107,255,0.07), transparent 60%),
    var(--bg);
}
```

---

## Tipografia

### Fontes

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

### Stack

```css
--font-body: 'Manrope', -apple-system, sans-serif;
--font-display: 'Poppins', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Uso

| Elemento | Fonte | Peso | Tamanho |
|---|---|---|---|
| Headings (h1, dashboard titles) | Poppins | 700 | 28px / 22px / 18px |
| Card title | Poppins | 600 | 15px |
| Body text | Manrope | 400-500 | 14px |
| Subtítulos | Manrope | 500 | 13px |
| Labels (eyebrows, table headers) | Manrope | 600 | 11px (uppercase, letter-spacing 1.5px) |
| Números / KPIs | Poppins | 700 | 28px (com gradiente quando destaque) |
| Valores monetários inline | JetBrains Mono | 500-600 | 12-14px |
| Pills / tags | JetBrains Mono | 700 | 10px |

### Letter spacing
- Eyebrows e labels: `1.5px` a `2px`
- Headings: `-0.5px` a `-1px` (negativo, para condensar)
- Body: 0 (default)

---

## Espaçamento

Sistema baseado em múltiplos de 4px:

| Token | Valor | Uso |
|---|---|---|
| `space-1` | 4px | Gap pequeno entre elementos relacionados |
| `space-2` | 8px | Gap interno de pills, padding compacto |
| `space-3` | 12px | Padding interno de células de tabela |
| `space-4` | 16px | Padding default |
| `space-5` | 20px | Padding de KPI card |
| `space-6` | 24px | Padding de card grande |
| `space-7` | 28px | Margin entre seções principais |
| `space-8` | 32px | Margin top do header |

---

## Borders e Radius

```css
--radius-sm: 6px;    /* Pills, pequenos badges */
--radius-md: 10px;   /* Logo, ícones */
--radius-lg: 14px;   /* KPI cards */
--radius-xl: 16px;   /* Cards grandes */
--radius-full: 999px; /* Pills cilíndricas, bar tracks */
```

---

## Sombras

```css
--shadow-glow-cyan: 0 8px 32px rgba(0, 212, 255, 0.25);
--shadow-card: 0 4px 16px rgba(0, 0, 0, 0.20);
```

Uso restrito — apenas em elementos de destaque (logo principal, botão CTA primário).

---

## Componentes-base

### KPI Card

```html
<div class="kpi">
  <div class="kpi-label">TOTAL DE OSs</div>
  <div class="kpi-value gradient">857</div>
  <div class="kpi-foot">
    <span class="pill cyan">28,6/dia</span> média diária
  </div>
</div>
```

```css
.kpi {
  background: linear-gradient(180deg, var(--bg-1) 0%, rgba(13,21,48,0.6) 100%);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px 18px;
  position: relative;
  overflow: hidden;
}

.kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--grad);
  opacity: 0.7;
}

.kpi-value.gradient {
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Card Standard

```css
.card {
  background: linear-gradient(180deg, var(--bg-1) 0%, rgba(10,15,34,0.4) 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 22px 24px;
}
```

### Pill / Tag

```css
.pill {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
}
.pill.green { background: rgba(46,230,168,0.12); color: var(--green); }
.pill.amber { background: rgba(255,181,71,0.12); color: var(--amber); }
.pill.red   { background: rgba(255,84,112,0.13); color: var(--red); }
.pill.cyan  { background: rgba(0,212,255,0.12); color: var(--cyan); }
```

### Bar (progress / ranking)

```css
.bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--grad);
  border-radius: 999px;
}
.bar-fill.green { background: linear-gradient(90deg, #2EE6A8, #1EB47C); }
.bar-fill.amber { background: linear-gradient(90deg, #FFB547, #FF8A47); }
.bar-fill.red   { background: linear-gradient(90deg, #FF5470, #FF1F47); }
```

### Table

- Header em uppercase, `font-size: 10px`, `letter-spacing: 1.5px`, cor `--text-3`
- Border-bottom em `--line` entre rows
- `padding: 13px 12px` em cells
- Hover de row: `background: rgba(255, 255, 255, 0.015)` (sutil)

### Rank number

Para listas ordenadas (top técnicos, ranking):

```css
.rank-num {
  display: inline-block;
  width: 22px; height: 22px; line-height: 22px;
  text-align: center;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-2);
  margin-right: 10px;
}
.rank-num.gold {
  background: var(--grad);
  color: #051127;
}
```

Top 3 ganham `.gold`, demais ficam neutros.

---

## Logo

### Componente `<TenantLogo />`

Lê `tenant.brand_path` e busca o arquivo correto em `/public/brands/<brand_path>/`. Variantes:

- `<TenantLogo variant="full" />` — logo completa horizontal (`logo.svg`)
- `<TenantLogo variant="mark" />` — apenas o símbolo (`logo-mark.svg`)
- `<TenantLogo variant="white" />` — versão branca para fundos coloridos (`logo-white.svg`)

### Estrutura da pasta de brand

```
public/brands/<brand_path>/
├── logo.svg             # Logo completa horizontal (uso principal)
├── logo-mark.svg        # Símbolo isolado (favicon, miniatura)
├── logo-white.svg       # Versão monocromática branca
└── favicon.ico          # Favicon do navegador
```

### Logo "T" (Tallpa) — referência do dashboard

```html
<div class="logo">T</div>

<style>
.logo {
  width: 42px; height: 42px;
  border-radius: 10px;
  background: var(--grad);
  display: grid; place-items: center;
  font-family: 'Poppins';
  font-weight: 800; font-size: 20px;
  color: #051127;
  box-shadow: var(--shadow-glow-cyan);
}
</style>
```

Esta versão "letra dentro de quadrado gradiente" é o **fallback genérico** para tenants sem logo customizada na pasta `_placeholder/`.

---

## Charts (Recharts)

### Cores padrão

- Linha principal: `var(--cyan)` com sombra/glow leve
- Área de preenchimento: gradient `rgba(0, 212, 255, 0.32)` → `rgba(0, 212, 255, 0)`
- Linha secundária: `var(--blue)` com `strokeDasharray="4 4"`
- Eixos: `stroke: rgba(255, 255, 255, 0.04)` (grid quase invisível)
- Tick labels: `fill: var(--text-3)`, `font-size: 11px`, `font-family: 'Manrope'`

### Tooltip

```css
.recharts-default-tooltip {
  background: var(--bg-1) !important;
  border: 1px solid var(--line-strong) !important;
  border-radius: 8px !important;
  padding: 12px !important;
  font-family: var(--font-mono) !important;
}
```

### Donut / Pie

- Cutout: 72%
- Border entre segmentos: 4px na cor `--bg-1` (cria visual "respirado")
- Centro: número grande gradiente + label uppercase

---

## Estados de UI

### Hover
- Cards: aumentar opacity da border (`--line` → `--line-strong`)
- Linhas de tabela: `background: rgba(255, 255, 255, 0.015)`
- Botões: clarear levemente o gradient

### Active / Pressed
- Botões: scale 0.98 + opacity 0.9

### Disabled
- Opacity 0.5, cursor not-allowed

### Loading
- Skeleton com `linear-gradient` animado em CSS — sem spinners genéricos

### Error
- Background: `rgba(255, 84, 112, 0.06)`
- Border: `rgba(255, 84, 112, 0.15)`
- Icon dot: `var(--red)`

### Success
- Background: `rgba(46, 230, 168, 0.06)`
- Border: `rgba(46, 230, 168, 0.15)`
- Icon dot: `var(--green)`

---

## Mobile / Responsividade

Breakpoints (Tailwind defaults usados):
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px

Regras:
- Em `< 1280px`: KPI grid muda de 6 colunas para 3
- Em `< 900px`: KPI grid 2 colunas, charts empilham, header empilha
- Em `< 600px` (mobile real): tabelas grandes viram cards verticais, padding reduz para `16px`

Portal do técnico é **mobile-first** — design pensa primeiro em 375px de largura, depois escala para desktop.

---

## Iconografia

- Lucide React como biblioteca padrão (`lucide-react`)
- Tamanho default: 16px (inline em texto), 20px (em botões), 24px (em cards/destaque)
- Stroke width: 1.5
- Cor: herdada do contexto via `currentColor`

NÃO usar emojis em interfaces — apenas em copy aprovada (ex: 👋 no welcome do técnico).
