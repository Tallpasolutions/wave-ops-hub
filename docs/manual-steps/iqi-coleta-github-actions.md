# Passo manual — Coleta do IQI no GitHub Actions

> Configuração fora do código, necessária para a tela **Produtividade** funcionar.
> Contexto e decisão em [ADR-012](../architecture/ADR-012-iqi-ingestao-scraping.md).

## Por que a coleta não roda no app

A Unetvale bloqueia os IPs de datacenter da Vercel: **100% das requisições estouram o timeout**.
O runner do GitHub alcança `os.unetvale.com.br` em menos de 1 segundo. Por isso o scraping roda em
`.github/workflows/iqi-cron.yml` → `scripts/collect-iqi.ts`, gravando direto no Supabase com
service role. O app apenas **dispara** o workflow.

Não tente mover isso de volta para a Vercel — já foi testado e não funciona.

## 1. GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Valor |
|---|---|
| `UNETVALE_USER` | usuário de serviço no sistema da Unetvale |
| `UNETVALE_PASSWORD` | senha correspondente |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase de produção |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key do mesmo projeto |

Sem os dois primeiros o workflow falha no login; sem os dois últimos ele coleta e não grava.

## 2. Token do botão "Sincronizar" (Vercel)

Crie um **fine-grained PAT** no GitHub com acesso **apenas a este repositório** e a permissão
**Actions: write** (é o mínimo para `workflow_dispatch`). Configure na Vercel como:

```
GITHUB_DISPATCH_TOKEN=<o PAT>
```

Sem ele, o botão responde "Sincronização não configurada" — o **agendamento automático continua
funcionando**, porque não depende do app.

## 3. Agendamento

Já definido no workflow: `0 11,23 * * *` (UTC) = **08:00 e 20:00** no horário de Brasília.

Duas observações do GitHub Actions que valem lembrar:
- agendamentos só disparam a partir da **branch default** (`main`);
- podem atrasar alguns minutos sob carga — aceitável para uma coleta 2x/dia.

## 4. Pré-requisito de dados

Cada técnico precisa do **`codigo_unetvale`** preenchido em `technicians`. Técnicos sem código são
reportados na coleta e ficam de fora — não quebram a execução.

Migrations relacionadas: `0021_seed_codigo_unetvale.sql` e `0024_fix_codigo_unetvale_prefixo.sql`.

## Como verificar que está funcionando

1. Aba **Actions** do repositório → workflow "IQI Cron" → última execução verde.
2. Na tela `/produtividade`, a **data da última sincronização** deve refletir a execução.
3. Conferência cruzada: o `pct_reincidencia` de um técnico/mês deve bater com o número exibido no
   próprio sistema da Unetvale.
