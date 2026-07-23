# ADR-015 — Repasse de Homologação por valor da Unetvale

**Status:** Aceito (implementado; migration 0025 + recálculo a aplicar no deploy)
**Data:** 2026-07-22
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** QA de produção — OS 573115 (e outras 36 homologações) pagando valor de instalação (120/135/70) em vez do repasse correto de homologação.

---

## Contexto

Homologação é um tipo de atendimento em que a Unetvale paga uma taxa fixa (base R$ 60,50 →
R$ 64,46 com o reajuste +6,54% de fev/2025) e o técnico recebe um repasse fixo, independente da
finalidade. O problema:

1. **A finalidade colide com instalação real.** As homologações vêm com finalidade
   `Instalação - Fibra - PF/PJ` ou `Mudança Endereço Fibra` — as mesmas de uma instalação de
   verdade. O motor de LPU (match por campos) então casa as regras de instalação
   (`Instalação Aérea` R$ 120, `Instalação Subterrânea` R$ 135, `Instalação Condomínio` R$ 70),
   pagando a mais.

2. **O sinal de homologação só existe na coluna Z (`explicacao_valor`).** Ex.:
   `Homologação | 60.50 (Reajuste +6,54% fevereiro/2025)`. O motor de LPU não olha essa coluna
   para instalações. O seed `seed-wave-lpu-2026-revisada.sql` já registrava homologação como
   categoria "aguardando estrutura de dados".

3. **O repasse varia com o valor da Unetvale, e o caso "dobrado" não se distingue pelo texto.**
   Levantamento em produção (tenant Wave, 37 visitas, todas `pending_review`):

   | Explicação (coluna Z) | Unetvale | Repasse |
   |---|---|---|
   | `Homologação \| 60.50 (Reajuste...)` | R$ 64,46 | R$ 35 (base) |
   | `Homologação \| 60.50 (Reajuste...)` | R$ 128,92 | R$ 70 (dobrado = 2× base) |
   | `Homologação \| 60.50 (+73 * 1 ponto adicional) (Reajuste...)` | R$ 142,23 | R$ 79 (35 + 44) |

   O caso "dobrado" (R$ 128,92) tem a **mesma string** da base — só o valor da Unetvale o
   distingue. Logo, uma classificação por texto normalizado (como a de Cabeamento, ADR-009) não
   resolve: precisa indexar pelo valor da Unetvale.

## Decisão

Reconhecer homologação no motor de payout pela coluna Z e calcular o repasse por um **mapa
`valor_unetvale → valor_repasse` mantido pelo gestor**, análogo ao mecanismo de Cabeamento
(ADR-009), mas indexado pelo valor da Unetvale em vez do texto.

- **Detecção:** `isHomologacao(explicacao_valor)` = começa com "Homologa...". Aplica-se apenas a
  visitas com sucesso; improdutivas seguem o fluxo de motivo.
- **Precedência:** a homologação é resolvida **antes** da LPU, porque a finalidade também casa
  regras de instalação. Retorna com `lpu_rule_id = null`.
- **Lookup:** `valor_recebido_unetvale` em centavos (arredondado, sem drift de float) →
  `homologacao_classifications`. Valor cadastrado → `pending_review` com o repasse; valor **não**
  cadastrado → `no_rule_match`, que aparece na fila para o gestor cadastrar (nunca paga o valor de
  instalação em silêncio).
- **Acréscimo de domingo/feriado (ADR-011):** aplica sobre o repasse, como no Cabeamento.
- **Multi-tenant:** ligado por `tenants.config.homologacao_por_explicacao = true`. Tenant sem a
  flag mantém o comportamento anterior.

## Estrutura de dados

Tabela `homologacao_classifications` (migration 0025), espelhando
`cabeamento_classifications`: `(tenant_id, valor_unetvale, valor_repasse, observacao)`, única por
`(tenant_id, valor_unetvale)`, RLS por tenant. Seed inicial para Wave: 64,46→35; 128,92→70;
142,23→79. Gestão em `/homologacao` (agrupa as homologações por valor da Unetvale e permite
definir o repasse; salvar recalcula os payouts).

## Consequências

- **Positivas:** as 37 homologações passam a repassar o valor correto após recálculo; próximos
  uploads também; valores desconhecidos surgem na fila em vez de pagar errado.
- **Negativas / manutenção:** o gestor precisa cadastrar novos valores da Unetvale quando houver
  reajuste (assim como o texto da explicação também muda a cada reajuste). A alternativa
  (fórmula com constantes 64,46/77,77/35/44 embutidas no código) foi descartada por embutir
  constantes do reajuste atual no motor.

## Alternativas consideradas

- **Nova regra de LPU com campo `homologacao`:** o modelo de payout fixo da LPU não captura o
  caso dobrado (mesmo texto, valor diferente) nem o incremento por ponto adicional.
- **Override manual em lote:** rápido, mas não durável — próximos uploads voltariam a errar.
- **Fórmula no motor:** embutiria constantes do reajuste atual no código; quebra no próximo
  reajuste sem deploy.
