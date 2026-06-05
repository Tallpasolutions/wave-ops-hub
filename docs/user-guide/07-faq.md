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
O sistema tenta casar o nome na coluna "Tecnico" da planilha com os técnicos cadastrados pelo código Unetvale. Verifique se o **Código Unetvale** no cadastro do técnico bate exatamente com o valor da planilha. Use a vinculação manual em **Uploads → [upload] → Vincular técnico** se necessário.

**O técnico não vê suas visitas no portal.**
Confirme que o técnico está cadastrado e que o `codigo_unetvale` bate com o nome usado na planilha. Verifique também se o período selecionado no portal do técnico está correto.

---

## Payouts e LPU

**Um payout aparece como "Sem regra".**
Significa que nenhuma regra da LPU ativa se aplicou à visita. Revise as condições das regras da LPU e compare com os dados da visita (finalidade, tipo de atendimento, cidade). Ajuste as regras e ative uma nova versão da LPU se necessário.

**O payout de uma visita está incorreto.**
Na página do payout (`Pagamentos → [payout]`), use o botão **Override manual** para corrigir o valor e registrar o motivo. O valor calculado original é preservado para auditoria.

---

## Fechamento

**Como reabrir um fechamento aprovado?**
Fechamentos aprovados ou pagos só podem ser reabertos pelo administrador Tallpa. Entre em contato com o suporte da Tallpa Solutions.

**Posso aprovar o fechamento com motivos pendentes?**
Tecnicamente sim, mas não é recomendado. Motivos não classificados deixam payouts pendentes de cálculo, o que pode resultar em valores incorretos no fechamento.

---

## Suporte

Para problemas não cobertos neste guia, entre em contato com a equipe da **Tallpa Solutions** pelo canal de suporte fornecido no contrato.
