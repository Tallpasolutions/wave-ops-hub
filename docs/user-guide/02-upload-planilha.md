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
