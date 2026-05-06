# Glossário do Domínio — Wave Ops Hub

> Este é o vocabulário oficial do projeto. Toda discussão, código e documentação deve usar exatamente estes termos. Inconsistência terminológica é a primeira causa de bugs em sistemas de domínio complexo.

---

## Entidades do negócio

### Ordem de Serviço (OS)
A demanda do cliente final, identificada por um número único no sistema da Unetvale (`os_num`). Uma OS pode ser **resolvida em uma ou várias visitas**. Exemplos: cliente reportou sem conexão; cliente solicitou nova instalação; cliente pediu mudança de endereço.

**Não confundir com:** Visita.

**Estado consolidado de uma OS:**
- `aberta` — ainda sem nenhuma visita registrada
- `em_andamento` — tem uma ou mais visitas, nenhuma com sucesso ainda
- `resolvida` — tem ao menos uma visita com `sucesso = Sim`
- `cancelada` — descontinuada antes da resolução (raro)

### Visita
Uma execução individual da OS por um técnico em um momento específico. **Cada linha da planilha é uma visita.** Uma OS pode ter múltiplas visitas — por exemplo, primeira visita o cliente não estava em casa, segunda visita o técnico não tinha ferramenta, terceira visita resolveu.

**Chave natural:** `(tenant_id, os_num, data_execucao, tecnico_id)`.

### Técnico
Profissional que executa visitas em campo. Tem login próprio no sistema. Está vinculado a um único tenant. O nome cadastrado no sistema deve dar match com o nome usado pela Wave na planilha (após remoção do prefixo `WAVE - `).

### Tenant
Cliente da plataforma Tallpa. No início temos apenas Wave Telecom. Cada tenant tem seu próprio subdomínio (`<slug>.tallpa.com.br`), seus próprios usuários, suas próprias OSs e sua própria LPU.

### Usuário
Conta de acesso ao sistema, com `email + senha`, vinculada a um tenant (exceto super-admins Tallpa). Tem uma `role` que define o que pode fazer.

---

## Roles (papéis de acesso)

| Role | Quem | O que faz |
|---|---|---|
| `tallpa_owner` | Sócios Tallpa | Acesso global, gerencia tenants |
| `tenant_owner` | Donos da empresa cliente | Admin completo do tenant |
| `tenant_manager` | Gestores operacionais | Sobe planilha, configura LPU, aprova fechamento |
| `tenant_technician` | Técnicos | Vê apenas seus próprios dados |

---

## Conceitos financeiros

### LPU (Lista de Preços Unitários)
Conjunto de regras que define **quanto pagar ao técnico por cada tipo de visita**. Uma LPU tem vigência (data início e fim) e contém múltiplas regras com prioridades. Quando uma LPU é substituída, o sistema mantém a antiga ativa para cálculos retroativos.

**Não confundir com:** o valor que a Unetvale paga à Wave (esse vem na coluna `Valor` da planilha e é receita, não custo).

### Regra LPU
Item individual da LPU. Define condições (finalidade + tipo atendimento + cidade + ...) e o valor a ser pago quando a visita atender as condições. Cada regra tem prioridade — regras mais específicas vencem regras genéricas.

### Payout
Valor calculado a ser pago ao técnico por **uma visita específica**. Cada visita tem zero ou um payout. O payout é calculado automaticamente pelo motor de regras a partir da LPU vigente na data da visita.

**Estados de um payout:**
- `pendente` — calculado, aguardando inclusão em fechamento
- `aprovado` — incluído em fechamento mensal aprovado
- `pago` — pagamento efetivado (registro de baixa)
- `contestado` — técnico discorda (fase 2)
- `override` — gestor alterou o valor manualmente (precisa motivo)

### Fechamento mensal
Consolidação dos payouts de um mês para aprovação e pagamento. Apenas `tenant_owner` ou `tenant_manager` podem aprovar. Após aprovado, gera relatório financeiro consolidado.

### Margem (interno Tallpa, opcional para tenant)
Diferença entre o valor recebido (Unetvale → Wave) e o valor pago (Wave → técnico). Calculada por OS, por técnico, por tipo, por cidade.

### Deixado na mesa
Valor de payout que o técnico **deixou de receber** por falha atribuível a ele. Calculado apenas para visitas com motivo categorizado como `falha_tecnico`. Mostrado no portal do técnico se o gestor habilitar.

**Exemplo:** Visita com motivo "Endereço não encontrado" — categorizado como falha do técnico — vale R$ 80 pela LPU se desse certo. O técnico recebeu R$ 0 (não paga improdutiva nesse motivo). **Deixado na mesa = R$ 80.**

---

## Conceitos técnicos do domínio

### Improdutiva
Visita que não resolveu a OS. Pode pagar valor reduzido ou zero, dependendo do motivo. **Improdutividade NÃO é sinônimo de "sem sucesso"** — uma visita pode não ter sucesso por motivo externo (chuva) e ainda ser considerada produtiva o suficiente pra pagar improdutiva.

### Motivo de não-conclusão
Razão pela qual uma visita não teve sucesso. Cada motivo tem uma **categoria** que define a política de pagamento.

**Categorias:**
- `falha_tecnico` — técnico não conseguiu por falha própria (ex: não achou endereço, sem tempo). **Não paga.**
- `falha_cliente` — cliente impediu a conclusão (ex: ausente, recusou). **Paga improdutiva.**
- `forca_maior` — eventos incontroláveis (ex: chuva). **Paga improdutiva.**
- `falha_sistema` — falha externa (ex: OS criada errada, sem viabilidade Unetvale). **Paga improdutiva.**

A categoria de cada motivo é configurada pelo gestor Wave em uma tela específica. A primeira vez que um motivo aparece em uma planilha sem estar cadastrado, fica `pendente_classificacao`.

### Match engine
Algoritmo que, dada uma visita, encontra a regra LPU aplicável. Avalia regras em ordem de prioridade (mais específicas primeiro). Se nenhuma regra bate, a visita fica como `payout_pendente_revisao`.

### Content hash
Hash SHA-256 dos campos relevantes de uma visita. Usado para detectar mudanças entre uploads. Se uma visita já existe e o hash mudou, é considerada **alterada** e gera entrada de auditoria.

### Idempotência
Propriedade de uma operação que pode ser executada múltiplas vezes com o mesmo resultado final. **Toda ingestão de planilha é idempotente.** Subir o mesmo arquivo duas vezes não duplica nada.

### Upload
Registro de uma submissão de planilha. Cada upload tem `arquivo_original`, `file_hash`, `período_inicio`, `período_fim`, `status` e contadores (`inseridas`, `atualizadas`, `ignoradas`, `erros`).

---

## Ações do sistema

### Ingestão
Processo de receber uma planilha, parsear, normalizar, deduplicar e gravar no banco. Roda em Server Action chamada após upload no Supabase Storage.

### Consolidação de OS
Recálculo dos campos derivados de uma OS (`status_consolidado`, `data_resolucao`, `total_visitas`, `custo_total`) a partir de suas visitas. Trigger automático após qualquer insert/update de visita.

### Recálculo de payouts
Aplicação do match engine sobre todas as visitas de um período afetado por um upload. Roda em background após ingestão, ou manualmente pelo gestor.

### Aprovação de fechamento
Ação que muda todos os payouts pendentes de um período pra `aprovado`. Apenas `tenant_owner` ou `tenant_manager`. Gera registro de auditoria com timestamp e usuário.

---

## Convenções de nomenclatura no código

| Conceito | Nome em código |
|---|---|
| Ordem de Serviço | `serviceOrder` (singular), `serviceOrders` (coleção) |
| Visita | `visit`, `visits` |
| Técnico | `technician`, `technicians` |
| Tenant | `tenant`, `tenants` |
| LPU | `lpu`, `lpus` |
| Regra LPU | `lpuRule`, `lpuRules` |
| Payout | `payout`, `payouts` |
| Motivo | `reason`, `reasons` (não `motivo`, mantemos inglês no código) |
| Fechamento | `monthlyClosing`, `monthlyClosings` |
| Upload | `upload`, `uploads` |

**No banco** os nomes são `snake_case` (`service_orders`, `lpu_rules`, etc). **No código TypeScript** são `camelCase`. **Drizzle faz a conversão automática.**

---

## Termos a EVITAR

❌ "Chamado" → use **OS** ou **ordem de serviço**
❌ "Atendimento" → use **visita** quando se refere à execução individual
❌ "Comissão" → use **payout**
❌ "Tabela de preços" → use **LPU**
❌ "Cliente" (ambíguo) → use **tenant** (cliente da plataforma) ou **usuário final** (cliente da Wave)
❌ "Pendente" sem contexto → especifique: `pendente_aprovacao`, `pendente_revisao`, etc.
