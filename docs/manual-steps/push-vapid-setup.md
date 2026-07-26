# Configurar o Web Push (VAPID) do técnico

Passos manuais para o push com o app fechado funcionar em produção (ver
[ADR-018](../architecture/ADR-018-push-app-fechado.md)). Sem isso, o push cai em silêncio no
Realtime (degradação aceitável) — nada quebra, mas nenhum aviso chega com o app fechado.

---

## 1. Aplicar a migration

No **Supabase SQL Editor**, cole e rode o conteúdo de
[`supabase/migrations/0031_push_subscriptions.sql`](../../supabase/migrations/0031_push_subscriptions.sql).

Cria a tabela `push_subscriptions` (RLS `push_own`). Valide:

```sql
select count(*) from push_subscriptions;  -- deve responder 0, sem erro
```

## 2. Gerar as chaves VAPID (uma vez)

```bash
npx web-push generate-vapid-keys
```

Guarde a **Public Key** e a **Private Key**. A privada é segredo — nunca commite, nunca exponha ao
cliente. **Trocar as chaves depois invalida todas as inscrições existentes.**

## 3. Setar as variáveis de ambiente

Em `.env.local` (dev) **e na Vercel** (produção):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:suporte@tallpa.com.br
```

> ⚠️ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` é embutida em **build time**. Se você adicionar/alterar a env
> **depois** de um deploy, precisa **redeployar** — senão o valor fica `undefined` no cliente e a
> inscrição falha em silêncio (o card "Ativar avisos" não completa).

## 4. Validar ponta a ponta

1. Abra `wave.tallpa.com.br` logado como técnico (de preferência a PWA/APK instalada).
2. Toque em **"Ativar avisos"** → aceite a permissão. O card deve virar verde.
3. `select count(*) from push_subscriptions;` deve virar **1**.
4. Com o app **fechado**, dispare uma notificação real que passe por `notify.ts` (ex.: solicitar a
   conferência desse técnico, ou responder uma contestação dele). O push deve chegar.

## Como funciona (resumo)

- Inscrição por dispositivo em `push_subscriptions` (RLS `push_own`), gravada pela Server Action
  `src/app/(technician)/_actions/push.ts`.
- Envio em `src/lib/push/send.ts` (`server-only`, service role), disparado dentro de
  `src/lib/notifications/notify.ts` logo após o insert em `notifications` — best-effort, e remove
  inscrição inválida (resposta 404/410 do push service).
- Handlers `push`/`notificationclick` em `public/sw.js`.
