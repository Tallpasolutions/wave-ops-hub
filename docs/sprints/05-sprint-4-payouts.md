# Sprint 4 — Payouts e Fechamento Mensal

**Duração estimada:** 1 semana
**Status:** Pendente
**Pré-requisitos:** Sprint 3 concluída

---

## Objetivo

Implementar cálculo automático de payouts, "deixado na mesa", override manual, fechamento mensal completo (lifecycle de aprovação) e geração de relatórios consolidado e individual por técnico. Ao final, gestor consegue aprovar e pagar o fechamento de abril/2026 com números reais.

---

## Escopo IN

### 1. Schema do banco

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  visit_id UUID NOT NULL UNIQUE REFERENCES service_visits(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES technicians(id),
  lpu_id UUID REFERENCES lpus(id),
  lpu_rule_id UUID REFERENCES lpu_rules(id),
  reason_id UUID REFERENCES reasons(id),
  valor_calculado NUMERIC(10, 2),
  valor_deixado_na_mesa NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  valor_override NUMERIC(10, 2),
  override_motivo TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMPTZ,
  closing_id UUID REFERENCES monthly_closings(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  periodo TEXT NOT NULL,  -- '2026-04'
  status TEXT NOT NULL,
  total_a_pagar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_receita_unetvale NUMERIC(12, 2) NOT NULL DEFAULT 0,
  margem NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  total_oss INTEGER NOT NULL DEFAULT 0,
  aprovado_por UUID REFERENCES users(id),
  aprovado_em TIMESTAMPTZ,
  reaberto_por UUID REFERENCES users(id),
  reaberto_em TIMESTAMPTZ,
  reaberto_motivo TEXT,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, periodo)
);

CREATE TABLE payouts_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id),
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
```

- [ ] Migrations aplicadas
- [ ] RLS em todas
- [ ] Triggers de auditoria em `payouts`

### 2. Lib `src/lib/payouts/`

```
src/lib/payouts/
├── index.ts
├── types.ts
├── calculate.ts          # calcula payout para uma visita
├── recalculate-batch.ts  # recalcula payouts pendentes de um período
├── deixado-na-mesa.ts    # cálculo do valor potencial perdido
├── closing.ts            # operações sobre monthly_closings
├── reports.ts            # geração de relatórios consolidado e individual
└── __tests__/
```

- [ ] Implementar tudo + tests
- [ ] Testes cobrindo todos os cenários da tabela em `docs/domain/03`:
  - Visita com sucesso → payout do serviço
  - Visita sem sucesso, motivo `falha_cliente` paga improdutiva
  - Visita sem sucesso, motivo `falha_tecnico` não paga + calcula deixado na mesa
  - Visita com 5 tentativas → apenas última (Jean) recebe valor de serviço
  - Visita sem regra LPU → status `no_rule_match`
  - Visita com motivo pendente → status `pending_classification`

### 3. Recálculo automático

- [ ] Hook após ingestão (Sprint 2): chamar `recalculate-batch` para visitas inseridas/atualizadas
- [ ] Hook após mudança em LPU: oferecer recálculo de payouts pendentes
- [ ] Hook após classificação de motivo: recalcular payouts afetados
- [ ] Hook após vinculação manual de técnico: recalcular visitas vinculadas

### 4. Telas de payouts

- [ ] `/payouts` — lista de payouts do mês corrente, filtros por status, técnico
- [ ] `/payouts/[id]` — detalhes de um payout: visita, regra aplicada, valor, status, override
- [ ] `/payouts/[id]/override` — formulário de override (valor + motivo obrigatório)
- [ ] Lista de pendências em destaque:
  - `no_rule_match` (criar regra ou marcar exceção)
  - `pending_classification` (classificar motivo)
  - `conflict` (resolver prioridades)

### 5. Telas de fechamento mensal

- [ ] `/fechamento` — lista de fechamentos por período (cards com status, total)
- [ ] `/fechamento/[periodo]` — detalhes:
  - Status, totais
  - Lista de payouts agrupados por técnico
  - Botão "Solicitar fechamento" (valida pré-condições)
  - Botão "Aprovar" (apenas se status = aguardando_aprovacao)
  - Botão "Marcar como pago" (apenas se status = aprovado)
  - Botão "Reabrir" (com motivo obrigatório)
  - Botão "Exportar Excel"
  - Botão "Exportar PDF"

### 6. Geração de relatórios

#### Excel consolidado
- [ ] Lib `xlsx` (já presente)
- [ ] Headers: Técnico, Visitas, OSs Resolvidas, Total a Pagar, Detalhe
- [ ] Sheet 2: detalhe por visita
- [ ] Sheet 3: resumo financeiro

#### PDF consolidado
- [ ] Lib `@react-pdf/renderer`
- [ ] Layout com identidade visual Tallpa
- [ ] Logo do tenant + Tallpa no rodapé
- [ ] Tabela consolidada por técnico
- [ ] Margem, receita, total a pagar

#### PDF individual (recibo do técnico)
- [ ] Um PDF por técnico
- [ ] Cabeçalho: nome, CPF, período
- [ ] Lista detalhada de visitas com valores
- [ ] Total a receber
- [ ] Espaço para assinatura (manter formato profissional)

### 7. Cálculo de "deixado na mesa"

- [ ] Calculado em paralelo ao payout (mesma Server Action)
- [ ] Persistido em `payouts.valor_deixado_na_mesa`
- [ ] Exibido apenas se `tenant.config.show_money_on_technician_panel = true`
- [ ] Lógica em `src/lib/payouts/deixado-na-mesa.ts`

### 8. Notificações

- [ ] Após aprovação de fechamento: notificar técnicos no portal "Seu pagamento de abril foi aprovado: R$ X.XXX"
- [ ] Após marcação como pago: notificar técnicos "Pagamento efetuado em DD/MM"
- [ ] Notificações persistidas em tabela `notifications` (criar na sprint):

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Escopo OUT

- ❌ Notificação por e-mail/WhatsApp (futuro)
- ❌ Contestação de payouts pelos técnicos (fase 2)
- ❌ Integração PIX (futuro)
- ❌ Cálculo de retenção INSS/IR (futuro)

---

## Definition of Done

- [ ] Aprovação de fechamento de abril/2026 funciona end-to-end
- [ ] Total a pagar bate com expectativa do cliente
- [ ] Excel e PDF consolidados gerados corretamente
- [ ] PDFs individuais por técnico gerados corretamente
- [ ] "Deixado na mesa" calculado e visível no portal técnico (com toggle de config funcionando)
- [ ] Override manual com auditoria funcionando
- [ ] Reabertura funcionando
- [ ] Lint, typecheck, build, testes passando
- [ ] Validação Gemini aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Geração de PDF para 8+ técnicos pode estourar timeout de Server Action | Alto | Geração assíncrona com fila simples (job table); cliente faz polling |
| Cálculo do "deixado na mesa" pode dobrar tempo de processamento | Médio | Calcular apenas em batch, não em real-time |
| Edge case: técnico cadastrado depois do upload | Médio | Recálculo automático na vinculação cobre isso |

---

## Anotações pós-sprint

_(preencher ao concluir)_
