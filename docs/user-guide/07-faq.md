# Guia 07 — Perguntas Frequentes (FAQ)

## Login e acesso

**Não consigo fazer login.**
Verifique se o e-mail digitado é o mesmo cadastrado pelo gestor. Se a senha estiver incorreta, use o link **Esqueci minha senha** na tela de login. Verifique também a caixa de spam do e-mail.

**Não recebi o e-mail de primeiro acesso.**
Verifique a pasta de spam. Se não encontrar, solicite ao gestor que reenvie o convite ou redefina a senha pelo painel de administração.

---

## Upload de planilha

**O upload ficou preso em "Processando".**
Aguarde até 2 minutos. Se o status não mudar, recarregue a página. Se persistir, abra o upload e use o botão de reprocessamento, ou entre em contato com o suporte.

**O upload retornou "Erro". O que fazer?**
Abra o upload e leia a mensagem de erro. As causas mais comuns são: coluna obrigatória ausente, formato de data incorreto, ou arquivo corrompido. Corrija o arquivo e faça um novo upload.

**Posso enviar a mesma planilha duas vezes?**
Sim, mas o sistema detecta arquivos idênticos automaticamente e os marca como duplicata, sem criar dados duplicados.

---

## Técnicos e visitas

**O técnico não aparece vinculado às visitas da planilha.**
O vínculo é feito pelo **nome**: o sistema compara o nome da coluna "Tecnico" da planilha com o **nome completo** cadastrado, ignorando acentos, maiúsculas, espaços repetidos e o prefixo da empresa ("WAVE - " ou "INFRA WAVE - ") — dos dois lados. Se ainda assim não casar, use a vinculação manual em **Uploads → [upload] → Vincular técnico**; ela também corrige as visitas já ingeridas.

**O técnico não vê suas visitas no portal.**
Confirme que o técnico está cadastrado, que o nome bate com o da planilha e que o período selecionado no portal está correto. Se as visitas existem mas não aparecem para ele, o mais provável é que estejam sem vínculo (ver pergunta acima).

**Para que serve o Código Unetvale no cadastro do técnico?**
Para o **IQI**, não para o vínculo das visitas. Sem ele, o técnico simplesmente não aparece na tela de Produtividade.

---

## Payouts e LPU

**Um payout aparece como "Sem regra".**
Significa que o sistema não encontrou valor para a visita — e ele **nunca chuta**. São três causas, e a solução é diferente em cada uma:

1. **Nenhuma regra da LPU casou.** Revise as condições das regras e compare com os dados da visita (finalidade, tipo de atendimento, meio, condomínio). Se o técnico usa uma **tabela alternativa**, confira as regras *daquela* tabela: regra de LPU não é herdada da padrão — uma finalidade que a tabela alternativa não declara não casa nada.
2. **É um cabeamento/condomínio com explicação nova.** Cadastre o padrão em **Regras → Cabeamento**.
3. **É uma homologação com um valor de Unetvale que não está no mapa.** Cadastre em **Regras → Homologação**. Acontece quando a Unetvale paga um valor diferente do habitual — inclusive quando ela **reduz o pagamento** (por exemplo, ao abrir uma OS de garantia sobre aquele serviço). Nesse caso a observação da própria Unetvale, visível no detalhe da visita, costuma explicar a redução.

Enquanto existir "Sem regra" no período, o fechamento fica bloqueado — é de propósito, para ninguém fechar o mês com visita sem valor definido.

**O payout de uma visita está incorreto.**
Na página do payout (`Pagamentos → [payout]`), use o botão **Override manual** para corrigir o valor e registrar o motivo. O valor calculado original é preservado para auditoria.

**Uma homologação pagou valor de instalação.**
O que identifica a homologação é a coluna de explicação do valor, não a finalidade. Confira em **Regras → Homologação** se o valor pago pela Unetvale naquela OS está no mapa. Ver [Guia 09](./09-valores-especiais.md).

**Uma OS com "ponto adicional" pagou só o valor base.**
Cada ponto adicional soma R$ 36 sobre o valor base — mas o payout só reflete isso depois do recálculo. Recalcule o período e confira novamente.

**Fiz um override e depois subi a planilha de novo. Perdi o ajuste?**
Não. Payouts com ajuste manual, aprovados, pagos ou contestados são **travados** contra recálculo — o novo upload não sobrescreve.

---

## Fechamento e contestações

**Como reabrir um fechamento aprovado?**
Fechamentos aprovados ou pagos só podem ser reabertos pelo administrador Tallpa. Entre em contato com o suporte da Tallpa Solutions.

**Posso aprovar o fechamento com motivos pendentes?**
Tecnicamente sim, mas não é recomendado. Motivos não classificados deixam payouts pendentes de cálculo, o que pode resultar em valores incorretos no fechamento.

**O botão de aprovar o pagamento está bloqueado.**
Há **contestação aberta** no período. Resolva todas na própria página do fechamento (aparecem agrupadas por técnico) e o botão libera. Técnico que ainda não conferiu gera alerta, mas não bloqueia.

**Um técnico contestou uma OS fora do período de fechamento. Isso é normal?**
Sim. O técnico pode contestar a qualquer momento pela lista de visitas dele. A contestação aparece no fechamento do período correspondente e precisa ser resolvida antes da aprovação.

**Concordei com o técnico. Como corrijo o valor?**
Ao resolver a contestação, informe a nova pontuação no próprio formulário — vira um ajuste manual registrado, e o técnico é notificado com o antes → depois. Não é preciso ir à tela de override.

---

## Produtividade e IQI

**Um técnico não aparece na tela de Produtividade.**
Falta o **Código Unetvale** no cadastro dele.

**Cliquei em Sincronizar e nada mudou.**
A sincronização é assíncrona e roda fora do site — leva alguns minutos. Recarregue a página depois e confira a data da última sincronização. Ver [Guia 08](./08-produtividade-e-iqi.md).

---

## Suporte

Para problemas não cobertos neste guia, entre em contato com a equipe da **Tallpa Solutions** pelo canal de suporte fornecido no contrato.
