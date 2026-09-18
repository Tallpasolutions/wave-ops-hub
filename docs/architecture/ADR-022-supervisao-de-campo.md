# ADR-022 — Supervisão de Campo como módulo isolado do cálculo

**Status:** Aceito (planejado; implementação por fases)
**Data:** 2026-09-18
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** O papel `tenant_supervisor` existe desde a Sprint 9 ([migration 0009](../../supabase/migrations/0009_supervisor_role.sql)),
mas é somente leitura: uma tela, `/minha-equipe`, com KPIs da equipe. Não há onde a Wave
agendar um acompanhamento em campo, nem onde o supervisor registrar o que viu, nem
evidência fotográfica, nem nota.

---

## Contexto

A Wave quer transformar a supervisão de campo em processo registrado: o gestor agenda o
acompanhamento de um técnico, o supervisor vai a campo, preenche um checklist, tira fotos
e emite um parecer. O resultado alimenta treinamento e conversa com o técnico — **não
alimenta pagamento**.

O sistema está em produção e a Wave o usa diariamente. O risco central não é construir o
módulo: é ele contaminar o que já roda. Três pontos do código tornam isso concreto:

1. **`consolidar_service_order(tenant, os_num)`** ([0011](../../supabase/migrations/0011_fix_payout_trigger.sql))
   agrega `service_visits` por tenant + `os_num` **sem nenhum filtro**, e recalcula
   `total_visitas`, `tentativas_ate_sucesso`, `receita_total`, `custo_total` e o snapshot
   de finalidade da OS. Ela é `SECURITY DEFINER` e dispara por trigger em `service_visits`
   **e** em `payouts`. Uma "visita de supervisão" gravada em `service_visits` distorceria
   a OS real **mesmo marcada `fora_escopo = true`** — as migrations 0013, 0028 e 0033
   marcaram finalidades de infra como fora de escopo e **nunca ajustaram esta função**.

2. **`service_visits.fora_escopo`** (ADR-008) é o único discriminador existente, e é um
   booleano binário calculado só no ETL. Cerca de 25 queries sobre `payouts` são cegas a
   tipo ou origem — elas dependem da invariante "visita fora de escopo nunca gera payout",
   garantida em um único ponto (`recalculate-batch.ts`).

3. **O índice único** `(tenant_id, os_num, data_execucao, tecnico_id)` colidiria se uma
   supervisão reusasse o `os_num` de uma OS real no mesmo dia e técnico.

Ou seja: qualquer modelagem que reaproveite as tabelas centrais exige defender ~50 pontos
de leitura, um por um, para sempre. É o oposto de uma mudança aditiva segura.

## Decisão

**A Supervisão de Campo vive em tabelas próprias e nunca escreve em `service_visits`,
`service_orders` ou `payouts`.** O isolamento passa a ser **estrutural**, não disciplinar:
como nada do módulo toca essas três tabelas, os triggers de consolidação **nunca são
invocados** e nenhum dos pontos acima precisa mudar.

Decisões que decorrem disso:

- **D1 — Quatro tabelas novas:** `supervision_checklist_items`, `field_supervisions`,
  `supervision_answers`, `supervision_photos`. Migration
  [0042](../../supabase/migrations/0042_supervisao_campo.sql), puramente aditiva.

- **D2 — A supervisão é independente da OS.** O supervisor pode **mencionar** o `os_num`
  que o técnico está executando no momento, em `field_supervisions.os_num_referencia`.
  É `INTEGER` **sem chave estrangeira, de propósito**: é uma anotação de contexto, não um
  vínculo. Não entra em `consolidar_service_order()`, não afeta `total_visitas`, não é
  chave de join em lugar nenhum.

- **D3 — O checklist é configurável pelo gestor, e o histórico é imutável.** Três camadas:
  o CRUD do template **nunca faz `DELETE`** (desativar é `ativo = false`); ao agendar, a
  Server Action **copia** os itens ativos para `supervision_answers`, com título, peso e
  ordem denormalizados; e a nota é **gravada** em `field_supervisions.nota` na conclusão.
  Editar o template depois é invisível para qualquer supervisão já agendada.
  É o mesmo princípio de `payouts.valor_calculado`: grava-se o resultado, não se recalcula
  em leitura.

- **D4 — `nao_se_aplica` fica fora do numerador e do denominador** da nota. O denominador
  é a soma dos pesos dos itens `conforme` + `nao_conforme`. "Não avaliado" não é
  "reprovado". Se nenhum item for avaliável, a nota é **`null`** (a tela mostra "—"),
  nunca `0` — mesma convenção do ADR-020, em que `null` não é zero.

- **D5 — O técnico não vê a própria supervisão** e não é notificado sobre ela. Isso é
  requisito de negócio, e está gravado na RLS: as políticas das quatro tabelas
  **não têm ramo `tenant_technician`**, ao contrário do template canônico do projeto
  (0020, 0022, 0041). E o ramo do supervisor usa `supervisor_user_id = auth.uid()`, não
  `supervisor_technicians` — a regra é "o supervisor vê as supervisões dele", não "as da
  equipe dele".

- **D6 — Feature flag por tenant, desligada por padrão:**
  `tenants.config.supervisao_campo_habilitada`, lida com `=== true` (precedente:
  `homologacao_por_explicacao`, ADR-015). **A flag não vai para o JWT** — o auth hook é
  intocável (tech-debt 002 e 007) e uma flag em JWT só valeria após o refresh do token.

- **D7 — Paths distintos por portal:** `/supervisoes` no gestor, `/minhas-supervisoes` no
  supervisor. Route groups do App Router não criam segmento de URL: duas páginas em grupos
  diferentes resolvendo para o mesmo path **quebram o build** (tech-debt 006). O CLAUDE.md
  proíbe route group novo, então a saída são paths diferentes.

- **D8 — Bucket próprio** `supervisao-fotos`, privado, separado do `uploads`. Mime types,
  tamanho e ciclo de vida são outros; o bucket em produção não é tocado.

- **D9 — Notificação só para supervisor e gestores.** Novo `notifySupervisorUser` em
  [`notify.ts`](../../src/lib/notifications/notify.ts), que recebe `users.id`.
  **Nenhuma chamada a `notifyTechnician` é permitida em código de supervisão** — é o único
  acoplamento real do módulo com o que já existe (a tabela `notifications` é compartilhada)
  e, portanto, o único caminho pelo qual a supervisão poderia vazar para o técnico.

## Considerados e rejeitados

**Reusar `service_visits` com uma coluna de tipo (`origem` / `tipo_os`).** Seria a
modelagem mais "natural" se o sistema fosse novo. Rejeitada: exigiria alterar
`consolidar_service_order()` — função `SECURITY DEFINER` no caminho crítico do payout,
disparada por dois triggers — e auditar ~50 pontos de leitura, com a garantia de que todo
ponto futuro lembre do filtro. O histórico do projeto mostra que isso não se sustenta:
`fora_escopo` existe desde a 0013 e a função de consolidação **nunca** foi ajustada para
respeitá-lo. Um discriminador que precisa ser lembrado em 50 lugares é um vazamento
agendado.

**Reusar `fora_escopo = true` para marcar supervisões.** Rejeitada pelo mesmo motivo, com
um agravante: o booleano é binário e já significa outra coisa (finalidade de infra,
ADR-008). Sobrecarregá-lo apagaria a distinção entre dois conceitos não relacionados.

**Tabela `supervision_checklist_versions` com publicação explícita de versão.** Mais
normalizada que o snapshot (não duplica texto), mas exige workflow de "publicar versão" na
UI e **não é mais segura** que a cópia congelada. Fica registrada como evolução possível
se o volume de templates crescer.

**Criar um papel novo (`tenant_field_supervisor`).** Rejeitada. Os 5 papéis estão em CHECK
constraints de `users`, em ~20 políticas RLS que os listam literalmente, no tipo `AppRole`
e em três layouts. Adicionar papel é o oposto de aditivo. O `tenant_supervisor` existente
cobre o caso.

**KPI de supervisão no dashboard do gestor.** Fora deste ADR. Tocaria código em produção e
merece decisão própria, com risco e reversão avaliados à parte.

## Consequências

**Positivas**
- Isolamento estrutural: nenhum ponto existente de payout, LPU, ETL, dashboard, ranking,
  fechamento ou contagem precisa mudar.
- Reversão de incidente em segundos: desligar a flag esconde o módulo inteiro das duas UIs
  sem perder um dado sequer.
- O papel `tenant_supervisor` deixa de ser só leitor e passa a ter trabalho próprio.

**Negativas e limitações conhecidas**
- **Sem fila offline na v1.** O service worker passa as chamadas do Supabase direto para a
  rede, por decisão do [ADR-018](./ADR-018-push-app-fechado.md) — cachear resposta
  autenticada mostraria dado de outro usuário. Mitigação: o checklist salva **item a
  item**, então a perda máxima por queda de sinal é um item. Fila offline exigiria rever o
  ADR-018.
- **`supervisor_user_id` é desnormalizado** em `supervision_answers` e
  `supervision_photos` para a RLS filtrar sem join (precedente:
  `unetvale_alteracoes.technician_id`, ADR-021). Em troca, reatribuir o supervisor precisa
  atualizar as três tabelas — por isso a reatribuição só é permitida com
  `status = 'agendada'`.
- **RLS é por linha, não por coluna.** Um supervisor com token válido poderia, via
  PostgREST cru, escrever `nota` na própria supervisão. Defesa: toda escrita passa por
  Server Action com colunas explícitas; endurecimento opcional via trigger que congela
  supervisão concluída.
- **A tela de supervisões não usa o seletor global de período.** A data relevante é
  `data_agendada`, não `data_execucao`, e o seletor global é alimentado só por
  `service_visits`. `/supervisoes` fica fora de `PERIOD_NAV` e usa filtros próprios por
  `searchParams`; acoplá-lo induziria o gestor a achar que o mês global filtra supervisões.

## Fórmula da nota

```
nota = 100 × (Σ pesos dos itens 'conforme') / (Σ pesos dos itens 'conforme' + 'nao_conforme')
```

- `nao_se_aplica` não entra em nenhum dos dois lados (D4).
- Item pendente (`resposta IS NULL`) não entra em nenhum dos lados, mas **concluir a
  supervisão exige zero pendentes** — validado na Server Action.
- Denominador zero (todos `nao_se_aplica`, ou lista vazia) → `nota = null`.
- Peso padrão é 1, então o caso normal é exatamente a proporção de itens conformes. O peso
  existe para o gestor tornar um item crítico sem que a fórmula mude depois.
- Arredondamento half-up em 2 casas.

Implementação como função pura em
[`src/lib/supervisao/score.ts`](../../src/lib/supervisao/score.ts), com teste unitário —
segue a regra do CLAUDE.md §6 de lógica de domínio testada fora de componente.

O **parecer final** do supervisor é independente da nota e categórico: `aprovado`,
`aprovado_com_ressalvas`, `reprovado`, `reciclagem_recomendada`. Uma supervisão pode ter
nota alta e parecer com ressalva — a nota mede o checklist, o parecer é o julgamento de
quem esteve lá.

## Referências

- Plano de implementação e mapa de impacto completo: Sprint 19
  ([`docs/sprints/20-sprint-19-supervisao-campo.md`](../sprints/20-sprint-19-supervisao-campo.md))
- Papel `tenant_supervisor` e `supervisor_technicians`: [0009](../../supabase/migrations/0009_supervisor_role.sql)
- Template canônico de RLS com escopo de supervisor: [0020](../../supabase/migrations/0020_iqi_snapshots.sql), [0041](../../supabase/migrations/0041_unetvale_alteracoes.sql)
- Padrão de feature flag por tenant: [ADR-015](./ADR-015-homologacao-repasse.md)
- Padrão de upload com signed URL: [`src/app/(manager)/uploads/actions.ts`](../../src/app/(manager)/uploads/actions.ts)
- Fronteira do service worker: [ADR-018](./ADR-018-push-app-fechado.md)
