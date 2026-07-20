# Guia 05 — Aprovar Fechamento

## O fluxo do fechamento mensal

O fechamento passa por 4 etapas obrigatórias:

```
Aberto → Aguardando Aprovação → Aprovado → Pago
```

Cada etapa é uma confirmação formal de que os dados estão corretos.

## 1. Verificar o fechamento

1. No menu lateral, abra **Financeiro** → clique em **Fechamento**
2. Localize o card do mês desejado (ex: "Abril 2026")
3. Clique no card para abrir o detalhe
4. Revise os KPIs: total a pagar, número de técnicos, visitas com e sem regra
5. Verifique se há payouts pendentes de revisão — resolva antes de prosseguir

## 2. Solicitar aprovação

Quando estiver satisfeito com os dados:

1. Na página do fechamento, clique em **Solicitar Aprovação**
2. O status muda para **Aguardando Aprovação**
3. O responsável pela aprovação (proprietário ou administrador Tallpa) será notificado

## 3. Aprovar o fechamento

Disponível para **Proprietário** (`tenant_owner`) e **Admin Tallpa** (`tallpa_owner`):

1. Abra o fechamento em status "Aguardando Aprovação"
2. Revise os valores finais
3. Clique em **Aprovar Fechamento**
4. O status muda para **Aprovado**

Os técnicos recebem uma notificação de que o fechamento foi aprovado.

## 4. Marcar como pago

Após realizar os pagamentos fora do sistema:

1. Abra o fechamento aprovado
2. Clique em **Marcar como Pago**
3. O status muda para **Pago** — ciclo encerrado

Os técnicos recebem notificação de pagamento.

## Exportar relatórios

Na página do fechamento, use os botões de exportação:

- **Excel** — planilha com 3 abas: resumo consolidado, detalhe por visita, resumo por técnico
- **PDF Consolidado** — relatório de todos os técnicos em um único arquivo
- **PDF Individual** — um PDF por técnico (acesse pelo nome do técnico na tabela)

## Reabrir um fechamento

Fechamentos aprovados ou pagos só podem ser reabertos pelo administrador Tallpa. Entre em contato com o suporte se necessário.
