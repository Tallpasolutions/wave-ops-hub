# Sprint 19 — Supervisão de Campo

**Período:** 2026-09-18 em diante
**Status:** 🟡 Em andamento — Fases 0, 1 e 2 concluídas no repositório.
**⚠️ A migration 0042 ainda NÃO foi aplicada em nenhum banco** — nem em teste, nem em produção.
**Origem:** O papel `tenant_supervisor` existe desde a Sprint 9 mas é somente leitura. A Wave
quer a supervisão de campo como processo registrado: agendar, executar com checklist e fotos,
e consumir o resultado.
**ADR:** [ADR-022](../architecture/ADR-022-supervisao-de-campo.md)
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)
**Branch:** `feat/supervisao-campo`

> **Relação com a Sprint 18:** a [Sprint 18](./19-sprint-18-precisao-e-portugues.md) segue
> aberta na **Fase 2 (IQI)** — a coleta está parada desde 21/07. Esta sprint **não a
> substitui** e não toca nada de payout; são frentes independentes.

---

## Objetivo

Entregar o ciclo completo da supervisão de campo, **sem alterar o comportamento de nada que
já está em produção**:

1. O **gestor** configura o checklist e agenda a supervisão (técnico + data + supervisor).
2. O **supervisor** executa em campo pelo celular: responde o checklist e anexa fotos.
3. A supervisão recebe **nota 0–100** e um **parecer** do supervisor.
4. O **gestor** consome o resultado em `/supervisoes`.

**Fora do escopo:** o técnico ver a própria supervisão; KPI de supervisão no dashboard;
qualquer cruzamento com payout, IQI ou "deixado na mesa".

---

## A regra de ouro desta sprint

O sistema está em produção e a Wave o usa diariamente. Todas as mudanças são **aditivas**:
tabelas novas, e nos arquivos existentes apenas props opcionais com default `false` e uma
coluna a mais num `select` que já existia. **Nenhuma** coluna renomeada, removida ou
alterada de tipo; **nenhuma** política RLS existente tocada; **nenhum** papel novo; o auth
hook de JWT **não é tocado**.

O módulo fica atrás de `tenants.config.supervisao_campo_habilitada`, **desligada por
padrão**. Desligar a flag é a reversão de incidente: o módulo some das duas UIs em
segundos, sem perder um dado.

### Por que o isolamento é estrutural, e não disciplinar

`consolidar_service_order()` agrega `service_visits` por tenant + `os_num` **sem filtro
nenhum** e dispara por trigger em `service_visits` **e** em `payouts`. Como o módulo nunca
escreve nessas duas tabelas, **a função nunca é invocada** — e nenhum dos ~50 pontos que
consultam OSs e visitas precisa mudar.

O contra-exemplo está no próprio repositório: `fora_escopo` existe desde a migration 0013 e
`consolidar_service_order()` **nunca** foi ajustada para respeitá-lo. Um discriminador que
precisa ser lembrado em 50 lugares é um vazamento agendado. Daí a decisão de tabelas
próprias (ADR-022, D1).

**O único acoplamento real é `notifications`**, tabela compartilhada — e é por ela que o
módulo poderia vazar para o técnico. Regra vinculante: **nenhuma chamada a
`notifyTechnician` em código de supervisão.** Verificável por `grep` no DoD da Fase 7.

---

## Fases

| # | Fase | Entrega | Estado |
|---|---|---|---|
| **0** | Decisão | ADR-022, glossário, este doc | ✅ concluída |
| **1** | Banco | Migration 0042 + rollback + 4 schemas Drizzle | 🟡 escrita; **falta aplicar em ambiente de teste** |
| **2** | Lógica pura | `score.ts`, `status.ts`, `parecer.ts` + testes | ✅ concluída — 37 testes novos, 355 no total |
| **3** | Flag e gates | `features.ts`, `guard.ts`, `notifySupervisorUser`, props nos 5 arquivos existentes | ⬜ |
| **4** | Gestor: checklist | CRUD do template em `/supervisoes/checklist` | ✅ concluída |
| **5** | Gestor: agendar/listar/detalhar | `agendarSupervisao` com snapshot, lista, detalhe, cancelar, reatribuir | ✅ concluída |
| **6** | Supervisor: execução + fotos | `/minhas-supervisoes`, checklist item a item, upload com downscale, concluir | ✅ concluída |
| **7** | Notificações + hardening | `notifySupervisorUser` e `notifyManagers` | ✅ concluída — e a guarda de isolamento virou teste |
| **8** | E2E + rollout | `11-supervisao.spec.ts` escrito, 10 casos | 🔴 **bloqueada** — a suíte E2E inteira falha no login, e **não é regressão da sprint** (tech-debt 034) |

**Fases 1–3 são invisíveis em produção.** Fases 4–7 são desenvolvidas com a flag ligada
apenas em ambiente de teste. Só a Fase 8 liga a flag em produção.

---

## Registro de execução

### 2026-09-18 — Fases 0, 1 e 2

**Fase 0.** [ADR-022](../architecture/ADR-022-supervisao-de-campo.md), índice de ADRs,
glossário e este documento.

No glossário, além dos termos novos (supervisão de campo, checklist, item, conforme/não
conforme/não se aplica, nota, parecer, OS mencionada), **foi corrigida uma divergência
preexistente**: a tabela de papéis listava 4 e omitia `tenant_supervisor`, que existe desde a
migration 0009. Correção documental, sem efeito em código.

**Fase 1.** Migration [0042](../../supabase/migrations/0042_supervisao_campo.sql),
[reversão](../../supabase/rollback/0042_supervisao_campo.down.sql) em diretório novo
`supabase/rollback/`, e os 4 schemas Drizzle espelho.

Verificado no arquivo: nenhum bloco `DO $$` executável (a única ocorrência é o aviso do
cabeçalho), nenhum `BEGIN`/`COMMIT`, nenhum `ALTER`/`DROP` sobre objeto existente.

**Fase 2.** Lógica pura e rótulos.

Um desvio consciente do plano: os rótulos em português **não** ficaram em
`src/lib/supervisao/parecer.ts`, e sim em
[`src/lib/labels/supervisao.ts`](../../src/lib/labels/supervisao.ts), junto de
`payout-status.ts` e `campos.ts`. O motivo é o teste-guarda
`src/lib/labels/__tests__/ui-portugues.test.ts`, que reprova mapa de rótulo declarado em
tela — e cuja causa raiz documentada é exatamente mapa espalhado com fallback silencioso.
`parecer.ts` ficou só com o tipo e a lista de valores.

**Estado da suíte:** `pnpm typecheck` e `pnpm lint` limpos; `pnpm test` com **355 testes
passando** (318 antes, 37 novos). Nenhum teste existente mudou de comportamento.

**Nada disso é visível em produção:** as tabelas não existem em nenhum banco ainda, e nenhum
código de tela importa o módulo.

### Próximo passo — Fase 3

É a fase de **maior risco de regressão**: toca os 5 arquivos existentes de layout e navegação.
Exige `pnpm build` (prova da ausência de colisão de rota) e QA visual confirmando que o painel
do gestor e o portal do técnico ficam **pixel-idênticos** com a flag desligada. É também onde
o risco R6 (7º item na `TechBottomNav`) tem de ser medido a 360px.

---

## Modelo de dados (migration 0042)

Quatro tabelas novas. Nenhum `ALTER` em tabela existente.

| Tabela | Papel |
|---|---|
| `supervision_checklist_items` | Template do checklist, por tenant. CRUD do gestor. **Nunca `DELETE`** — desativar é `ativo = false` |
| `field_supervisions` | A supervisão: técnico, supervisor, data, status, nota, parecer, contadores |
| `supervision_answers` | **Cópia congelada** dos itens no agendamento + a resposta de cada um |
| `supervision_photos` | Evidências no bucket `supervisao-fotos` |

### Três pontos do schema que não são óbvios

- **`tecnico_id` em português.** Casa com `service_visits` e `iqi_snapshots`. Nome errado de
  coluna faz o PostgREST devolver vazio **em silêncio** (CLAUDE.md §6).
- **`supervisor_user_id` é `users.id`, não `technicians.id`.** É por ele que a RLS filtra,
  comparando direto com `auth.uid()`, sem join. Desnormalizado também em `answers` e
  `photos` — mesmo precedente de `unetvale_alteracoes.technician_id` (ADR-021).
- **FK nomeada `fk_field_sup_supervisor`.** `field_supervisions` tem 3 FKs para `users`;
  sem nome explícito o embed do PostgREST fica ambíguo e a query falha.

### RLS — o que muda em relação ao template canônico

O template do projeto (0020, 0022, 0041) tem um ramo `tenant_technician`. **Aqui esse ramo
não existe** — é assim que o técnico fica de fora. E o ramo do supervisor usa
`supervisor_user_id = auth.uid()`, não `supervisor_technicians`: a regra é "o supervisor vê
as supervisões dele", não "as da equipe dele".

`supervision_checklist_items` é **só gestor/owner** — o supervisor lê o snapshot, não o
template.

**GRANTs:** `SELECT, INSERT, UPDATE` para `authenticated` — **`DELETE` fica de fora de
propósito**, nada no módulo é apagado pela UI. Sem GRANT o PostgREST devolve `[]` **sem
erro**.

---

## Verificação

### Antes de aplicar a 0042 — anotar o resultado

```sql
SELECT c.relname AS tabela, count(*) AS triggers
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('service_visits','payouts','service_orders')
GROUP BY c.relname ORDER BY c.relname;
```

### Depois — as 7 conferências no fim da migration

1. 4 tabelas com `rowsecurity = true`
2. 4 policies `tenant_isolation`
3. **12 GRANTs** para `authenticated`, **nenhum `DELETE`**
4. Bucket `supervisao-fotos` privado, 5 MB
5. 3 policies `supervisao_fotos_*` **e as 3 `uploads_tenant_*` intactas**
6. Flag `false` em todos os tenants
7. **Contagem de triggers idêntica ao pré** — é a prova da regra de ouro

### Comandos

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

O `pnpm build` é obrigatório já na Fase 3: é ele que prova que não há colisão de rota entre
os route groups (tech-debt 006).

### DoD desta sprint

Conforme [`regras-de-execucao.md`](./regras-de-execucao.md), nenhuma fase fecha sem
**verificação em produção** (ou, nas fases 4–7, em ambiente de teste com a flag ligada).
Especificamente:

- **Fase 3:** painel do gestor e portal do técnico **pixel-idênticos** com a flag desligada.
  É a fase de maior risco de regressão.
- **Fase 5:** agendar → editar/desativar itens do template → reabrir a supervisão: o
  checklist dela **não muda**. É o teste que prova o versionamento.
- **Fase 6:** em **Android real** (APK/PWA): câmera abre, foto sobe, aparece no detalhe do
  gestor. `nota` no banco bate com o cálculo manual.
- **Fase 7:** `grep -rn "notifyTechnician"` nas pastas do módulo retorna **vazio**.

---

## Publicação e reversão

**Ordem:** ADR aprovado → Fases 1–3 em produção com a flag desligada → Fases 4–7 com a flag
ligada só em teste → Fase 8 liga a flag para `wave`.

**Ambiente de teste primeiro.** A 0042 é aplicada primeiro num Supabase branch (ou projeto
de teste), com a suíte completa e as 7 conferências. Só depois vai para produção.

**Backup antes da migration em produção.** Apesar de puramente aditiva, snapshot do projeto
Supabase antes de aplicar — é a rede contra erro de cópia no SQL Editor, que já truncou
bloco `$$` neste projeto (migration 0036; a 0042 **não tem nenhum `$$`**, justamente por
isso). Aplicar **statement a statement**, em horário de menor uso, fora do ciclo de upload
de planilha e de fechamento.

### Reversão em dois níveis

**Nível 1 — o padrão, para incidente. Segundos, zero perda de dados:**

```sql
UPDATE tenants SET config = jsonb_set(config, '{supervisao_campo_habilitada}', 'false'::jsonb, true)
WHERE slug = 'wave';
```

**Nível 1.5** — reverter o deploy do código. As tabelas ficam órfãs e inertes.

**Nível 2 — só para abandono definitivo:** `supabase/rollback/0042_supervisao_campo.down.sql`.
**Destrói o histórico de supervisões e as fotos. Irreversível.** Fica em diretório próprio,
fora de `supabase/migrations/`, porque o CLI da Supabase varre `migrations/` e um `.down.sql`
ali é um acidente esperando acontecer.

---

## Riscos em aberto

| # | Risco | Estado |
|---|---|---|
| R1 | Colisão `/supervisoes` entre `(manager)` e `(technician)` quebra o `pnpm build` | Resolvido por design: paths distintos (`/supervisoes` vs `/minhas-supervisoes`) |
| R2 | Esquecer GRANT → PostgREST devolve `[]` **sem erro** | Conferência 3 cobre |
| R6 | **7 itens na `TechBottomNav`** do supervisor com a flag ligada (hoje já são 6) | ⚠️ **Em aberto** — medir a 360px na Fase 3. Plano B: entrar por card em `/minha-equipe` |
| R7 | Divergência de `supervisor_user_id` após reatribuição | Reatribuir só com `status = 'agendada'`, atualizando as 3 tabelas na mesma action |
| R8 | Perda de sinal no campo | Sem fila offline na v1 (ADR-018). Salva item a item: perda máxima = 1 item |
| R10 | Notificação vazando para o técnico | `grep` por `notifyTechnician` como item de DoD |

---

## Ideias levantadas durante a execução (fora do escopo atual)

### Localização do supervisor e mapa ao vivo
**Levantada em:** 2026-09-19, durante a Fase 5. **Decisão:** avaliar só no fim da sprint.

O gestor quer ver num mapa onde estão técnicos e supervisores. Levantamento de viabilidade:

| O que | Dá? | Por quê |
|---|---|---|
| Capturar a posição **no momento** de cada botão (saiu, chegou, iniciou, finalizou) | ✅ **Sim** | `navigator.geolocation` funciona em PWA sob HTTPS e na TWA (é Chrome por baixo). Exige permissão do usuário uma vez |
| Mapa do gestor com a **última posição conhecida** de cada um | ✅ **Sim** | É leitura das posições carimbadas acima |
| Rastreio **contínuo em segundo plano**, app fechado | ❌ **Não de forma confiável** | Service worker não recebe geolocalização contínua. No Android exigiria app nativo com *foreground service* — a TWA não cobre |

Ou seja: **posição por evento, sim; rastreamento contínuo, não.** E a posição por evento encaixa
exatamente nas transições que a 0045 já criou — o carimbo de hora e o de lugar sairiam juntos.

Antes de implementar, tem decisão de privacidade a tomar: rastrear trabalhador tem implicações
trabalhistas e de LGPD. Precisa de aviso claro no app, consentimento e política de retenção.
**Não é decisão técnica.**

---

## Para a próxima sprint

- Fase 2 da Sprint 18 (coleta do IQI) segue parada e **não foi tocada aqui**.
- KPI de supervisão no dashboard do gestor — decisão própria, toca código em produção.
- Técnico ver a própria supervisão — hoje proibido por requisito; mudaria a RLS.
- Purga de fotos órfãs (`uploaded_em IS NULL`) — o índice parcial já está preparado.
- Fila offline de preenchimento — exigiria rever o ADR-018.
