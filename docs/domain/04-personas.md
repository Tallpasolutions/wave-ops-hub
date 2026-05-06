# Domínio 04 — Personas e Acessos

> Este documento detalha cada persona do sistema, suas necessidades e o que pode/não pode fazer. Para a decisão arquitetural de auth, ver [ADR-005](../architecture/ADR-005-auth.md).

---

## Persona 1 — Sócio Tallpa (`tallpa_owner`)

### Quem é
Os sócios da Tallpa Solutions (no início, Jhoni Cleyton). Têm visão de plataforma — operam o SaaS para múltiplos clientes.

### Acesso
Domínio: `admin.tallpa.com.br`

Esta rota é exclusiva para `tallpa_owner`. Outros usuários autenticados em outros tenants são redirecionados para `<seu_slug>.tallpa.com.br`.

### Telas

#### `/dashboard` — Visão geral da plataforma
- Lista de tenants ativos
- MRR (Monthly Recurring Revenue) consolidado
- Health status de cada tenant: último upload, número de usuários ativos, alertas
- Métricas operacionais: total de OSs processadas no mês, total de payouts gerados, etc.

#### `/tenants` — Gestão de tenants
- Lista, criação, edição, suspensão
- Cada tenant tem: slug, nome, brand_path, plano, dominio_custom (futuro), config (features ligadas/desligadas)

#### `/tenants/[slug]` — Drill-down em tenant
- Veja tudo o que o tenant_owner vê (modo "Login as")
- Ferramentas de suporte: forçar recálculo de payouts, reprocessar upload, etc.

#### `/users` — Gestão de usuários (todos os tenants)
- Lista global de usuários
- Pode resetar senha, suspender, alterar role

#### `/audit` — Auditoria global
- Logs de todas as ações em todos os tenants
- Filtros por tenant, usuário, entidade, período

#### `/billing` — Billing (futuro)
- Stripe integrado
- Histórico de cobrança por tenant

### Permissões
- ✅ Tudo, em todos os tenants

---

## Persona 2 — Sócio/Owner do Tenant (`tenant_owner`)

### Quem é
Os donos/diretores da empresa cliente (no caso, sócios da Wave). Visão estratégica — querem KPIs e controle financeiro.

### Acesso
Domínio: `<slug>.tallpa.com.br` (ex: `wave.tallpa.com.br`)

### Telas

#### `/` — Dashboard executivo (idêntico ao protótipo HTML aprovado)
- KPIs: total OSs, valor total recebido, ticket médio, taxa finalização, improdutividade, equipe ativa
- Gráfico de volume diário e arrecadação
- Tabela de tipos de OS
- Tipo de atendimento (Externo vs Interno)
- Ranking de técnicos
- Top técnicos por valor gerado
- OSs não finalizadas
- Distribuição geográfica
- Motivos de não-conclusão
- Indicadores de qualidade
- Resumo executivo

#### `/financeiro` — Visão financeira
- Margem por OS, por técnico, por tipo
- Comparativo de meses
- Total a pagar vs total recebido

#### `/oss` — Lista de OSs e visitas
- Filtros avançados (período, técnico, finalidade, cidade, status)
- Drill-down em OS individual mostrando todas as visitas
- Drill-down em visita individual mostrando o cálculo de payout

#### `/lpu` — Gestão de LPU
- Vê LPU vigente
- Cria nova LPU (rascunho)
- Edita regras
- Simula nas visitas existentes
- Ativa nova LPU (substitui anterior)

#### `/motivos` — Política de motivos
- Lista de motivos cadastrados
- Edita categoria, paga improdutiva, valor
- Classifica motivos pendentes

#### `/fechamento` — Fechamento mensal
- Lista de fechamentos por período
- Solicita fechamento
- Aprova fechamento
- Marca como pago
- Reabre (com auditoria)

#### `/uploads` — Histórico de uploads
- Lista de arquivos enviados
- Detalhes de cada upload (contadores, erros)
- Reprocessar upload (em caso de erro corrigido)

#### `/equipe` — Gestão de equipe
- Lista de técnicos
- Cadastro/edição de técnicos
- Vinculação manual a visitas pendentes
- Lista de usuários do tenant
- Cadastro de novos usuários

#### `/configuracoes` — Configurações do tenant
- Logo, cor primária (futuro)
- Toggle: "Mostrar valor 'deixado na mesa' no painel do técnico" (boolean)
- Outras flags de feature

### Permissões
- ✅ Tudo dentro do seu tenant
- ✅ Aprovar fechamentos
- ✅ Criar usuários (incluindo outros owners)
- ✅ Configurar tenant
- ❌ Outros tenants

---

## Persona 3 — Gestor do Tenant (`tenant_manager`)

### Quem é
Pessoas operacionais — coordenadores, gerentes técnicos, financeiro. Não são donos.

### Acesso
Domínio: `<slug>.tallpa.com.br` — mesmas telas do `tenant_owner`, com algumas restrições.

### Permissões
- ✅ Sobe planilha
- ✅ Configura LPU
- ✅ Classifica motivos
- ✅ Vincula técnicos a visitas pendentes
- ✅ Aprova fechamentos
- ✅ Marca como pago
- ✅ Faz override de payout
- ❌ **Não pode criar/editar usuários** (apenas `tenant_owner`)
- ❌ **Não pode alterar configurações de tenant** (apenas `tenant_owner`)
- ❌ **Não pode alterar billing**

---

## Persona 4 — Técnico (`tenant_technician`)

### Quem é
O técnico de campo — Douglas, Daniel, Marcelo, etc. Tem login próprio, vê APENAS seus dados.

### Acesso
Domínio: `<slug>.tallpa.com.br` — interface dedicada e mobile-first.

### Telas

#### `/` — Meu Painel
```
┌──────────────────────────────────────────────────┐
│  👋 Olá, Douglas                  📅 Abril/2026  │
│                                                   │
│  ┌────────────────────┐  ┌────────────────────┐  │
│  │  A RECEBER ESTE MÊS │  │  DEIXADO NA MESA*  │  │
│  │  R$ 14.250,00       │  │  R$ 4.180,00       │  │
│  │  138 OSs com sucesso │  │  52 OSs sem sucesso│  │
│  └────────────────────┘  └────────────────────┘  │
│                                                   │
│  📊 Você está em 1º lugar de 8 técnicos           │
│  Taxa de sucesso: 72,6%                          │
│                                                   │
│  💡 Insights                                      │
│  • Maior fonte: Suporte Fibra (R$ 6.840)          │
│  • 18 visitas improdutivas — confirme antes      │
│  • Top motivo de falha: cliente ausente (24)     │
│                                                   │
│  [Minhas OSs]  [Histórico]  [Comparar meses]     │
└──────────────────────────────────────────────────┘
```

\* "Deixado na mesa" só aparece se `tenant.config.show_money_on_technician_panel = true`. Se desabilitado, mostra apenas quantidade ("52 OSs poderiam ter rendido pagamento").

#### `/visitas` — Minhas visitas
- Lista de todas as visitas do mês (e meses anteriores)
- Cada visita: data, OS, finalidade, sucesso, motivo (se aplicável), payout
- Filtros por status

#### `/historico` — Histórico mensal
- Comparativo dos últimos 6 meses
- Evolução do total recebido
- Evolução da taxa de sucesso
- Apresentação tipo "Wrapped"

#### `/perfil` — Meus dados
- Dados pessoais (nome, e-mail, CPF, celular)
- Mudar senha
- Ver dados bancários cadastrados (futuro: integração PIX)

### Permissões
- ✅ Ver suas próprias visitas, payouts, fechamentos
- ✅ Editar dados de perfil próprios
- ❌ Tudo o mais
- ❌ **Não vê dados de outros técnicos** (RLS bloqueia)
- ❌ **Não vê valores recebidos pela Wave** (apenas o que ele recebe)
- ❌ **Não vê margem ou custos da empresa**

### Visão limitada: o que técnico VÊ vs NÃO VÊ

| Informação | Vê? |
|---|---|
| Suas próprias visitas | ✅ |
| Total a receber no mês | ✅ |
| Detalhamento por OS | ✅ |
| "Deixado na mesa" | ✅ se ativado |
| Sua taxa de sucesso | ✅ |
| Ranking entre técnicos | ✅ (anônimo: "1º lugar de 8") |
| Visitas de outros técnicos | ❌ |
| Valor recebido da Unetvale | ❌ |
| Margem da Wave | ❌ |
| Configurações da LPU | ❌ |

---

## Resumo de matriz de acesso

| Recurso | tallpa_owner | tenant_owner | tenant_manager | tenant_technician |
|---|:---:|:---:|:---:|:---:|
| Ver dashboard executivo | ✅ | ✅ | ✅ | ❌ |
| Ver/editar tenants | ✅ | — | — | — |
| Subir planilha | ✅ | ✅ | ✅ | ❌ |
| Configurar LPU | ✅ | ✅ | ✅ | ❌ |
| Classificar motivos | ✅ | ✅ | ✅ | ❌ |
| Aprovar fechamento | ✅ | ✅ | ✅ | ❌ |
| Override de payout | ✅ | ✅ | ✅ | ❌ |
| Marcar como pago | ✅ | ✅ | ✅ | ❌ |
| Criar usuários | ✅ | ✅ | ❌ | ❌ |
| Configurar tenant | ✅ | ✅ | ❌ | ❌ |
| Ver dados próprios (técnico) | ✅ | ✅* | ✅* | ✅ |
| Ver dados de outros técnicos | ✅ | ✅ | ✅ | ❌ |

\* `tenant_owner` e `tenant_manager` veem dados de qualquer técnico do tenant.
