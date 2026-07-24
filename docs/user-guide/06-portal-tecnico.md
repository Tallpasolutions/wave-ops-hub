# Guia 06 — Portal do Técnico

## Como acessar

O técnico acessa pelo mesmo endereço do portal do gestor (ex: `wave.tallpa.com.br`). As credenciais (e-mail e senha inicial) são fornecidas pelo gestor no momento do cadastro.

No primeiro acesso, o técnico receberá um link por e-mail para definir sua própria senha.

O portal é **mobile-first** e tem cinco abas na barra inferior: **Painel**, **Visitas**, **IQI**, **Histórico** e **Perfil**. Técnicos que também são supervisores veem uma sexta aba, **Equipe**.

## Pontos, não reais

Os valores aparecem para o técnico em **pontos** (ex.: "135 pts"). É o mesmo número do payout — só a apresentação muda. O gestor pode ocultar os valores do painel do técnico (configuração `show_money_on_technician_panel` do tenant); nesse caso os cards de pontuação não são exibidos.

## Painel (tela inicial)

- **Banner "OSs para conferir"** — aparece quando a Wave solicitou a conferência do período. Leva direto para a tela de aprovação.
- **Seus pontos este mês** — total do período, com a contagem de pontuações ainda pendentes de aprovação.
- **Deixado na mesa** — valor potencial que não foi recebido por falha atribuível ao técnico. Só aparece quando é maior que zero.
- **KPIs do mês** — visitas, improdutivas e demais indicadores do período.

## Aba Visitas

Lista as visitas do período com data, número da OS, finalidade, cidade, status do payout e a pontuação.

**Contestar uma OS:** o técnico pode discordar da pontuação de qualquer OS **a qualquer momento**, direto desta lista — não precisa esperar o fechamento. Basta abrir a OS, escrever o motivo e enviar.

- Enquanto a contestação está aberta, a OS fica marcada como contestada e a Wave é notificada.
- Só é possível ter **uma contestação aberta por OS**.
- Quando a Wave responde, a resposta aparece na própria OS. Se a pontuação foi ajustada, aparece a comparação **antes → depois**.

## Aba IQI

Mostra o **IQI do próprio técnico** — o índice de reincidência calculado pela Unetvale (percentual de contratos que voltaram a abrir OS), com a tendência ao longo dos meses e as métricas de produtividade individuais.

O IQI vem do sistema da Unetvale e é atualizado por sincronização automática (duas vezes ao dia). A tela exibe a **data da última sincronização** — o número é sempre "as-of" essa data, não tempo real. Cada técnico vê apenas os próprios dados.

## Aba Histórico

Gráfico com a evolução mensal da pontuação nos últimos meses. Permite visualizar tendências e comparar desempenho entre períodos.

## Aba Perfil

Permite ao técnico:
- Atualizar nome completo e celular
- Alterar a senha de acesso

Os dados de e-mail e CPF são gerenciados pelo gestor e não podem ser alterados pelo técnico.

## Conferência do fechamento

Quando a Wave clica em "Solicitar aprovação" do mês, cada técnico recebe uma notificação e passa a ver o banner **"OSs para conferir"** no painel. Na tela de conferência, o técnico revê as OSs do período e escolhe:

- **Aprovar o período** — confirma que a pontuação está correta; a Wave é notificada.
- **Contestar OSs** — indica as OSs com problema e o motivo de cada uma.

Enquanto houver contestação aberta, a Wave **não consegue aprovar o pagamento** do período. Ao responder, a Wave pode ajustar a pontuação da OS; o técnico é notificado, vê o antes → depois e confere novamente.

Não responder não trava o fechamento — a Wave vê um alerta de "conferência pendente", mas segue.

## Notificações

O ícone de sino no topo exibe as notificações e atualiza **em tempo real**, sem precisar recarregar a página:
- Conferência do período solicitada
- Contestação respondida (com a pontuação antes → depois, quando houve ajuste)
- Fechamento aprovado
- Pagamento realizado

## Dúvidas

Em caso de dúvidas, entre em contato com o gestor responsável da sua equipe.
