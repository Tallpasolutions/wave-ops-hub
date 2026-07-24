# Guia 02 — Upload de Planilha

## Formato esperado

A planilha deve estar no formato `.xlsx` (Excel) com as seguintes colunas obrigatórias:

| Coluna | Descrição |
|---|---|
| Data | Data de execução da visita (DD/MM/AAAA) |
| Inicio | Horário de início |
| OS | Número da Ordem de Serviço |
| Usuario | Identificação do cliente |
| Contrato | Número do contrato |
| Finalidade | Tipo de serviço (ex: Instalação, Suporte Fibra) |
| TipoAtendimento | Externo, Interno, etc. |
| Cidade | Cidade do atendimento |
| Tecnico | Nome do técnico responsável |
| Sucesso | "Sim" se resolvida, "Não" se improdutiva |
| Improdutiva | Motivo da não-conclusão (quando Sucesso = Não) |
| Valor | Valor recebido pela Unetvale |
| ExplicacaoValor | Descrição do valor |

## Passo a passo para enviar

1. No menu lateral, clique em **Uploads**
2. Clique em **Nova Planilha**
3. Arraste o arquivo `.xlsx` para a área indicada ou clique para selecionar
4. Verifique que o nome do arquivo apareceu na tela
5. Clique em **Enviar planilha**
6. Aguarde o processamento (pode levar alguns segundos)

## Significado dos status

| Status | Significado |
|---|---|
| Processando | A planilha está sendo lida e os dados inseridos |
| Concluído | Processamento finalizado com sucesso |
| Erro | Ocorreu uma falha — veja o log de erros na página do upload |
| Duplicata | Este arquivo já foi enviado anteriormente |

## O que fazer se o upload retornou Erro

1. Abra o upload clicando nele na lista
2. Leia a mensagem de erro exibida
3. Corrija o arquivo (colunas faltando, formato de data incorreto, etc.)
4. Faça um novo upload com o arquivo corrigido

## Idempotência

O sistema detecta automaticamente arquivos idênticos pelo conteúdo. Se você tentar enviar o mesmo arquivo duas vezes, ele será reconhecido como duplicata e não criará registros duplicados.

A deduplicação também vale **linha a linha**: reenviar uma planilha com linhas já ingeridas não duplica nada — essas linhas são contadas como **ignoradas**, e apenas as novas ou alteradas são gravadas.

## Reprocessar × Corrigir status

Na página do upload há duas ações parecidas, com efeitos bem diferentes:

- **Reprocessar** — roda a ingestão de novo a partir do arquivo, atualizando dados e payouts. É o que você quer na maioria dos casos.
- **Corrigir status** — só aparece em uploads travados em "pendente"/"processando" e apenas acerta o status e os contadores. **Não reprocessa a planilha nem recalcula payouts.**

Há também **Recalcular payouts**, que reaplica as regras sobre as visitas já ingeridas — use depois de classificar motivos, ajustar a LPU ou cadastrar valores de homologação/cabeamento.

## Visitas fora do escopo

Visitas de finalidades de **infraestrutura** (manutenção de rede, troca de poste, massiva, etc.) são marcadas como fora do escopo na ingestão: **não geram pagamento ao técnico** e não entram nos indicadores operacionais. Elas aparecem no upload como processadas, mas não no fechamento — é o comportamento esperado.

## Se um valor parecer errado

Valores monetários vêm da planilha como texto formatado e já causaram erro de escala em produção (julho/2026). Se um total parecer muito acima ou abaixo do esperado, compare uma OS específica com a planilha antes de aprovar o fechamento — e reporte ao suporte, porque a correção pode exigir reenviar a planilha do período.
