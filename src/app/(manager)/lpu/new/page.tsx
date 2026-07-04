import type { Metadata } from 'next'
import { CreateLpuForm } from './_components/CreateLpuForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Nova LPU' }

export default function NewLpuPage() {
  return <CreateLpuForm />
}
