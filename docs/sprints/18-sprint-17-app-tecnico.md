# Sprint 17 — App do técnico (PWA + Push + APK)

**Período:** 2026-07-24 a 2026-07-25
**Status:** ✅ **Concluída** — tudo mergeado em `main` e em produção. APK gerado e distribuído por sideload.
**Origem:** O técnico opera em campo, no celular. Faltava (a) instalar a área do técnico como app,
(b) receber aviso com o app fechado (visita nova, resposta da Wave) e (c) um APK Android para
distribuir sem depender do navegador. Requisito do usuário: **manter o web rodando** e **sem app nativo**.
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

> Decisões do usuário (2026-07-24): push é essencial; distribuição por **APK sideload** (sem Play
> Store); **sem recursos nativos** (câmera/GPS) — só a tela atual. Isso definiu o caminho
> **PWA → Web Push → TWA/APK**, reaproveitando 100% do Next.js já no ar.

---

## Fase 1 — Fundação PWA

A área do técnico virou uma PWA instalável, sem novas dependências.

| Item | Artefatos |
|---|---|
| Manifest (`start_url:/`, standalone, portrait, cores `#050814`) | `src/app/manifest.ts` (rota `/manifest.webmanifest`) |
| Service worker: **network-first** na navegação + fallback `/offline.html`; cache só de assets estáticos; **nunca cacheia HTML autenticado nem Supabase** (dados por RLS) | `public/sw.js`, `public/offline.html` |
| Ícones da marca Wave Co. (onda + "WAVE CO." sobre branco), extraídos do logo por filtro de componentes conexos (remove anel pontilhado e tagline) | `public/icons/` (192/512/maskable/apple), `public/brands/wave/logo-source.jpeg` |
| Registro do SW + metatags (theme-color, apple-web-app, viewport) | `src/components/ServiceWorkerRegister.tsx`, `src/app/layout.tsx` |
| Middleware ignora `sw.js`/`manifest`/`icons`/`offline` (sessão expirada não redireciona o SW para o login) | `src/middleware.ts` |

## Fase 2 — Push com o app fechado ([ADR-018](../architecture/ADR-018-push-app-fechado.md))

Complementa o Realtime do ADR-017 (que só entrega com o app aberto). **Transporte: Web Push + VAPID**
(lib `web-push`), **não FCM** — FCM só valeria com app nativo. **Ponto único preservado:** o push
sai de dentro de `notify.ts`, logo após o insert em `notifications`.

| Item | Artefatos |
|---|---|
| Tabela de inscrições por dispositivo (RLS `push_own`, `tenant_id` nullable p/ tallpa_owner) | migration `0031`, `src/db/schema/push-subscriptions.ts` |
| Envio server-side (best-effort, remove inscrição 404/410) | `src/lib/push/send.ts` |
| Inscrição no cliente (permissão + PushManager) | `src/lib/push/subscribe.ts` |
| Server Action de gravar/remover inscrição (client autenticado, RLS garante o próprio `user_id`) | `src/app/(technician)/_actions/push.ts` |
| Handlers `push`/`notificationclick` no SW | `public/sw.js` |
| Card "Ativar avisos" na home (pede permissão só por gesto) | `src/app/(technician)/_components/EnablePushCard.tsx` |
| Disparo do push no ponto único | `src/lib/notifications/notify.ts` |

**Passos manuais (do usuário):** aplicar migration `0031`; gerar chaves VAPID
(`npx web-push generate-vapid-keys`) e setar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` na Vercel (build time!). Ver [`manual-steps/push-vapid-setup.md`](../manual-steps/push-vapid-setup.md).

## Fase 3 — Empacotar como APK (TWA)

APK Android por sideload, empacotado com PWABuilder (Trilha A do runbook). O APK é uma casca que
abre `wave.tallpa.com.br` em tela cheia.

| Item | Artefatos |
|---|---|
| Digital Asset Links (vínculo app↔domínio, remove a barra de URL) | `public/.well-known/assetlinks.json` |
| Middleware libera `.well-known/` | `src/middleware.ts` |
| Config do Bubblewrap (`enableNotifications: true` p/ o push funcionar no APK) | `twa/twa-manifest.json` |
| Runbook (PWABuilder e Bubblewrap, keystore, fingerprint, sideload, updates) | [`manual-steps/apk-tecnico-twa.md`](../manual-steps/apk-tecnico-twa.md) |

**`packageId` = `br.com.tallpa.wave.twa`** (padrão gerado pelo PWABuilder). O `assetlinks.json` teve
de ser corrigido para casar com esse id — o Digital Asset Links casa por `package_name` **+**
fingerprint. A keystore de assinatura fica com o usuário (segredo; `.gitignore` bloqueia).

## Correção de UI

- **Dropdown de notificações vazava da tela no mobile:** a sineta não fica na borda da tela (há
  "ER"/"Sair" à direita), então o painel `w-80` ancorado por `right-0` empurrava a borda esquerda
  para fora da viewport. Agora usa `position: fixed` ancorado à viewport no mobile e mantém o
  `absolute right-0` em `sm+`. `src/components/NotificationBell.tsx`.

---

## Validação em produção

- PWA: `manifest.webmanifest` válido (3 ícones), SW **v2** ativado (scope `/`) com handlers de push.
- Migration `0031` aplicada (`select count(*) from push_subscriptions` responde sem erro).
- Assetlinks servido em `https://wave.tallpa.com.br/.well-known/assetlinks.json` com o `package_name`
  e o fingerprint reais.
- APK instalado e distribuído por sideload.

## Ficou para depois

- Teste ponta-a-ponta da **entrega** do push com técnico real ativando o card e recebendo com o app
  fechado (a infra está validada; falta o disparo real observado).
- **WhatsApp** como canal de notificação segue fora do escopo.
- Publicação na Play Store (hoje é sideload) — só se houver demanda.
