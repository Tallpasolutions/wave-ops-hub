'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'
import {
  pushSupported,
  subscribeToPush,
  getExistingSubscription,
} from '@/lib/push/subscribe'
import { savePushSubscription } from '../_actions/push'

type State = 'checking' | 'hidden' | 'prompt' | 'enabling' | 'enabled' | 'denied' | 'error'

// Card de ativação de Web Push (ADR-018). Só aparece quando faz sentido: navegador
// suportado e permissão ainda não concedida. Nunca pede permissão sem gesto — o
// clique no botão é o gatilho (pedir no load faz o usuário negar para sempre).
export function EnablePushCard() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    if (!pushSupported()) {
      setState('hidden')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    if (Notification.permission === 'granted') {
      // Já concedido: garante que a inscrição existe e está salva, sem mostrar card.
      getExistingSubscription()
        .then((sub) => {
          if (sub) return savePushSubscription(sub)
        })
        .catch(() => {})
      setState('hidden')
      return
    }
    setState('prompt')
  }, [])

  async function handleEnable() {
    setState('enabling')
    try {
      const sub = await subscribeToPush()
      if (!sub) {
        setState(Notification.permission === 'denied' ? 'denied' : 'prompt')
        return
      }
      const res = await savePushSubscription(sub)
      setState(res.ok ? 'enabled' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'checking' || state === 'hidden') return null

  if (state === 'enabled') {
    return (
      <div
        className="mb-4 flex items-center gap-3 rounded-xl border p-3"
        style={{
          background: 'linear-gradient(135deg, rgba(46,230,168,0.12), rgba(46,230,168,0.05))',
          borderColor: 'rgba(46,230,168,0.25)',
        }}
      >
        <Check size={16} className="text-[var(--green)]" />
        <p className="text-[12px] text-[var(--text-2)]">
          Avisos ativados neste dispositivo.
        </p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
        <BellOff size={16} className="shrink-0 text-[var(--text-3)]" />
        <p className="text-[12px] text-[var(--text-3)]">
          Notificações bloqueadas. Libere nas configurações do navegador para receber avisos.
        </p>
      </div>
    )
  }

  const enabling = state === 'enabling'
  return (
    <button
      onClick={handleEnable}
      disabled={enabling}
      className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left disabled:opacity-60"
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(30,107,255,0.05))',
        borderColor: 'rgba(0,212,255,0.25)',
      }}
    >
      <div className="flex items-center gap-3">
        <Bell size={18} className="text-[var(--cyan)]" />
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Ativar avisos</p>
          <p className="text-[11px] text-[var(--text-3)]">
            {state === 'error'
              ? 'Não deu certo. Toque para tentar de novo.'
              : 'Receba visita nova e resposta da Wave mesmo com o app fechado'}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-[var(--cyan)]">
        {enabling ? 'Ativando…' : 'Ativar'}
      </span>
    </button>
  )
}
