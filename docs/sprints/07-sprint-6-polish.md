# Sprint 6 — Polish e Go-live

**Duração estimada:** 0.5 a 1 semana
**Status:** Pendente
**Pré-requisitos:** Sprint 5 concluída

---

## Objetivo

Finalizar testes, ajustes visuais, documentação para Wave, deploy em produção e onboarding ao vivo. Ao final desta sprint, Wave Telecom está usando o sistema em produção.

---

## Escopo IN

### 1. Cobertura de testes E2E

Cenários obrigatórios em Playwright:

- [ ] Fluxo completo de onboarding de tenant (Tallpa cria tenant + owner)
- [ ] Login + recuperação de senha
- [ ] Upload de planilha + verificação de dados no banco
- [ ] Re-upload (idempotência)
- [ ] Cadastro de técnico + vinculação de visitas pendentes
- [ ] Configuração de motivo
- [ ] Cadastro de LPU completa + ativação
- [ ] Aprovação de fechamento mensal
- [ ] Marcação de pago
- [ ] Login como técnico + visualização de dados próprios
- [ ] RLS: técnico não consegue ver dados de outros

### 2. Ajustes visuais

- [ ] Comparar tela a tela com o HTML de referência, ajustar discrepâncias
- [ ] Validar em mobile (375, 414, 768, 1024, 1280, 1920)
- [ ] Validar em dark mode (default) — confirmar que nenhum elemento "vaza" claro
- [ ] Acessibilidade básica: contraste WCAG AA, navegação por teclado funcional, alt em imagens

### 3. Performance

- [ ] Lighthouse > 90 em todas as páginas principais
- [ ] Bundle size sob controle (< 200KB initial JS)
- [ ] Imagens otimizadas (next/image em todos os usos)
- [ ] Lazy loading de seções "abaixo da dobra"

### 4. SEO básico

- [ ] Metadata em todas as páginas
- [ ] OG tags (compartilhamento em redes sociais para futuras landing pages)
- [ ] `robots.txt` (no MVP, bloquear indexação de tudo — sistema interno)

### 5. Documentação para a Wave

Criar pasta `docs/user-guide/` com:

- [ ] `01-primeiros-passos.md` — login, navegação, perfil
- [ ] `02-upload-planilha.md` — passo a passo com screenshots
- [ ] `03-configurar-lpu.md` — como cadastrar regras
- [ ] `04-classificar-motivos.md` — categorias e impacto
- [ ] `05-aprovar-fechamento.md` — fluxo completo
- [ ] `06-portal-tecnico.md` — para os técnicos lerem
- [ ] `07-faq.md` — perguntas comuns

Esses docs viram páginas em `/ajuda/*` no app também.

### 6. Onboarding Wave

- [ ] Reunião de kickoff com Wave (1.5h via Zoom):
  - Apresentação da plataforma
  - Onboarding do `tenant_owner` Wave
  - Cadastro de usuários `tenant_manager`
  - Cadastro de técnicos
  - Subir primeira planilha (abril/2026)
  - Configurar LPU (em conjunto)
  - Classificar motivos (em conjunto)
- [ ] Vídeo gravado da sessão pra referência
- [ ] Canal de WhatsApp com gestores Wave para suporte
- [ ] Processo de feedback e bug reports estabelecido

### 7. Configuração de produção

- [ ] Domínio `wave.tallpa.com.br` apontando para Vercel produção
- [ ] Projeto Supabase produção criado e populado
- [ ] Backups automáticos configurados (Supabase nativo + dump diário em S3)
- [ ] Monitoramento: Vercel Analytics + log básico via Supabase
- [ ] Alertas: e-mail para Jhoni se erro 500 > 5 ocorrências/hora

### 8. Política de versionamento

- [ ] Tag `v1.0.0` no momento do go-live
- [ ] `CHANGELOG.md` criado e mantido a partir desta versão

### 9. Pós-go-live (primeiras 2 semanas)

- [ ] Daily check de logs de erro
- [ ] Suporte ativo via WhatsApp
- [ ] Hotfixes priorizados sobre features novas
- [ ] Coleta de feedback estruturado dos 3 perfis (owner, manager, técnico)

---

## Escopo OUT

- ❌ Funcionalidades novas
- ❌ Refactor de código
- ❌ Migração de dados de outros sistemas (Wave não tem sistema anterior — fluxo é planilha)

---

## Definition of Done

- [ ] Todos os testes E2E passando
- [ ] Lighthouse > 90 em desktop
- [ ] Lighthouse > 85 em mobile
- [ ] User guide completo
- [ ] Wave onboarded com sucesso (login efetivo de pelo menos 3 usuários reais)
- [ ] Primeira planilha real processada em produção
- [ ] Primeiro fechamento aprovado em produção
- [ ] Tag `v1.0.0` no GitHub
- [ ] Validação Gemini aprovada

---

## Após go-live: roadmap fase 2

- [ ] Contestação de payouts (técnico contesta → gestor revisa)
- [ ] Customização de cores por tenant (CSS vars dinâmicas)
- [ ] Domínio customizado (`portal.wavetelecom.com.br`)
- [ ] Notificações WhatsApp (Twilio ou similar)
- [ ] Onboarding self-service (cliente cria tenant via landing)
- [ ] Segundo tenant: Scooby
- [ ] IA para sugerir LPU baseada em histórico de outras empresas (aggregate, anônimo)
- [ ] Bot Telegram para gestor consultar KPIs rapidamente
- [ ] Integração PIX para pagamento direto (Banco Inter ou similar)
- [ ] Mobile app nativo para técnicos (React Native, com atualizações offline)
- [ ] API pública documentada (para integração com sistemas dos clientes)

---

## Anotações pós-sprint

_(preencher ao concluir)_
