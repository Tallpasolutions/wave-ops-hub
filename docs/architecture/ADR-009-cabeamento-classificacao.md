# ADR-009 — Payout de Cabeamento/Condomínio por classificação do gestor

**Status:** Proposto (aguardando validação Gemini — CLAUDE.md §11)
**Data:** 2026-07-04
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Roadmap pós-estabilização, frente A — os ~31 payouts `no_rule_match` de junho/2026, todos do grupo Cabeamento/Condomínio (pendência herdada da Sprint 12, Fase C)

---

## Contexto

Após a exclusão de infra (ADR-008), os payouts "sem regra" de junho caíram para **31**, todos
do grupo Cabeamento/Condomínio: Cabeamento/Segundo Ponto (23), Cabeamento Fibra (6),
Instalação Condomínio (1), Retirada Condomínio (1). A LPU ativa tem 13 regras e **nenhuma cobre
essas finalidades** — por isso essas visitas não geram payout.

A Sprint 12 registrou a hipótese de "match por explicação de valor (coluna Z)". A investigação
desta frente (04/07, com dados reais dos dois lados) mostrou por que isso não é um simples
match de campo:

**1. O payout é por serviço específico, não pela finalidade.** A finalidade no dado é grossa
(`Cabeamento/Segundo Ponto`, `Cabeamento Fibra`), mas a LPU tem valores distintos por serviço:

| Serviço (LPU WAVE.xlsx) | Payout técnico |
|---|---|
| Cabeamento/Segundo Ponto | R$ 44 |
| Cabeamento ponto dentro da casa do cliente + segundo ponto | R$ 80 |
| Cabeamento do DG até AP + segundo ponto | R$ 80 |
| Cabeamento de 3 pontos (com adicionais) | R$ 106 |
| Instalação Condomínio do DG até o AP | R$ 70 |
| Instalação Condomínio externo aéreo + do DG até o AP | R$ 190 |
| Instalação Condomínio externo subterrâneo + do DG até o AP | R$ 205 |

**2. A coluna Z (`explicacao_valor`) e a LPU falam idiomas diferentes.** A coluna Z usa o
vocabulário da *Unetvale* (a receita), a LPU usa o da *Wave* (o payout). Amostras reais da
coluna Z:

```
Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)                          → receita 77,77
Cabeamento | 88 (Reajuste ...)                                                     → receita 93,76
Cabeamento fibra aérea | 176 * 1.1 (+10% ... 2019) (Reajuste ...)                  → receita 206,26
Cabeamento fibra subterrênea | 198 * 1.1 (...) (Reajuste ...)                      → receita 232,04
Cabeamento do segundo cliente ou ftta de um condomínio | 96.80 (Reajuste ...)      → receita 103,13
Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste ...)                    → receita 171,53
```

O número após o `|` é o valor de tabela da Unetvale (`× 1,0654` de reajuste = receita); **não é
o payout do técnico**. E "Cabeamento agregado"/"fibra aérea" não mapeiam 1:1 para as linhas da
LPU ("ponto dentro da casa", "DG até AP", "3 pontos"). Traduzir um para o outro é **julgamento
de domínio**, não uma transformação determinística.

**Conclusão:** não há match por igualdade de campo nem por regex confiável. A tradução
coluna-Z → valor-da-LPU precisa de um humano — e o volume é baixo (poucos padrões distintos por
mês). **Decisão do usuário (04/07):** classificação pelo gestor, espelhando o fluxo de `reasons`
(motivo → categoria).

---

## Decisões

### 1. Nova entidade de classificação `cabeamento_classifications`, espelhando `reasons`

Tabela por tenant que mapeia um padrão distinto de coluna Z → valor de payout:

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `explicacao_original` | text | a coluna Z bruta (referência/auditoria) |
| `explicacao_key` | text | coluna Z **normalizada** (chave de agrupamento/lookup) |
| `valor` | numeric(10,2) | payout do técnico (da LPU) |
| `observacao` | text null | |
| `created_at`/`updated_at` | timestamptz | trigger de updated_at |

Unique em `(tenant_id, explicacao_key)`. Mesma forma que `reasons` (`motivo_original` /
`motivo_normalizado` / `categoria`).

**Normalização da chave (`explicacao_key`):** remover o sufixo constante de reajuste
(`(Reajuste +6,54% ...)` e `(+10% reajuste geral ...)`) e colapsar espaços, preservando a
descrição do serviço **e** o modificador de pontos (`+N ponto(s) adicional(is)`) — porque a LPU
paga diferente por pontos (44 → 80 → 106). Ex.:
`"Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste ...)"` → chave
`"Cabeamento (+73 * 1 ponto(s) adicional(is))"`. Normalizador puro e testado em `src/lib/etl/`.

### 2. Escopo por finalidade, data-driven (não hardcoded)

A classificação só se aplica a visitas cuja `finalidade` está num conjunto configurável
"classificar por explicação", guardado em `tenants.config` (mesmo padrão do
`finalidades_infra` do ADR-008). Set inicial: `Cabeamento/Segundo Ponto`, `Cabeamento Fibra`,
`Instalação Condomínio`, `Retirada Condomínio`. Assim, incluir/remover finalidades desse grupo
é config, não deploy.

### 3. Integração no cálculo de payout (motor de LPU inalterado)

No pipeline (`buildPayoutUpsert` → `calculatePayout`), para visita **bem-sucedida** cuja
finalidade está no grupo:

1. Buscar a classificação por `explicacao_key`.
2. **Encontrada** → payout = `classificacao.valor`, segue o fluxo normal (pending_review →
   aprovação).
3. **Não encontrada** → `no_rule_match` (como hoje), mas agora surge na fila de classificação
   de Cabeamento (filtrada pela finalidade do grupo).

O **motor de match da LPU não muda** (ADR-004 intacto): essas finalidades simplesmente não têm
regra de LPU; o valor vem da classificação. Reusar `no_rule_match` + filtro por finalidade
evita migrar o enum de status (10 valores). *Alternativa:* status dedicado
`pending_cabeamento` — descartado por ora (migração de enum + check constraint) a menos que a
fila fique confusa.

### 4. UI de classificação, espelhando `/motivos`

Tela que lista os **padrões distintos** de coluna Z ainda não classificados no grupo (agrupados
por `explicacao_key`, com contagem, OS de exemplo e `valor_recebido_unetvale` como referência de
receita), e um campo para o gestor atribuir o valor da LPU. Uma classificação por padrão vale
para todas as visitas com aquele padrão.

### 5. Recálculo ao classificar

Criar/editar uma classificação recalcula os payouts das visitas afetadas (mesmo padrão de
`updateReason` → `recalculate-batch`, respeitando a invariante: `approved`/`paid` nunca
recalculados automaticamente — ADR-007).

### 6. Migration numerada

Nova migration `00NN_cabeamento_classifications.sql`: tabela + índices + GRANTs
(`authenticated`, `service_role` — lição da 0007/0014) + trigger `set_updated_at` + seed do
`config.finalidades_classificar_explicacao` no tenant Wave. SQL é a fonte de verdade (CLAUDE.md §6).

---

## Alternativas consideradas

- **Condição de texto (contains/regex) no motor de LPU** — rejeitada: a coluna Z e a LPU usam
  vocabulários diferentes; regex casaria o texto errado e é frágil a variações.
- **Extração estruturada no ETL (parsear base/pontos da coluna Z)** — rejeitada: mesmo extraindo
  "Cabeamento agregado / 73 / +1 ponto", ainda falta a tradução para a linha da LPU (44/80/106),
  que é humana. Extração não elimina a classificação.
- **Valor grosso por finalidade** (Cabeamento/Segundo Ponto = R$44 fixo, etc.) — rejeitada pelo
  usuário: perde a granularidade (o simples, o +segundo ponto e o de 3 pontos pagam 44/80/106).

---

## Consequências

- Após uma classificação única por padrão distinto (poucos por mês), as ~31 visitas de
  Cabeamento/Condomínio passam a gerar payout. Os contadores `no_rule_match` e "deixado na mesa"
  caem para ~0 nesse grupo.
- Nova tabela + tela + normalizador + recálculo. **Não** toca o motor de LPU nem o enum de status.
- Reusa a UX comprovada de classificação de motivos (curva de aprendizado baixa para o gestor).
- Risco: se surgir um padrão novo de coluna Z, a visita fica `no_rule_match` até ser classificada
  — comportamento desejado (não inventa valor), visível na fila.

---

## Plano de implementação (fases)

1. **Schema + migration:** tabela `cabeamento_classifications`, config do grupo de finalidades,
   normalizador `normalizeExplicacao` (puro + testes).
2. **Cálculo:** lookup da classificação em `calculatePayout`/`buildPayoutUpsert` para o grupo;
   testes cobrindo encontrado/não-encontrado.
3. **UI:** tela de classificação (lista de padrões distintos + atribuição de valor), espelhando
   `/motivos`; link "Classificar" a partir de `/pagamentos` (fila `no_rule_match` do grupo).
4. **Recálculo:** ao classificar, recalcular payouts afetados (reuso de `recalculate-batch`).
5. **Verificação em produção:** classificar os padrões reais de junho e conferir que os 31 saem
   de `no_rule_match` com os valores da LPU (44/80/106/70/190/205), reconciliando em
   `/pagamentos` e `/fechamento`.

**DoD:** os 31 sem-regra de Cabeamento/Condomínio classificados e pagando o valor correto da LPU,
verificado em produção; `00-roadmap.md` atualizado (frente A concluída).
