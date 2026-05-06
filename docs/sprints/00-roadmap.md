# Roadmap de Sprints — Wave Ops Hub

> Plano de execução do projeto. Cada sprint tem escopo travado, entregas concretas e lista do que NÃO entra (anti-scope-creep).

---

## Visão geral

| Sprint | Nome | Duração estimada | Foco |
|---|---|---|---|
| 0 | Setup | 1 semana | Fundação técnica, identidade visual, layout shell — **parcialmente concluída** |
| 1 | Multi-tenant + Acesso | 1 semana | Auth, roles, subdomain routing, portal Tallpa Admin |
| 2 | Ingestão (ETL) | 1 semana | Upload, parser, idempotência, audit log |
| 3 | LPU + Motivos | 1 semana | Motor de regras, configuração de motivos, simulação |
| 4 | Payouts | 1 semana | Cálculo automático, "deixado na mesa", fechamento |
| 5 | Portais | 1.5 semanas | Dashboard manager (replicando HTML), portal técnico |
| 6 | Polish | 0.5 semana | Testes E2E, ajustes, deploy, onboarding Wave |

**Total estimado:** ~7 semanas (com folga, ~8-9 semanas em ritmo realista solo)

---

## Princípios

1. **Cada sprint termina com algo demonstrável.** Mesmo que não esteja completo, há um fluxo end-to-end utilizável.

2. **Escopo travado = aprovação fechada.** Mudanças no escopo da sprint atual exigem renegociação explícita, com ajuste do prazo.

3. **Definition of Done** uniforme:
   - Código revisado, lintado (`pnpm lint`), tipado (`pnpm typecheck`)
   - Testes para a lógica de domínio passando
   - Commit message conforme Conventional Commits
   - Documentação atualizada (ADR/glossário/domain se aplicável)
   - Deploy em ambiente de staging funcionando
   - Validação cruzada com Gemini (checklist em `docs/validation/`)

4. **Sem big bang final.** A cada sprint, deploy em staging e teste com dados reais (planilha existente da Wave de abril/2026).

---

## Sprint 0 — Setup [`01-sprint-0-setup.md`](./01-sprint-0-setup.md)

**Status:** Parcialmente concluída (2026-05-05)

**Entregas concluídas:**
- Stack instalada e validada (`pnpm install`, `lint`, `typecheck`, `build`, `dev` — todos passando)
- CI workflow criado (`.github/workflows/ci.yml`)
- Schema Drizzle + migration inicial gerada
- Identidade visual completa (tokens, fonts, layout shell)
- Tela `/login` com visual correto
- Documentação base (sprints, ADRs, domain docs)

**Pendentes para fechar a sprint:**
- Criar repo GitHub + `git init` + branch protection
- Criar projetos Supabase (dev + staging) + aplicar migration + seed
- Configurar Vercel + Cloudflare
- Primitivos UI (Button, Input, Label, Card, Pill, Skeleton)
- Validação Gemini

**Dependências externas:** nenhuma.

---

## Sprint 1 — Multi-tenant + Acesso [`02-sprint-1-multi-tenant.md`](./02-sprint-1-multi-tenant.md)

**Entregas:**
- Middleware de subdomínio
- Auth completo (login, logout, recuperar senha)
- Portal Tallpa Admin: criar/listar tenants, criar/listar usuários
- RLS aplicada em todas as tabelas
- Testes E2E dos fluxos de login

**Dependências:** Sprint 0.

---

## Sprint 2 — Ingestão [`03-sprint-2-etl.md`](./03-sprint-2-etl.md)

**Entregas:**
- Upload de planilha XLSX
- Parser + normalização + validação Zod
- Idempotência (file_hash + content_hash)
- Tabela `uploads` com sumário
- Match de técnico (com fallback de cadastro pendente)
- Trigger de consolidação de OSs
- Tela de histórico de uploads
- Cadastro de técnicos

**Dependências:** Sprints 0 e 1.

---

## Sprint 3 — LPU + Motivos [`04-sprint-3-lpu.md`](./04-sprint-3-lpu.md)

**Entregas:**
- Motor de regras (match engine + cálculo de payout)
- CRUD de LPU e regras
- CRUD de motivos com categorização
- Simulação antes de ativar LPU
- Auto-criação de motivos em ingestão

**Dependências:** Sprint 2.

---

## Sprint 4 — Payouts [`05-sprint-4-payouts.md`](./05-sprint-4-payouts.md)

**Entregas:**
- Recálculo automático de payouts após ingestão
- Cálculo de "deixado na mesa"
- Override manual de payout
- Fechamento mensal (lifecycle completo)
- Aprovação e marcação de pago
- Reabertura com auditoria
- Relatórios consolidado e individual (Excel + PDF)

**Dependências:** Sprint 3.

---

## Sprint 5 — Portais [`06-sprint-5-portals.md`](./06-sprint-5-portals.md)

**Entregas:**
- Dashboard executivo (manager) replicando HTML aprovado
- Portal do técnico (mobile-first)
- Drill-downs por OS/visita
- Tela financeira (margem, comparativo de meses)

**Dependências:** Sprint 4.

---

## Sprint 6 — Polish [`07-sprint-6-polish.md`](./07-sprint-6-polish.md)

**Entregas:**
- Cobertura de testes E2E nos fluxos críticos
- Ajustes visuais finais
- Documentação de uso para Wave
- Onboarding ao vivo
- Deploy em produção (`wave.tallpa.com.br`)

**Dependências:** Sprint 5.

---

## Fora deste roadmap (fase 2 — pós-MVP)

- Contestação de payouts pelos técnicos
- Domínio customizado por tenant (`portal.wavetelecom.com.br`)
- Customização de cores por tenant
- MFA/2FA
- Integração PIX para pagamento direto
- Mobile app nativo (técnicos)
- API pública para integração
- Reclame Aqui API (avaliado separadamente)
- Notificações push / WhatsApp
- Bot Telegram para gestão básica
- IA para sugerir LPU baseado em histórico
- Multi-cliente para Tallpa (Scooby como segundo tenant)
