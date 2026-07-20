# ADR-014 — LPU por técnico (tabela alternativa, ex.: "SEM AUXILIAR")

**Status:** Aceito (implementado)
**Data:** 2026-07-20
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** A Wave passou a ter uma LPU alternativa "SEM AUXILIAR" (valores menores,
serviço sem técnico auxiliar) que deve valer só para técnicos específicos escolhidos
pelo gestor. Estende o [ADR-004](./ADR-004-lpu-rule-engine.md).

## Contexto

O modelo tinha **uma única LPU ativa por tenant** (`lpus.ativa = true`, trigger de single
active); o motor de payout carregava essa LPU e casava cada visita a uma regra dela — todos os
técnicos usavam a mesma tabela. Não havia como pagar técnicos distintos por tabelas distintas.

## Decisão

**Permitir atribuir uma LPU específica a um técnico.** A LPU alternativa é cadastrada como uma
**segunda LPU** (com suas regras), **não** marcada como a ativa padrão — o tenant mantém uma LPU
padrão ativa. O motor resolve, **por visita**, qual tabela usar.

### 1. Vínculo: coluna `technicians.lpu_id` (migration 0023)
`NULL` = usa a LPU padrão ativa do tenant; preenchida = usa aquela LPU. FK
`lpus(id) ON DELETE SET NULL`. Escolhida a coluna simples (em vez de tabela de atribuição) por
cobrir o caso atual sem overhead; dá para evoluir para histórico depois.
> No schema Drizzle a coluna foi declarada **sem** `.references()` para evitar ciclo de import
> (`users → technicians → lpus → users`); a FK é garantida pela migration.

### 2. Motor de payout resolve a LPU por técnico (`src/lib/payouts/recalculate-batch.ts`)
`loadRecalcContext` carrega, além da LPU padrão ativa + regras, um mapa
`lpuByTecnico: technicianId → { lpuId, rules }` (regras das LPUs atribuídas, uma leitura por LPU
alternativa). Em `processVisitPage`, cada visita usa **as regras da LPU do seu técnico, se houver;
senão as da LPU padrão**. `buildPayoutUpsert` não mudou — continua recebendo `rules`/`lpuId`.

### 3. UI: seletor na página do técnico
`/equipe/tecnicos/[id]` ganha "LPU do técnico" (Padrão / cada LPU alternativa). Salvar chama
`setTechnicianLpu`, que grava `lpu_id` e **recalcula os payouts do técnico** (escopo por
`visitIds` — evita o timeout do recálculo do tenant inteiro; approved/paid ficam preservados).

## Considerados e rejeitados
- **Tabela de atribuição `technician_lpus`**: mais flexível (histórico, múltiplas por período),
  mas overkill para o caso. Coluna simples resolve.
- **Marcar a 2ª LPU como ativa**: violaria o single-active e trocaria a tabela de todos. A
  alternativa fica não-ativa e é referenciada só pelos técnicos atribuídos.
- **Modelar como % de desconto sobre a padrão**: a planilha "SEM AUXILIAR" tem valores por
  serviço (não um % uniforme), então uma LPU completa é o modelo fiel.

## Consequências / pendências
- **Importar as regras** da planilha "SEM AUXILIAR" para uma LPU (mapear cada descrição ao
  critério de match) é um passo separado — este ADR entrega só o mecanismo de vínculo + motor.
- Mudar a LPU de um técnico recalcula só os payouts **pendentes** dele (approved/paid preservados).
  Para reprecificar períodos já aprovados, é preciso reabrir/limpar o lock.
- `recalculatePendingPayouts` passa a considerar `lpu_id` dos técnicos — nenhum comportamento muda
  para tenants sem LPU alternativa (mapa vazio = idêntico ao anterior).
