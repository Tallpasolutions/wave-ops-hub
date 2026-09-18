# Reversão de migrations

> Este diretório **não é varrido por nenhum runner**. Os arquivos aqui só rodam se alguém
> colar o conteúdo deliberadamente no SQL Editor do Supabase.

## Por que não fica em `supabase/migrations/`

O CLI da Supabase varre `migrations/`. Um `.down.sql` lá dentro é um acidente esperando
acontecer. E um bloco comentado no fim da própria migration seria pior: sob pressão de
incidente, bloco comentado convida a copiar metade dele, e é invisível para review, diff e
CI. Um arquivo real é revisável, grepável e colável inteiro.

As migrations em `supabase/migrations/` continuam **forward-only e idempotentes**, com os
SELECTs de conferência no fim — a convenção do projeto não muda. O que está aqui é
artefato operacional, não migration.

## Os níveis de reversão

Quase todo incidente se resolve **sem** tocar nestes arquivos.

| Nível | O que é | Perde dado? |
|---|---|---|
| **1** | Desligar a feature flag do módulo em `tenants.config` | **Não** |
| **1.5** | Reverter o deploy do código. As tabelas ficam órfãs e inertes | **Não** |
| **2** | Rodar o `.down.sql` correspondente | **Sim, irreversivelmente** |

**O nível 1 é a reversão de incidente.** O nível 2 só existe para o caso de a decisão ser
remover o módulo do produto.

## Arquivos

| Arquivo | Reverte | Nível 1 correspondente |
|---|---|---|
| [`0042_supervisao_campo.down.sql`](./0042_supervisao_campo.down.sql) | [0042](../migrations/0042_supervisao_campo.sql) — módulo Supervisão de Campo (ADR-022) | `tenants.config.supervisao_campo_habilitada = false` |

## Antes de rodar qualquer coisa daqui

1. Snapshot do projeto Supabase.
2. Exportar o que for do Storage, se houver chance de precisarem.
3. Rodar o passo 0 do arquivo, que mostra **o que exatamente será perdido**.
4. Aplicar **statement a statement**, conferindo cada um.
