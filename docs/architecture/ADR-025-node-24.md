# ADR-025 — Runtime Node.js 24

**Status:** Aceito
**Data:** 2026-11-03
**Decisores:** Jhoni Cleyton (Tallpa)
**Atualiza:** a linha de runtime da stack travada (`CLAUDE.md` §3, antes Node.js 20.x)

---

## Contexto

A Vercel desativou o Node 20 para builds e funções em 1º de outubro de 2026. Como o `package.json`
fixa `engines.node` em `20.x`, todo deploy novo falha em cerca de 1 segundo, antes de o build
começar. O que já está no ar não foi afetado, e por isso o problema só apareceu no primeiro deploy
depois dessa data, em 03/11/2026. A Vercel aceita hoje 22.x, 24.x e 26.x.

## Decisão

Usar **Node 24.x** no `package.json` e no CI. O `engines` do `package.json` tem precedência sobre a
configuração do projeto na Vercel, então ele continua sendo a fonte da versão.

## Considerados e rejeitados

- **Node 26 (padrão da Vercel e versão sugerida no erro):** é a mais nova das três. Não há
  ganho concreto para este projeto que justifique assumir a versão menos rodada.
- **Node 22:** é a mais antiga das três e levaria a repetir esta troca mais cedo.

## Verificação

No Node 24.22.2, localmente: typecheck, `pnpm test` e `pnpm build`. O deploy de preview da Vercel é
a prova final, porque ela roda o build no ambiente real.

## Consequências

- Quem desenvolve precisa do Node 24 na máquina.
- `.github/workflows/iqi-cron.yml` segue em Node 22 de propósito: a coleta do IQI tem versão própria
  (ADR-012) e não passa pela Vercel.
- Branches abertas antes desta troca precisam incorporar a `main` para conseguir fazer deploy.
