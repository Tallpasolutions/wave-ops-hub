# ADR-003 — Modelagem de OSs e Visitas

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

A planilha operacional da Wave (`lista-os-Wave-Abril-2026.xlsx`) contém 857 linhas referentes a abril/2026, mas apenas **733 OSs únicas**. Isso significa que **98 OSs tiveram múltiplas visitas** — ou seja, várias tentativas para resolver o problema do mesmo cliente.

Exemplo real (OS 550295):
- Visita 1: Carlos — endereço não encontrado
- Visita 2: Juliano — cliente ausente
- Visita 3: Jean — APR impedida
- Visita 4: Jean — APR impedida
- Visita 5: Jean — sucesso (R$ 206,26)

Isso impõe uma decisão estrutural: **a unidade fundamental do sistema não é "OS", é "visita"**. Misturar os dois conceitos resulta em métricas erradas, payouts mal calculados e relatórios enganosos.

---

## Decisão

Modelar duas entidades distintas, com relação 1:N:

### `service_orders` (Ordens de Serviço)
Representa a demanda do cliente. Identificada por `os_num` (chave da Unetvale). Uma OS é uma entidade conceitual — pode ter zero ou mais visitas associadas.

**Campos materializados** (recalculados automaticamente):
- `status_consolidado` — `aberta | em_andamento | resolvida | cancelada`
- `data_resolucao` — data da primeira visita com `sucesso = Sim`
- `total_visitas` — count de visitas
- `tentativas_ate_sucesso` — número da visita que resolveu (1 = primeira, etc.)
- `custo_total` — soma de payouts
- `receita_total` — soma de `valor_recebido_unetvale` das visitas

### `service_visits` (Visitas)
Cada linha da planilha vira uma visita. Esta é a entidade de execução, com técnico, data, sucesso, valor.

**Chave natural composta:**
```sql
UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)
```

A justificativa: é virtualmente impossível o mesmo técnico ter dois eventos de execução para a mesma OS no exato mesmo timestamp `data_execucao`. Esta chave garante idempotência total.

---

## Por que NÃO usar `os_num` como chave primária

Olhando os dados reais:
- 98 OSs aparecem mais de uma vez na planilha de abril
- A OS 550295 aparece 5 vezes (5 tentativas de resolução)

Se `os_num` fosse PK, teríamos que escolher uma das linhas (qual? a primeira? a última? a com sucesso?), perdendo informação valiosa de cada tentativa.

Mantendo as visitas todas, ganhamos:
- Histórico completo de tentativas (auditoria, dispute resolution)
- Cálculo correto de payouts (cada técnico recebe pelo que fez)
- Métrica de **OSs com retrabalho** (KPI novo: % de OSs com >1 visita)
- Métrica de **custo real por OS resolvida** (soma de payouts ÷ OSs resolvidas)

---

## Cálculos derivados em `service_orders`

A tabela `service_orders` tem campos materializados — não calculados em runtime, mas atualizados via trigger de banco quando uma visita é inserida/atualizada/deletada.

```sql
CREATE OR REPLACE FUNCTION consolidar_service_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO service_orders (tenant_id, os_num, ...)
  VALUES (NEW.tenant_id, NEW.os_num, ...)
  ON CONFLICT (tenant_id, os_num) DO UPDATE SET
    status_consolidado = compute_status(NEW.tenant_id, NEW.os_num),
    data_resolucao = compute_data_resolucao(NEW.tenant_id, NEW.os_num),
    total_visitas = compute_total_visitas(NEW.tenant_id, NEW.os_num),
    tentativas_ate_sucesso = compute_tentativas(NEW.tenant_id, NEW.os_num),
    custo_total = compute_custo(NEW.tenant_id, NEW.os_num),
    receita_total = compute_receita(NEW.tenant_id, NEW.os_num),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consolidar_so
  AFTER INSERT OR UPDATE OR DELETE ON service_visits
  FOR EACH ROW EXECUTE FUNCTION consolidar_service_order();
```

**Por que materializar e não calcular no SELECT:**
- Performance — relatórios e dashboards consultam `service_orders` direto, sem joins pesados
- Simplicidade — frontend lê valores prontos, não precisa lógica complexa
- Consistência — os mesmos números aparecem em todas as telas (única fonte de verdade)

---

## Idempotência da ingestão

Cada visita tem um `content_hash` (SHA-256 dos campos relevantes). O fluxo de ingestão é:

```typescript
for (const row of parsedRows) {
  const newHash = computeHash(row);
  const existing = await db.query.serviceVisits.findFirst({
    where: and(
      eq(serviceVisits.tenantId, tenantId),
      eq(serviceVisits.osNum, row.osNum),
      eq(serviceVisits.dataExecucao, row.dataExecucao),
      eq(serviceVisits.tecnicoId, row.tecnicoId),
    ),
  });

  if (!existing) {
    await db.insert(serviceVisits).values({...row, contentHash: newHash});
    inserted++;
  } else if (existing.contentHash === newHash) {
    skipped++;
  } else {
    await db.update(serviceVisits).set({...row, contentHash: newHash}).where(eq(serviceVisits.id, existing.id));
    await logAudit({entity: 'visit', id: existing.id, before: existing, after: row});
    updated++;
  }
}
```

Resultado:
- Re-upload exato → tudo skip → zero impacto
- Re-upload com novidades → apenas novas inseridas
- Sobreposição de períodos → linhas idênticas viram skip
- Conflito real (valor mudou) → update + audit log

### Onde a idempotência falha: reemissão com horário trocado (adendo de 03/08/2026)

A idempotência acima só vale enquanto os quatro campos da chave forem estáveis na origem. **O
`data_execucao` não é.** Quando a Unetvale corrige o pagamento de uma OS já entregue, ela reemite
a linha com o valor novo e carimba na coluna de data de execução o **horário do ajuste**, não o da
execução. A chave muda, o `existing` não é encontrado, e o que deveria ser um `update` vira um
`insert`: duas visitas para a mesma execução, duas receitas somadas e **dois payouts**.

Descoberto pela OS 572894, que aparecia com 3 visitas e R$ 634,50 de receita enquanto a planilha
trazia 2 linhas. Varredura completa da base em 03/08/2026: **3 ocorrências**, todas do upload de
03/08, todas com a linha nova em 23:4x e a observação explicando o acréscimo (fora do horário de
expediente, apoio a outro técnico, "alinhado pagamento com acréscimo"). Limpas pela migration
[0040](../../supabase/migrations/0040_remove_visitas_reemitidas.sql) — R$ 160 de payout duplicado
e R$ 335,18 de receita fantasma.

**A chave natural NÃO passa a ser por dia.** Seria a correção óbvia — `DATE(data_execucao)` em vez
do timestamp — e está errada: a OS 568170 tem duas visitas com sucesso do **mesmo técnico no mesmo
dia** (10:03 e 10:51), ambas na mesma planilha, uma delas zerada pela Unetvale porque a outra
fechou a OS. Colapsar por dia apagaria uma execução real. Duas visitas no mesmo dia são
legítimas; o que não é legítimo é a mesma execução chegar duas vezes — e os dois casos são
indistinguíveis pelos campos da planilha.

**O que separa um do outro** é *quando* a linha chegou: a reemissão aparece num upload
**posterior** ao que já tinha a visita daquele (OS, técnico, dia). Isso é sinal para **avisar**,
não para mesclar automaticamente — uma segunda visita real reportada com atraso teria a mesma
assinatura. A detecção está registrada em `docs/tech-debt.md` (025) com a query da varredura, que
também vai como Conferência 3 da 0040.

---

## Vinculação de técnicos

A planilha contém o nome do técnico no formato `WAVE - Nome Completo`. A vinculação ao registro `technicians` no banco é feita por:

1. **Match exato pelo nome completo** (após remover prefixo `WAVE - `)
2. **Match alternativo pelo `codigo_unetvale`** quando cadastrado no técnico
3. Se nenhum dos dois der match, a visita é inserida com `tecnico_id = NULL` e `tecnico_raw = "<nome bruto>"` para revisão manual

Quando o gestor cadastra um técnico novo no sistema, o sistema oferece um botão "Vincular visitas pendentes deste nome" — faz o match retroativo.

---

## Consequências

### Positivas
- Modelagem correta do domínio real (tentativas múltiplas)
- Idempotência garantida no nível do banco (constraint UNIQUE)
- Métricas precisas de retrabalho e custo real
- Auditoria completa de mudanças

### Negativas / Trade-offs
- Trigger de consolidação adiciona overhead em cada insert/update (mitigação: aceitável para volumes esperados)
- Match de técnico por nome é frágil (mitigação: `codigo_unetvale` quando existir, e revisão manual como fallback)
