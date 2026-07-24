# ADR-017 — Notificações cross-user e entrega em tempo real (Supabase Realtime)

**Status:** Aceito (implementado)
**Data:** 2026-07-22
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** O fluxo de conferência do técnico ([ADR-013](./ADR-013-aprovacao-contestacao-tecnico.md))
tornou a notificação parte do caminho crítico: se a contestação do técnico ou a resposta da Wave
não chegam, o ciclo trava. A sineta só atualizava com refresh da página, e o `tallpa_owner`
(que opera junto com a Wave) não recebia nada.

## Contexto

`notifications` já existia desde a Sprint 4, mas com três limitações que só apareceram quando o
fluxo passou a depender dela:

1. **Escrita cross-user bloqueada pela RLS.** A policy `notif_own` restringe a linha ao dono
   (`user_id = auth.uid()`). Um técnico contestando precisa inserir notificação para os *gestores* —
   o client autenticado do técnico não consegue.
2. **Sem entrega ao vivo.** A sineta era montada no Server Component; nova notificação só aparecia
   no próximo carregamento de página.
3. **`tallpa_owner` fora do alcance.** Ele não tem `tenant_id`, então uma consulta de gestores
   filtrada por tenant nunca o incluía.

## Decisão

### 1. Inserts cross-user pelo service role, em um único módulo

`src/lib/notifications/notify.ts` (`server-only`) concentra `notifyManagers` e `notifyTechnician`
usando o **admin client**. As gravações de **domínio** (contestação, revisão, payout) continuam
pelo client autenticado, com RLS aplicada — apenas a notificação usa elevação, que é o mínimo
necessário e fica isolado em um arquivo server-only.

- `notifyTechnician` resolve `users.id` a partir de `technician_id` (eram entidades diferentes —
  usar `technician_id` como `user_id` era o bug original do ADR-013).
- `notifyManagers` notifica `tenant_owner` + `tenant_manager` do tenant **e** todo `tallpa_owner`
  (sem `tenant_id`), deduplicando por id.

### 2. Entrega ao vivo por Supabase Realtime na própria tabela

A migration `0027_notifications_realtime.sql` adiciona `public.notifications` à publicação
`supabase_realtime` (idempotente). O `NotificationBell` (client component) assina o canal
`notif:<userId>` com filtro `user_id=eq.<userId>` no evento `INSERT` e mescla o que chega ao
estado vindo do servidor, deduplicando por `id`.

**A conexão Realtime precisa ser autenticada.** Sem `supabase.realtime.setAuth(access_token)`
antes do `subscribe()`, a conexão é anônima, `auth.uid()` é nulo, a RLS `notif_own` não casa e o
Postgres simplesmente **não entrega** os eventos — sem erro visível. Por isso:

- `setAuth` é chamado com o token da sessão **antes** de assinar o canal;
- `onAuthStateChange` reaplica o token em refresh, para não perder entrega em sessão longa.

### 3. Leitura das contestações agrupada por técnico no fechamento

Do lado da Wave, `/fechamento/[periodo]` lista as contestações abertas **agrupadas por técnico**
(cabeçalho com nome + contagem, OSs indentadas). A notificação avisa; a triagem acontece na tela,
onde a unidade de trabalho da Wave é o técnico, não a OS solta.

## Considerados e rejeitados

- **Polling na sineta (setInterval + refetch).** Mais simples, mas gera carga constante por usuário
  logado e ainda assim tem latência. O Realtime já vem no Supabase, sem lib nova (CLAUDE.md §3).
- **Broadcast/canal próprio em vez de `postgres_changes`.** Exigiria publicar o evento em cada
  ponto de escrita e manter os dois caminhos em sincronia; ouvir a tabela mantém uma fonte só.
- **Desligar a RLS de `notifications` para o Realtime funcionar sem token.** Inaceitável —
  vazaria notificação entre usuários e tenants (CLAUDE.md §6).
- **Notificar por e-mail/WhatsApp nesta etapa.** Fora de escopo; segue no roadmap.

## Consequências

- Notificação passa a ter **duas** classes de escrita no código: domínio (client autenticado) e
  notificação (service role, server-only). Qualquer novo ponto de notificação deve usar
  `notify.ts` — não inserir em `notifications` direto.
- A sineta depende de WebSocket. Sem ele (rede restritiva), a UI continua correta, só volta ao
  comportamento antigo (atualiza ao navegar) — degradação silenciosa e aceitável.
- Toda tabela que venha a precisar de Realtime precisa de duas coisas: entrar na publicação
  **e** ter o token setado no client. Documentado aqui para não se repetir o diagnóstico.
- Adicionar `tallpa_owner` significa que o operador Tallpa recebe notificação de **todos** os
  tenants. Com um tenant é o desejado; com vários, revisar (possível filtro por tenant favorito).
