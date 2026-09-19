# ADR-023 — Supervisor não é obrigatoriamente um técnico

**Status:** Aceito (migration 0043 aplicada em produção em 2026-09-19)
**Data:** 2026-09-19
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Cadastro de supervisor de teste durante o QA da Sprint 19. O formulário obriga a
escolher um técnico, e o gestor acabou apontando **dois usuários para o mesmo registro de
técnico** — porque não havia opção de não escolher.

---

## Contexto

O papel `tenant_supervisor` nasceu na Sprint 9 ([migration 0009](../../supabase/migrations/0009_supervisor_role.sql))
modelado como "técnico promovido": o CHECK `users_check1` exigia `technician_id IS NOT NULL`
para supervisor, igual ao técnico.

Isso se mostrou errado na prática. **Nem todo supervisor executa visitas.** Muitos só
acompanham equipe, e não existem em `technicians`. O gestor era obrigado a inventar um
vínculo para o formulário passar.

O sistema, porém, usa `technician_id` para duas coisas que a tela confundia:

| Relação | Significado | Onde vive |
|---|---|---|
| `users.technician_id` | "este supervisor **É** o técnico Fulano" | coluna em `users` |
| `supervisor_technicians` | "é **RESPONSÁVEL POR** estes técnicos" | tabela de associação (0009) |

O formulário de criação tem um `<select>` para a primeira e um grupo de checkboxes para a
segunda, lado a lado, sem deixar claro que fazem coisas diferentes.

### O bug silencioso que isso causou

Com dois usuários apontando para o mesmo técnico,
[`notifyTechnician`](../../src/lib/notifications/notify.ts) quebra:

```ts
.eq('technician_id', technicianId).maybeSingle()   // 2 linhas → erro
if (!u) return                                      // sai sem notificar, sem avisar
```

`maybeSingle()` com mais de uma linha retorna erro, `u` fica nulo e a função **retorna em
silêncio**. A notificação — e o push — simplesmente somem. É exatamente o modo de falha
antecipado no [ADR-022](./ADR-022-supervisao-de-campo.md), que por isso criou
`notifySupervisorUser` resolvendo por `users.id`. Deixou de ser hipótese.

## Decisão

**`users.technician_id` passa a ser opcional para `tenant_supervisor`.**

- [Migration 0043](../../supabase/migrations/0043_supervisor_sem_tecnico.sql) **afrouxa** o
  CHECK. `tenant_technician` continua obrigado a ter vínculo; os demais papéis continuam
  obrigados a não ter. Toda linha existente segue válida — nada é migrado nem apagado.
- No formulário, o `<select>` vira opcional, com rótulo dizendo que só se preenche quando o
  supervisor também executa visitas.
- **`supervisor_technicians` não muda em nada.** A escolha dos técnicos supervisionados
  continua obrigatória e é o que define a equipe.

### O portal do supervisor sem vínculo

O supervisor entra pelo portal do técnico, cujas telas são todas ancoradas nas visitas do
próprio usuário. Sem `technician_id` não há visita própria, e essas telas já redirecionam
com `if (!user.technicianId) redirect('/profile')`.

**Decisão:** para supervisor sem vínculo, a barra inferior mostra apenas **Equipe** e
**Perfil** (mais **Campo**, quando a Sprint 19 entrar). Painel, Visitas, IQI e Histórico
somem — em vez de aparecerem e levarem a tela vazia ou a redirect.

Supervisor **com** vínculo continua vendo tudo, exatamente como hoje.

### IQI e produtividade da equipe

Um supervisor sem visitas próprias ainda precisa acompanhar a equipe. Por isso
**`/minha-equipe` ganha IQI e produtividade por técnico**, na tela que ele já usa — sem rota
nova e sem item novo na barra, que já está apertada.

**O alcance é a equipe dele**, não o tenant inteiro: é exatamente o que a RLS já permite via
`supervisor_technicians`, em `iqi_snapshots`, `service_visits`, `payouts`,
`payout_contestacoes` e `unetvale_alteracoes`. **Nenhuma dessas cinco políticas é tocada** —
foi o critério que definiu o desenho.

## Considerados e rejeitados

**Criar um registro "fantasma" em `technicians` para cada supervisor.** Resolveria o CHECK
sem migration, mas poluiria a lista de técnicos, entraria em contagens e rankings, e exigiria
um filtro "não é técnico de verdade" em todo lugar — o mesmo tipo de discriminador que o
ADR-022 rejeitou por ser vazamento agendado.

**Dar ao supervisor acesso ao IQI de todos os técnicos do tenant.** Foi cogitado, e
rejeitado: exigiria reescrever cinco políticas RLS em produção. O ganho não justifica o
risco, e a equipe dele é o recorte que corresponde à responsabilidade dele.

**Criar um papel novo (`tenant_supervisor_puro`).** Rejeitado pelo mesmo motivo do ADR-022:
os papéis estão em CHECKs, em ~20 políticas RLS que os listam literalmente, no tipo `AppRole`
e em três layouts. Adicionar papel é o oposto de aditivo.

**Deixar as telas aparecerem vazias.** Mais simples de implementar, mas o supervisor veria
"0 pontos" e "nenhuma visita" sem entender por quê — parece defeito, não desenho.

## Consequências

**Positivas**
- O gestor deixa de ser forçado a inventar vínculo, que era a origem do bug de notificação.
- Supervisor puro passa a ser representável — o papel finalmente corresponde ao cargo.
- `/minha-equipe` vira a tela de trabalho do supervisor, com KPIs, IQI e produtividade.

**Negativas e limitações conhecidas**
- **A reversão tem prazo.** O `.down.sql` só funciona enquanto nenhum supervisor tiver
  `technician_id` nulo. Depois do primeiro, reverter exige decidir o vínculo dessas contas.
- **O DROP + ADD do CHECK tem um instante sem constraint.** Se o ADD falhasse, a tabela
  ficaria sem ela. Por isso a migration tem conferência prévia que precisa voltar vazia.
- **Os dois usuários de teste seguem compartilhando técnico.** A migration permite corrigir,
  mas não corrige sozinha — é decisão do gestor por conta. A Conferência 4 da 0043 lista
  quem está nessa situação.
- **A barra fica com 2 ou 3 itens** para supervisor puro, o que é pouco. Se o papel crescer,
  o portal dele pede desenho próprio — hoje ele é um enxerto no portal do técnico.

## Referências

- Papel e `supervisor_technicians`: [0009](../../supabase/migrations/0009_supervisor_role.sql)
- Ponto único de notificação e o `maybeSingle()`: [ADR-017](./ADR-017-notificacoes-realtime.md), [ADR-022](./ADR-022-supervisao-de-campo.md)
- Reversão: [`supabase/rollback/0043_supervisor_sem_tecnico.down.sql`](../../supabase/rollback/0043_supervisor_sem_tecnico.down.sql)
