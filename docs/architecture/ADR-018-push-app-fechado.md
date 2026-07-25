# ADR-018 — Notificação push com o app fechado (Web Push + VAPID)

**Status:** Proposto
**Data:** 2026-07-24
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** A PWA do técnico (Fase 1, branch `chore/pwa-tecnico`) tornou a área do técnico
instalável como app. Falta o que um app de campo exige: **ser avisado sem estar com o app aberto**
— visita nova, período liberado para conferência, resposta da Wave a uma contestação. Hoje a
entrega ao vivo do [ADR-017](./ADR-017-notificacoes-realtime.md) depende de um WebSocket ativo, ou
seja, do app em primeiro plano.

## Contexto

O [ADR-017](./ADR-017-notificacoes-realtime.md) resolveu **duas** coisas: escrita cross-user
(service role em `src/lib/notifications/notify.ts`) e entrega ao vivo (Supabase Realtime na tabela
`notifications`). Mas o Realtime só entrega enquanto a página está aberta e conectada — com o app
fechado ou em segundo plano, o WebSocket cai e nada chega. O próprio ADR-017 deixou "e-mail/WhatsApp"
no roadmap; push nativo do navegador não estava previsto porque ainda não havia app instalável.

Com a PWA/TWA no ar, existe o canal certo: o **Web Push**, entregue pelo push service do navegador
(no Android/TWA, o do Chrome) para o service worker `/sw.js` **mesmo com o app fechado**.

Restrições do projeto que pesam na decisão:
- CLAUDE.md §3: não trocar/adicionar libs sem ADR. Enviar push do servidor exige **uma** dependência.
- CLAUDE.md §6: não inserir em `notifications` direto; tudo passa por `notify.ts`. O push tem de
  entrar **no mesmo ponto**, não abrir um segundo caminho de notificação.
- CLAUDE.md §6: nada de credencial server-side exposta ao cliente. A chave privada de push é secreta.
- Não burlar RLS: a tabela de inscrições tem de ser por usuário, como `notifications`.

## Decisão

### 1. Transporte: Web Push padrão (W3C) com VAPID — sem Firebase

O envio usa **Web Push com chaves VAPID**, pela biblioteca [`web-push`](https://www.npmjs.com/package/web-push)
no servidor (única dependência nova, justificada aqui). O navegador do técnico gera uma
`PushSubscription` (endpoint + chaves `p256dh`/`auth`); o servidor assina o envio com a chave VAPID
privada e o push service entrega ao `/sw.js`.

**Por que não FCM (Firebase):** para PWA/TWA (Chrome), o Web Push com VAPID entrega exatamente o
mesmo resultado sem projeto Firebase, sem SDK do Google e sem um token proprietário a mais para
gerenciar. FCM só passa a valer se o app virar **nativo** (Capacitor/React Native), onde o token de
device do FCM é o caminho — e o próprio usuário definiu "sem recursos nativos, só a tela atual". Fica
como caminho de migração documentado, não como escolha agora.

### 2. Tabela `push_subscriptions` (migration `0031`)

Uma inscrição por navegador/dispositivo, ligada ao `users.id` (não `technician_id` — é usuário
autenticado, mesma entidade da RLS de `notifications`; ver a armadilha do ADR-013/017):

```
push_subscriptions
  id           uuid pk
  tenant_id    uuid not null → tenants(id)   -- tallpa_owner pode ter tenant_id null (ver nota)
  user_id      uuid not null → users(id) on delete cascade
  endpoint     text not null unique          -- identidade da inscrição no push service
  p256dh       text not null
  auth         text not null
  user_agent   text
  created_at   timestamptz not null default now()
  last_seen_at timestamptz not null default now()
```

- RLS espelhando `notif_own`: `user_id = auth.uid() OR is_tallpa_owner()`. O técnico só enxerga/
  gerencia as próprias inscrições; a leitura para envio é pelo **service role** (server-only), como
  em `notify.ts`.
- `endpoint` único: reinscrição do mesmo device faz `upsert on conflict (endpoint)`, sem duplicar.
- Sobre `tenant_id`: `notifications` exige `tenant_id NOT NULL`; para o `tallpa_owner` (sem tenant)
  a coluna será **nullable** aqui, diferente de `notifications`. Decisão consciente para não travar
  o operador Tallpa.

### 3. Service worker: handlers `push` e `notificationclick`

O `/sw.js` da Fase 1 ganha dois handlers, sem tocar na estratégia de cache existente:
- `push`: lê o JSON do payload (`{ title, body, link }`) e chama `showNotification` com o ícone da
  marca (`/icons/icon-192.png`).
- `notificationclick`: fecha a notificação e foca uma aba já aberta do app ou abre `link`.

### 4. Cliente: permissão no momento certo + registro da inscrição

Um componente client na **área do técnico** (não no load global) pede `Notification.requestPermission()`
a partir de um gesto do usuário (ex.: card "Ativar avisos"), assina o `PushManager` com a chave VAPID
pública (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) e envia a inscrição a uma Server Action que faz o upsert em
`push_subscriptions`. Pedir permissão sem gesto e no load é o anti-padrão que faz o usuário negar para
sempre — por isso o gatilho é explícito e só para o papel técnico.

### 5. Integração: mesmo ponto único (`notify.ts`)

`notify.ts` ganha um `sendWebPush(userIds, payload)` chamado **logo após** o insert em `notifications`,
dentro de `notifyManagers`/`notifyTechnician`. Assim todo ponto de notificação já existente
(`aprovacoes/actions.ts`, `fechamento/actions.ts`) passa a mandar push **sem alteração** — é o mesmo
funil. O envio é **best-effort**: falha de push nunca quebra a escrita de domínio nem o insert em
`notifications` (try/catch que engole e loga). Inscrição inválida (resposta `404`/`410` do push
service) é **removida** da tabela na hora.

### 6. Chaves VAPID em env (segredo server-only)

- `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (mailto/URL): **server-only**, nunca no bundle client.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: pública por definição, exposta ao cliente para a inscrição.
- Geradas uma vez (`web-push generate-vapid-keys`) e postas nas envs da Vercel + `.env.local`.
  Trocar a chave invalida todas as inscrições — documentado para não rotacionar sem querer.

## Considerados e rejeitados

- **FCM / Firebase Cloud Messaging.** Mesmo resultado no web com mais peso (projeto Google, SDK,
  token proprietário). Só vale se houver app nativo depois. Adiado, não descartado.
- **Serviço de terceiros (OneSignal etc.).** Manda dado de notificação e inscrição do técnico para
  fora, dependência externa e custo — desproporcional para o escopo.
- **Só manter o Realtime do ADR-017.** Não resolve o caso central (app fechado); é o motivo do ADR.
- **E-mail/WhatsApp agora.** Canal diferente e mais lento; segue no roadmap. Push é o encaixe
  nativo para "app do técnico".
- **Guardar a inscrição por `technician_id`.** Repetiria o bug do ADR-013 (técnico ≠ usuário). A
  inscrição é do **usuário autenticado**; a resolução técnico→usuário continua só em `notify.ts`.

## Consequências

- **Nova dependência:** `web-push` (envio server-side). Justificada por este ADR (CLAUDE.md §3).
- **Novas envs:** `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **iOS:** Web Push no iOS só funciona com a PWA **instalada** (iOS 16.4+). O alvo definido é APK
  Android (Chrome), onde funciona bem; iOS fica como bônus condicional, não requisito.
- **Inscrições expiram.** O código trata `404/410` removendo a linha; sem isso a tabela acumula
  endpoints mortos e cada envio tenta em vão.
- **Push é best-effort e depende de rede/permissão.** Sem permissão ou sem rede, cai no
  comportamento do ADR-017 (sineta ao navegar) — degradação silenciosa e aceitável, como já é lá.
- **Ponto único preservado.** Continua valendo: novo ponto de notificação usa `notify.ts`, e agora
  ganha push de graça. Inserir em `notifications` direto continua proibido.
- **Migration `0031_push_subscriptions.sql`** aplicada manualmente (CLAUDE.md §6, sem `db:push`).
