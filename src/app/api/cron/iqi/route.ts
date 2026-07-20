import { NextResponse } from 'next/server'
import { runIqiCollection } from '@/lib/iqi'

// Endpoint de coleta agendada do IQI (ADR-012). Disparado 2x/dia pelo workflow
// .github/workflows/iqi-cron.yml (08:00 e 20:00 America/São_Paulo = 11:00/23:00 UTC).
// Exceção de estrutura de rotas justificada no ADR-012: cron não é página de usuário.
// Protegido por CRON_SECRET (o workflow envia `Authorization: Bearer <CRON_SECRET>`).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runIqiCollection()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, erro }, { status: 500 })
  }
}
