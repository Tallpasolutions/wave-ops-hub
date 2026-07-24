# Regras de Execução — Anti-Alucinação

> **Documento vinculante.** Referenciado pelo CLAUDE.md. Aplica-se a TODA sessão de trabalho,
> sprint ou fase executada pelo Claude Code neste projeto. Cada regra nasceu de um erro real
> que já aconteceu aqui — o "caso real" de cada uma explica o porquê.

---

## Princípio geral

**Afirmação sem evidência é alucinação.** Neste projeto, "eu acho que funciona", "deve estar
corrigido" e "o doc diz que existe" já produziram bugs em produção. A regra de ouro:
**todo fato afirmado precisa de uma fonte verificada na mesma sessão** (saída de comando,
tela aberta, resultado SQL, arquivo lido).

---

## 1. Regras de início de sessão

**R1.1 — Ritual de abertura.** Antes de escrever qualquer código:
1. Ler o arquivo da sprint atual em `docs/sprints/` (a sprint ativa está no `00-roadmap.md`)
2. Ler a seção "Estado verificado" desse arquivo
3. Rodar `git status && git log --oneline -5` e confirmar a branch
4. Declarar ao usuário: sprint, fase, e o que será feito na sessão

**R1.2 — Doc divergente do código = corrigir o doc primeiro.** Se o estado descrito na sprint
não bater com o que o código/produção mostra, atualizar o doc ANTES de codar.
*Caso real: a Sprint 10 dizia "3 arquivos corrigidos, bug resolvido" — mas 6 ocorrências de
`technicians(nome)` continuavam no código, mantendo 2 bugs críticos em produção.*

**R1.3 — Sessão retomada não herda certezas.** Ao retomar trabalho (nova sessão, contexto
resumido), reverificar os fatos-chave antes de agir: branch atual, migration aplicada,
estado do deploy. Não confiar em "eu lembro que já fiz".

---

## 2. Regras de verificação de fatos

**R2.1 — Código > produção > docs > memória.** Ordem de confiança para qualquer afirmação
sobre o sistema. Docs de sprint descrevem intenção; só o código e a produção descrevem
realidade. Antes de citar rota, função, coluna ou componente: `grep`/`ls` primeiro.
*Caso real: o QA de 02/07 registrou "perfil de técnico não existe" com base na UI; o código
mostrou que `/equipe/tecnicos/[id]` existe desde a Sprint 5 — faltava só o link.*

**R2.2 — Nomes de coluna só do schema.** Toda referência a coluna vem de
`supabase/migrations/0001_initial_schema.sql` (+ migrations posteriores), verificada com grep
no momento do uso. Nunca de memória. `technicians` → `nome_completo`, técnico → `tecnico_id`.
*Caso real: `technicians(nome)` inventado de memória causou o 404 do detalhe de pagamento e o
fechamento zerado em produção.*

**R2.3 — PostgREST falha em silêncio.** Toda query Supabase verifica o campo `error` e o
loga/trata. Query que retorna `data: null` sem tratamento de erro é bug latente. Proibido
assumir "retornou vazio = não há dados".

**R2.4 — Números têm fonte.** Todo número escrito em doc, PR ou relatório (contagens, valores,
percentuais) vem de uma query executada, tela aberta ou comando rodado NA SESSÃO, com a fonte
anotada ao lado. Proibido reusar números de sessões anteriores sem reverificar.
*Caso real: dashboard "602 OSs" vs página OSs "516" — números divergentes sem fonte definida
geraram inconsistência que chegou à produção.*

---

## 3. Regras de correção de bugs

**R3.1 — Bug de padrão exige varredura completa.** Ao corrigir um erro que é um *padrão*
(nome de coluna errado, import errado, comparação de string), rodar
`grep -rn "<padrão>" src/` e corrigir TODAS as ocorrências, listando-as no PR. Corrigir só
as ocorrências conhecidas é meia-correção.
*Caso real: Sprint 10 corrigiu 3 de 9 ocorrências de `technicians(nome)`; as 6 restantes
mantiveram os bugs C2 e C4 do relatório de QA.*

**R3.2 — "Corrigido" só depois de verificado onde o bug foi reportado.** Bug reportado em
produção só está corrigido quando reproduzido o cenário em produção após deploy. Local
funcionando + typecheck verde ≠ corrigido. Até lá, o status é "correção aplicada, aguardando
verificação em prod".

**R3.3 — Reproduzir antes de corrigir.** Antes de alterar código por causa de um bug,
reproduzir o bug (ou localizar a evidência concreta — stack trace, response HTTP, query
falhando). Proibido corrigir por suposição de causa.
*Caso real: a "tela preta" do dashboard tinha 3 hipóteses; só o console em produção
(`Invalid Refresh Token: Already Used`) revelou a causa verdadeira.*

**R3.4 — Sintoma pattern-matched não é diagnóstico.** Se um sintoma "parece" um bug conhecido,
ainda assim confirmar com evidência antes de aplicar a correção conhecida — pode ter outra causa.

---

## 4. Regras de encerramento de fase e sprint

**R4.1 — Definition of Done é literal.** Cada item de DoD só é marcado quando a verificação
descrita nele foi EXECUTADA na sessão e a evidência (comando + saída resumida, URL testada,
print) foi colada na seção "Estado verificado" do doc da sprint. Proibido marcar por
inferência ("deve funcionar porque o código está certo").

**R4.2 — Sequência obrigatória de fechamento de fase:**
1. `pnpm typecheck` ✅
2. `pnpm lint` ✅
3. `pnpm test` ✅ (com nº de testes anotado)
4. Verificação manual no navegador do fluxo alterado
5. Atualizar "Estado verificado" no doc da sprint com data e evidências
6. Só então iniciar a próxima fase

**R4.3 — Uma fase por vez.** Não iniciar a fase N+1 com a fase N "quase pronta". Fase aberta
demais = contexto perdido = alucinação na retomada.

**R4.4 — Fim de sprint atualiza o roadmap.** Marcar status no `00-roadmap.md`, listar o que
ficou de fora e para onde foi (próxima sprint ou `tech-debt.md`).

---

## 5. Regras de escopo e dúvida

**R5.1 — Fora do escopo → `docs/tech-debt.md`.** Viu algo para melhorar fora da fase atual?
Anotar e seguir. Refactor de oportunidade é proibido (CLAUDE.md §6).

**R5.2 — Dúvida real → pergunta com opções.** Se uma decisão de domínio/arquitetura não está
documentada, parar e perguntar apresentando 2–3 opções concretas com trade-offs. Proibido
escolher silenciosamente e seguir.

**R5.3 — Não expandir a interpretação do pedido.** "Corrigir o bug X" não autoriza mudar
comportamento adjacente. Se a correção exigir mudança de comportamento visível, avisar antes.

---

## 6. Regras específicas deste projeto

**R6.1 — Dados de produção são sagrados.** Qualquer ação que altere dados em produção
(aprovar, rejeitar, classificar, recalcular, migrar) é listada ANTES da execução e registrada
DEPOIS (o quê, quantos registros, reversível ou não).

**R6.2 — Migrations só numeradas e via fluxo oficial.** Nada de `pnpm db:push`, nada de
alteração no painel Supabase. SQL em `supabase/migrations/NNNN_*.sql` é a fonte de verdade
(CLAUDE.md §6).

**R6.3 — Campo `sucesso` sempre via helper.** Comparação com `startsWith('sim')`
case-insensitive — nunca `=== 'Sim'` (CLAUDE.md §6).

**R6.4 — `redirect()` fora de try-catch, import estático** (CLAUDE.md §6).
*Caso real: o fallback de redirect mascarado contribuiu para o loop de login do QA de 02/07.*

**R6.5 — Strings vindas de planilha são suspeitas.** Até a Sprint 12 concluir a normalização
de encoding, todo código que compara strings de visita (finalidade, motivo, resultado) deve
normalizar antes de comparar — os dados em produção contêm mojibake ("InstalaÁ„o - Fibra - PF").

**R6.6 — Números vindos de planilha também são suspeitos.** O parser lê o xlsx com `raw: false`,
então **todo valor chega como string em locale que não controlamos**. Use sempre `parseBrNumber`
(`src/lib/etl/number.ts`), nunca `Number()` direto.
*Caso real (14/07): valores inflados ×100 em produção — "24100.10" (US) virava 2410010 porque o
ponto era tratado como separador de milhar. Exigiu re-upload do período; não há backfill possível.*

**R6.7 — Regra financeira nova exige ler a ordem de precedência antes.**
`buildPayoutUpsert` decide por saídas antecipadas; inserir uma condição no lugar errado muda
silenciosamente o valor de famílias inteiras de OS. Fonte de verdade:
[`docs/domain/03-payout.md`](../domain/03-payout.md#ordem-de-precedência-do-cálculo).
*Caso real (22/07): homologações pagando como instalação real (3x o correto) porque a finalidade
da Unetvale é a mesma — só a coluna Z distingue.*

**R6.8 — Ausência de erro não é prova de entrega.** Dois modos de falha silenciosa já
custaram sessões neste projeto: PostgREST devolvendo vazio em coluna com nome errado, e o
Supabase Realtime **não entregando eventos** quando a conexão não é autenticada
(`realtime.setAuth` antes do `subscribe`) — a RLS simplesmente não casa, sem erro.
Ao integrar qualquer canal novo, prove a entrega com um evento real, não com "não deu erro".

---

## Checklist rápido (colar no início de cada sessão de sprint)

```text
[ ] Li o doc da sprint atual + seção "Estado verificado"
[ ] git status / branch confirmada (nunca main)
[ ] Declarei sprint, fase e plano da sessão
[ ] Colunas de banco verificadas no schema (não de memória)
[ ] Bug: reproduzido/evidenciado antes de corrigir
[ ] Bug de padrão: grep completo em src/ + lista no PR
[ ] Toda query Supabase trata `error`
[ ] Números citados têm fonte da sessão
[ ] Fase fechada: typecheck + lint + test + verificação manual + doc atualizado
[ ] Fora de escopo anotado em tech-debt.md
[ ] Bug em produção: só "corrigido" após verificar em produção
```
