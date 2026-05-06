# Sprint 5 — Portais (Manager + Técnico)

**Duração estimada:** 1.5 semanas
**Status:** Pendente
**Pré-requisitos:** Sprint 4 concluída

---

## Objetivo

Implementar os dois portais principais: dashboard executivo do gestor (espelhando exatamente o HTML aprovado) e portal do técnico (mobile-first, com gamificação leve). Ao final, qualquer pessoa do time da Wave consegue abrir o sistema e ver dados úteis.

---

## Escopo IN

### 1. Dashboard executivo do gestor (`/`)

**Espelhamento exato do HTML em `public/dashboard-reference/dashboard-wave-abril-2026.html`.**

Componentes a implementar (em React + Recharts):

#### KPIs principais (6 cards no topo)
- [ ] Total de OSs (com pill de média diária)
- [ ] Valor total recebido (com gradiente)
- [ ] Ticket médio
- [ ] Taxa de finalização (com pill verde + delta)
- [ ] Improdutividade (com pill amber)
- [ ] Equipe ativa (com indicador "online")

Componente reutilizável: `<KpiCard label value pill foot />`.

#### Gráfico "Volume Diário e Arrecadação"
- [ ] Recharts `<ComposedChart />` com:
  - Linha sólida cyan: OSs por dia
  - Linha tracejada azul: Receita por dia (eixo Y secundário)
- [ ] Tooltip com identidade visual
- [ ] Eixos X (datas) e Y (valores formatados)

#### Tabela "Tipos de OS"
- [ ] Colunas: Tipo, Quantidade, Valor Total, Ticket Médio, % Finalização
- [ ] Pill verde no % de finalização

#### Tipo de Atendimento (donut)
- [ ] Recharts `<PieChart />` com cutout 72%
- [ ] Apenas 2 segmentos: Externo (cyan) vs Interno (verde)
- [ ] Centro: número total + label

#### Ranking de Técnicos (top 5)
- [ ] Tabela com: posição (rank-num), nome, OSs, finalização %, valor
- [ ] Top 3 com `rank-num gold`
- [ ] Bar de progresso (barra horizontal) para % finalização

#### Top Técnicos por Valor Gerado
- [ ] Lista vertical com nome + valor + bar fill
- [ ] Bar fill com gradient cyan→azul

#### OSs Não Finalizadas (lista paginada)
- [ ] OS num, técnico, motivo, dias em aberto, valor
- [ ] Pill com a categoria do motivo (cor varia)

#### Distribuição Geográfica
- [ ] Lista de cidades com contadores e barras horizontais
- [ ] Top cidade em destaque

#### Motivos de Não-Conclusão
- [ ] Lista com motivo, quantidade, % do total
- [ ] Bar fill com cor da categoria

#### Indicadores de Qualidade (8 KPIs menores em grid)
- [ ] Total finalizado, total improdutiva, retrabalho, primeira visita resolvida, etc.

#### Resumo Executivo (texto)
- [ ] Card com 2-3 parágrafos resumindo os números do mês
- [ ] Geração simples baseada em templates (não IA por enquanto)

### 2. Drill-downs

- [ ] `/oss` — lista paginada de OSs
- [ ] `/oss/[osNum]` — detalhe da OS com timeline de visitas
- [ ] `/visitas/[id]` — detalhe da visita com cálculo de payout exposto
- [ ] `/equipe/tecnicos/[id]` — perfil do técnico (vista do gestor)

### 3. Tela financeira

- [ ] `/financeiro` — visão financeira do tenant
- [ ] Margem por OS
- [ ] Margem por técnico
- [ ] Margem por finalidade
- [ ] Comparativo dos últimos 6 meses (gráfico de linha)

### 4. Filtros globais

- [ ] Seletor de período no topo (mês corrente, mês anterior, range custom)
- [ ] Filtro persistido em URL (querystring)
- [ ] Aplica em todas as telas relevantes

### 5. Portal do Técnico (`<slug>.tallpa.com.br` para role=technician)

**Mobile-first.**

#### `/` — Painel
- [ ] Header com nome do técnico e mês corrente
- [ ] Card "A receber este mês" (gradient + valor grande)
- [ ] Card "Deixado na mesa" (apenas se `tenant.config.show_money_on_technician_panel = true`)
- [ ] "Você está em Xº lugar de Y técnicos" (anônimo — não mostra nomes dos outros)
- [ ] Taxa de sucesso pessoal
- [ ] 2-3 insights gerados (top motivo de falha, principal fonte de receita, etc.)
- [ ] Quick actions: ver visitas, histórico

#### `/visitas` — Minhas visitas
- [ ] Lista filtrada do mês atual
- [ ] Filtros: status, finalidade, cidade
- [ ] Cards verticais com: data, OS, finalidade, sucesso/motivo, payout
- [ ] Cor de borda do card varia: verde (sucesso), amber (improdutiva paga), red (deixado na mesa)

#### `/historico` — Histórico
- [ ] Lista de meses anteriores
- [ ] Comparativo de meses (gráfico de linha simples)
- [ ] Apresentação tipo "Wrapped" do mês anterior (card visual com 3 highlights)

#### `/perfil` — Meus dados
- [ ] Visualização e edição de dados pessoais
- [ ] Mudança de senha
- [ ] Lista de notificações

### 6. Notificações no UI

- [ ] Bell icon no header com badge de não-lidas
- [ ] Dropdown com lista de notificações
- [ ] Click marca como lida + abre o link

### 7. Empty states

- [ ] Cada tela tem empty state visualmente apropriado
- [ ] "Nenhuma OS este mês" — ilustração simples + CTA pra subir planilha
- [ ] "Nenhuma visita ainda" — texto motivacional para técnico

### 8. Loading states

- [ ] Skeletons em todas as telas com dados assíncronos
- [ ] Sem spinners genéricos — sempre estrutura visível

---

## Escopo OUT

- ❌ Mapas geográficos (apenas lista por cidade)
- ❌ Exportação direta dos dashboards (apenas relatórios de fechamento)
- ❌ Filtros customizados/salvos (futuro)
- ❌ Feed de notícias / blog interno
- ❌ Mobile app nativo

---

## Definition of Done

- [ ] Dashboard manager visualmente idêntico ao HTML aprovado
- [ ] Todos os números batem com queries no banco (validar com SQL direto)
- [ ] Portal técnico funciona em iPhone SE (375px) sem layout quebrado
- [ ] Drill-downs navegáveis (clicar em OS leva à tela de detalhe)
- [ ] Filtros de período funcionam consistentemente
- [ ] Lighthouse score > 90 em performance e acessibilidade
- [ ] Lint, typecheck, build, testes passando
- [ ] Validação Gemini aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Recharts pode ter pixel-perfect difícil contra HTML/Chart.js | Médio | Tolerância visual: 95% de coerência é suficiente |
| Performance com muitos dados em telas drill-down | Médio | Paginação obrigatória, server-side rendering |
| Mobile do técnico precisa testar em devices reais | Alto | Testar em Chrome devtools + 1 device físico antes do go-live |

---

## Anotações pós-sprint

_(preencher ao concluir)_
