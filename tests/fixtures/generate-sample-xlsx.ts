import * as XLSX from 'xlsx'
import { resolve } from 'path'
import { existsSync } from 'fs'

const OUTPUT_PATH = resolve(__dirname, 'sample.xlsx')

export default async function globalSetup() {
  if (existsSync(OUTPUT_PATH)) return

  const rows = [
    {
      Data: '15/01/2026',
      Inicio: '08:00',
      OS: 'E2E-001',
      Usuario: 'Cliente Teste',
      Contrato: '999001',
      Finalidade: 'Instalação',
      TipoAtendimento: 'Externo',
      Cidade: 'São Paulo',
      Tecnico: 'Tecnico E2E',
      Sucesso: 'Sim',
      Improdutiva: '',
      Valor: 150,
      ExplicacaoValor: 'Instalação concluída',
    },
    {
      Data: '15/01/2026',
      Inicio: '10:00',
      OS: 'E2E-002',
      Usuario: 'Cliente Teste 2',
      Contrato: '999002',
      Finalidade: 'Manutenção',
      TipoAtendimento: 'Externo',
      Cidade: 'São Paulo',
      Tecnico: 'Tecnico E2E',
      Sucesso: 'Não',
      Improdutiva: 'Sim',
      Valor: 0,
      ExplicacaoValor: 'Cliente ausente',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha')
  XLSX.writeFile(wb, OUTPUT_PATH)

  console.log(`[globalSetup] sample.xlsx gerado em: ${OUTPUT_PATH}`)
}
