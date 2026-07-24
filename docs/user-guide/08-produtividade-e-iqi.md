# Guia 08 — Produtividade e IQI

## O que é o IQI

O **IQI** é o índice de reincidência calculado **pela Unetvale**: o percentual de contratos atendidos que voltaram a abrir uma OS. Quanto menor, melhor a qualidade do atendimento.

O Wave Ops Hub **não calcula** esse número — ele é lido do sistema da Unetvale e guardado por técnico e mês de competência. Por isso a tela sempre mostra a **data da última sincronização**: o valor é "as-of" essa data.

## Onde ver

No menu lateral, **Produtividade**. A tela reúne:

- **Tendência do IQI** — evolução mês a mês, por técnico e da equipe.
- **Tabela por técnico** — IQI e métricas internas do período (volume, sucesso, improdutivas).
- **Filtro por técnico** — para isolar um profissional.
- **Botão Sincronizar** — dispara uma coleta sob demanda.

## Como a sincronização funciona

A coleta roda **automaticamente duas vezes por dia**, às 08:00 e às 20:00 (horário de Brasília).

O botão **Sincronizar** dispara uma coleta extra. Ela é **assíncrona**: a coleta roda fora do site e leva alguns minutos. A tela não trava esperando — recarregue depois de alguns minutos para ver o resultado atualizado (a data de sincronização muda quando terminar).

> **Por que assim:** a Unetvale bloqueia os endereços de rede do servidor do site. A coleta roda em outra infraestrutura (GitHub Actions), que consegue acessar o sistema da Unetvale.

## Requisito: código Unetvale do técnico

Um técnico só aparece no IQI se tiver o **código da Unetvale** preenchido no cadastro (`/equipe/tecnicos`). Técnicos sem código são reportados na coleta e simplesmente ficam de fora — não quebram a sincronização.

Se um técnico novo não aparece na tela de produtividade, esse é o primeiro item a conferir.

## O que o técnico vê

Cada técnico vê **apenas o próprio IQI** e as próprias métricas, na aba **IQI** do app. Ninguém vê o índice de outro técnico.

## Quando o número não bate com a Unetvale

O IQI é uma fotografia do momento da coleta. Se o valor na tela diverge do que a Unetvale mostra agora:

1. Confira a data da última sincronização.
2. Clique em **Sincronizar** e aguarde alguns minutos.
3. Se ainda divergir, é diferença de dado na origem — reporte ao suporte com o técnico, o mês e os dois valores.
