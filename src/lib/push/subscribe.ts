// Helpers de inscrição de Web Push no lado do cliente — ADR-018.
// Sem 'server-only' nem web-push: roda no browser. A chave pública VAPID vem de
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (pública por definição).

export type SerializedPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

// VAPID base64url → Uint8Array (formato exigido por applicationServerKey).
// Aloca um ArrayBuffer explícito para o tipo casar com BufferSource (TS 5.7+).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function serialize(sub: PushSubscription): SerializedPushSubscription | null {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Pede permissão (se preciso), assina o PushManager e devolve a inscrição
// serializada. Retorna null se não suportado, permissão negada ou sem chave.
export async function subscribeToPush(): Promise<SerializedPushSubscription | null> {
  if (!pushSupported()) return null
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  return serialize(sub)
}

export async function getExistingSubscription(): Promise<SerializedPushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? serialize(sub) : null
}
