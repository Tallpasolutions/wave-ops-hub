# ADR-024 — Planilha com outras empresas: filtro por lista de permissão na ingestão

**Status:** Aceito (implementado; migrations 0046 e 0047 a aplicar)
**Data:** 2026-11-03
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** a Wave subiu uma planilha com outras empresas e equipes, que não podem constar no sistema dela.

---

## Contexto

O export da Unetvale traz todas as empresas que atendem por ela. Em 03/11/2026 a
`lista-os-wave01-10--03-11.xlsx` entrou assim: 5.980 linhas, 674 da Wave (contagem pelo CSV de mesmo
total). O ETL não tinha noção de empresa e gravou todas. O sintoma visível foi a lista "Técnicos
sem vínculo" cheia de nomes de outras empresas, com botão para cadastrá-los.

A empresa só existe como prefixo na coluna Técnico: `WAVE - Fulano`, `JVM - Fulano`. Não há coluna
própria. O prefixo tem variações reais de grafia (`JVM -GABRIEL`, `INFRA UNET -  Mauricio`).

## Decisão

1. **Lista de permissão por tenant**, em `tenants.config.prefixos_empresa`. Para a Wave:
   `WAVE`, `INFRA WAVE`, `WAVE SUPERVISOR`. Tenant sem a lista não filtra.
2. **Descarte na ingestão, antes de qualquer outra etapa**: período, deduplicação, match de técnico e
   auto-criação de motivo só veem as linhas do tenant. Lógica em `src/lib/etl/empresa.ts`.
3. **Na dúvida, a linha fica.** Nome sem prefixo e técnico cadastrado no tenant não são descartados.
   Uma linha a mais aparece em "sem vínculo"; uma linha a menos é técnico sem receber sem ninguém ver.
4. **O descarte é visível**: `uploads.outras_empresas` guarda linhas por empresa e a tela do upload mostra.
5. **O filtro é por visita, nunca por OS.** Há OSs com visitas da Wave e de outra empresa
   (148 no arquivo acima), e a visita da Wave fica.

## Considerados e rejeitados

- **Lista de bloqueio:** a lista é aberta. Exports diferentes trazem `INNOVA`, `FANDARUFF`, `GILTECH`,
  `NOC UNET`. Toda empresa nova voltaria a entrar até alguém notar.
- **Só cadastro de técnicos:** técnico da Wave ainda não cadastrado sumiria da planilha em silêncio,
  em vez de aparecer em "sem vínculo".
- **Marcar com flag, como `fora_escopo` (ADR-008):** infra é dado da Wave que não conta; aqui o dado
  é de terceiros e não deve ser guardado.
- **Bloquear a planilha inteira:** a Wave ficaria sem subir até conseguir outro export, sendo que a
  parte dela é identificável.

## Consequências

- Empresa com prefixo novo é descartada sem configuração. Se a Wave criar um prefixo próprio, é
  preciso incluí-lo na lista, e o aviso na tela do upload é onde isso aparece.
- `INFRA` (sozinho) fica de fora por não estar na lista, mesmo existindo `INFRA - Leandro Nunes Mayer`.
- O arquivo original segue no Storage com as outras empresas, porque "Reprocessar" depende dele.
- A limpeza do que já entrou (0047) protege visita com técnico vinculado ou pagamento travado, e
  esses casos pedem decisão caso a caso.
