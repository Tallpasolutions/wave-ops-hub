# Guia 05 — Aprovar Fechamento

## O fluxo do fechamento mensal

O fechamento passa por 4 etapas obrigatórias:

```
Aberto → Aguardando Aprovação → Aprovado → Pago
```

Cada etapa é uma confirmação formal de que os dados estão corretos.

## 1. Verificar o fechamento

1. No menu lateral, clique em **Fechamento**
2. Localize o card do mês desejado (ex: "Abril 2026")
3. Clique no card para abrir o detalhe
4. Revise os KPIs: total a pagar, número de técnicos, visitas com e sem regra
5. Verifique se há payouts pendentes de revisão — resolva antes de prosseguir

## 2. Solicitar aprovação

Quando estiver satisfeito com os dados:

1. Na página do fechamento, clique em **Solicitar Aprovação**
2. O status muda para **Aguardando Aprovação**
3. O responsável pela aprovação (proprietário ou administrador Tallpa) será notificado

## 2.1. Conferência dos técnicos

Ao solicitar a aprovação, **cada técnico é notificado** e passa a ver as OSs do período no app para conferir. Na página do fechamento você acompanha o status de cada um:

- **Aprovado** — o técnico confirmou a pontuação do período.
- **Pendente** — ainda não respondeu. Gera alerta, mas **não impede** a aprovação.
- **Contestado** — discorda de uma ou mais OSs. **Impede** a aprovação até ser resolvido.

### Resolver uma contestação

As contestações abertas aparecem na página do fechamento, **agrupadas por técnico**. Em cada uma:

1. Leia o motivo informado pelo técnico e confira a OS.
2. Escreva a resposta (obrigatória).
3. **Opcionalmente, informe a nova pontuação.** Deixe em branco para manter o valor atual.
4. Confirme.

O que acontece: se você informou um valor diferente, ele é aplicado como **ajuste manual** naquela OS — fica registrado com seu nome, data e a resposta como justificativa, e não é desfeito por um novo upload da planilha. O técnico é notificado com a pontuação **antes → depois** e confere o período novamente.

> Um técnico também pode contestar uma OS **fora** da janela de fechamento, direto da lista de visitas dele. A contestação aparece aqui do mesmo jeito, e o período só pode ser aprovado depois de resolvida.

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
