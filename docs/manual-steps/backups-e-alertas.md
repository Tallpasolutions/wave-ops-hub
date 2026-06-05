# Backups e Alertas de Produção

Guia para configurar backups automáticos no Supabase e alertas de erro no Vercel após o go-live.

---

## 1. Backups — Supabase Point-in-Time Recovery (PITR)

O Supabase Pro inclui backup contínuo com granularidade de 1 minuto, permitindo restaurar o banco para qualquer ponto nos últimos 7 dias (padrão) ou 30 dias (add-on).

### Habilitar PITR

1. Acesse [supabase.com](https://supabase.com) → seu projeto de produção
2. Menu lateral: **Settings → Add-ons**
3. Localize **Point in Time Recovery**
4. Clique em **Enable** e confirme

> Requer Supabase Pro (mínimo). O PITR passa a capturar WAL logs a partir da ativação — não cobre o histórico anterior.

### Restaurar a partir de um ponto no tempo

1. Acesse **Settings → Backups**
2. Selecione **Point in Time Recovery**
3. Escolha a data/hora desejada no calendário
4. Clique em **Restore** e confirme

> A restauração cria um novo projeto Supabase com os dados do ponto escolhido. Você precisa atualizar as env vars do Vercel (URL + keys) para apontar para ele, caso queira substituir a produção atual.

### Nota: Dump diário em S3

O dump diário em S3 (`pg_dump` agendado) foi planejado mas requer infraestrutura AWS fora da stack atual. Será implementado na **Fase 2** pós-go-live. O PITR cobre a necessidade de backup para o go-live inicial.

---

## 2. Alertas de erro — Vercel Monitoring

O Vercel Pro inclui alertas de erro configuráveis por e-mail sem código adicional.

### Configurar alerta de erro 500

1. Acesse [vercel.com](https://vercel.com) → projeto **wave-ops-hub**
2. Menu: **Settings → Monitoring → Alerts**
3. Clique em **+ Create Alert**
4. Configure:
   - **Alert type:** Error Rate
   - **Condition:** Greater than **5** errors per **hour**
   - **Notification channel:** Email
   - **Recipient:** `jhonicleyton@gmail.com`
5. Clique em **Save**

O alerta dispara quando mais de 5 erros HTTP 5xx ocorrem em qualquer janela de 1 hora.

### Verificar alertas ativos

- **Settings → Monitoring → Alerts** lista todos os alertas configurados e o histórico de disparos
- O Vercel também envia um e-mail de confirmação após salvar

---

## 3. Verificação pós-configuração

| Item | Como verificar |
|---|---|
| PITR ativo | Settings → Backups → deve aparecer "Point in Time Recovery: Enabled" |
| Alerta Vercel | Settings → Monitoring → Alerts → alert criado na lista |
| E-mail de confirmação | Caixa de entrada `jhonicleyton@gmail.com` |
