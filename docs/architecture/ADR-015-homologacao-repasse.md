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

## Adendo — receita glosada pela Unetvale (03/08/2026)

O `no_rule_match` de valor não cadastrado tem um caso que não estava previsto no contexto acima:
a Unetvale às vezes **reduz** o que pagou por uma homologação já executada. A OS 572737 (20/07,
Douglas Ribeiro) veio com receita **R$ 3,96** em vez dos R$ 64,46 habituais, e a própria Unetvale
explicou na observação da OS: *"21/07/2026 17:04 - Pagamento alterado devido a abertura da OS de
garantia"*. A coluna Z continua sendo `Homologação | 60.50 (Reajuste +6,54% fevereiro/2025)` — o
serviço não mudou, o pagamento é que foi glosado.

**O desenho se sustenta:** o valor cai na fila em vez de pagar os R$ 35 da homologação cheia, e a
Wave decide o repasse. Três pontos que a experiência acrescenta:

- **A glosa não tem campo próprio.** O sinal está em `observacoes`, texto livre da Unetvale — o
  mesmo motivo pelo qual `trocado_drop` foi descartado como condição em
  [`05-regras-especiais.md`](../domain/05-regras-especiais.md). Não é base para regra automática.
- **`garantia` na visita glosada é `false`.** A OS de garantia é **outra** OS, aberta depois; a
  visita original não carrega essa marca. Quem tentar resolver isso pela condição `garantia` do
  motor não vai casar nada.
- **Um valor cadastrado vale para todas as visitas com aquela receita**, em todo o tenant. Como
  cada glosa tende a produzir um valor distinto, o cadastro funciona como decisão caso a caso —
  o que é adequado aqui, mas significa que a fila vai receber uma linha nova a cada glosa
  diferente. Se isso virar volume, é hora de um ADR sobre glosa, não de mais cadastros.

Frequência medida em 03/08/2026: **1 visita** em 50 homologações do tenant (as outras 49 se
distribuem entre 64,46 · 128,92 · 142,23 · e 3 com receita R$ 0,00, que hoje resolvem pelo
[ADR-020](./ADR-020-receita-zerada-sem-repasse.md)).

## Alternativas consideradas

- **Nova regra de LPU com campo `homologacao`:** o modelo de payout fixo da LPU não captura o
  caso dobrado (mesmo texto, valor diferente) nem o incremento por ponto adicional.
- **Override manual em lote:** rápido, mas não durável — próximos uploads voltariam a errar.
- **Fórmula no motor:** embutiria constantes do reajuste atual no código; quebra no próximo
  reajuste sem deploy.
