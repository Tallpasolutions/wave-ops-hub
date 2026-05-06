# Checklist de Validação Cruzada (Gemini)

> Ao final de cada sprint, antes de declarar "concluída", o plano e o que foi entregue passa por revisão cruzada usando Gemini como segundo par de olhos. Este checklist é o roteiro pra isso.

---

## Por que validação cruzada?

LLMs têm vieses individuais. Um LLM pode confirmar suas próprias decisões de forma cega. Usar um modelo diferente (Gemini) como revisor independente reduz erros, captura blind spots, e levanta alternativas. Padrão estabelecido no fluxo de trabalho da Tallpa.

---

## Como usar

### Após terminar o planejamento de uma sprint (antes de codar)

1. Copie o conteúdo de `docs/sprints/NN-sprint-X.md`
2. Copie os ADRs relevantes
3. Cole no Gemini com o prompt:

```
Você é um revisor técnico sênior. Revise o plano de sprint abaixo com olhar crítico.

Contexto: [breve descrição do projeto, 2-3 linhas]

Plano da sprint:
[colar conteúdo]

ADRs relacionados:
[colar conteúdo]

Use o checklist abaixo para sua revisão. Para cada item, responda:
- ✅ Coberto adequadamente
- ⚠️ Coberto parcialmente — ponto de atenção
- ❌ Não coberto — risco

[colar checklist da seção apropriada abaixo]

Ao final, dê 3 sugestões concretas de ajuste no plano.
```

### Após terminar a execução de uma sprint (antes do merge final)

1. Liste o que foi entregue (commits, telas, features)
2. Cole no Gemini com prompt similar
3. Cite os pontos do checklist de "execução"

---

## Checklist — Revisão de planos de sprint

### Escopo
- [ ] As entregas listadas no escopo IN cobrem o objetivo declarado?
- [ ] Há entregas no escopo IN que poderiam ser adiadas (escopo inflado)?
- [ ] Há dependências que não estão refletidas em pré-requisitos?
- [ ] O escopo OUT é claro e protege contra creep?

### Realismo
- [ ] A duração estimada é consistente com a quantidade de entregas?
- [ ] Há tarefas mascaradas como "uma linha" mas que envolvem decisões grandes?
- [ ] Há tarefas que dependem de aprovação externa (cliente, design) sem buffer?

### Riscos
- [ ] Os riscos listados cobrem os principais pontos técnicos?
- [ ] As mitigações são concretas (não "ficar atento")?
- [ ] Há riscos de negócio (não só técnicos) considerados?

### Definition of Done
- [ ] Os critérios são objetivamente verificáveis?
- [ ] Cobrem aspectos não-funcionais (performance, segurança, observabilidade)?
- [ ] Incluem teste em ambiente próximo de produção?

### Coerência arquitetural
- [ ] As decisões da sprint respeitam ADRs existentes?
- [ ] Se há nova decisão arquitetural, está documentada como ADR?
- [ ] Não há reinvenção de algo já implementado em sprints anteriores?

### Domínio
- [ ] Os termos usados estão no glossário?
- [ ] Regras de negócio implementadas batem com `docs/domain/`?
- [ ] Não há contradições com sprints anteriores?

---

## Checklist — Revisão de execução de sprint

### Cobertura do plano
- [ ] Todas as tarefas do escopo IN foram entregues?
- [ ] Tarefas não entregues estão registradas em "anotações pós-sprint"?

### Qualidade de código
- [ ] Lint, typecheck, build passando?
- [ ] Cobertura de testes na lógica de domínio (>80% das funções críticas)?
- [ ] Conventional commits?
- [ ] Pequenos commits frequentes (não um único megacommit)?

### Documentação
- [ ] ADRs atualizados se houve decisão nova?
- [ ] Glossário atualizado se houve termo novo?
- [ ] Domain docs atualizados se houve regra nova?
- [ ] README atualizado se houve mudança no setup?

### Testes em ambiente de staging
- [ ] Fluxos críticos manualmente verificados?
- [ ] Performance aceitável (sem timeouts, sem loading >3s)?
- [ ] Visual coerente com design system?

### Banco de dados
- [ ] Migrations aplicadas em staging?
- [ ] RLS policies em todas as novas tabelas?
- [ ] Indexes apropriados criados?
- [ ] Triggers funcionando corretamente?

### Segurança
- [ ] Nenhuma credencial em código?
- [ ] RLS testado de fato (não só em policy, mas em fluxo real)?
- [ ] Inputs validados com Zod?
- [ ] Server Actions protegidas com `requireRole`?

---

## Histórico de validações

| Sprint | Data | Feedback Gemini (resumo) | Ações tomadas |
|---|---|---|---|
| 0 | — | — | — |
| 1 | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |
| 6 | — | — | — |

_(preencher ao concluir cada sprint)_
