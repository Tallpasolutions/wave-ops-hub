# ADR-012 — Ingestão do Indicador IQI a partir do sistema Unetvale

**Status:** Proposto
**Data:** 2026-07-19
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Demanda do gestor (19/07) — trazer o IQI (índice de reincidência da operadora)
para dentro do Wave Ops Hub, numa visão gerencial de produtividade de equipes e também no
app do técnico.

---

## Contexto

O **IQI** (Índice de Qualidade de Instalação) é calculado e exibido pela **Unetvale**
(`os.unetvale.com.br`), no rodapé da home, com uma aba por técnico e uma aba "Total".
Ele mede **reincidência / retrabalho**: a cada mês, dos contratos com OS produtiva
(Instalação, Migração, Mudança), quantos tiveram um **atendimento reincidente** depois.

Investigação de 19/07/2026 (login `wave.yuri`, sessão já autenticada) revelou o endpoint que
alimenta o gráfico:

```
GET https://os.unetvale.com.br/index/iqi/{tiposServico}/{lookback}/{techId}
Header obrigatório: X-Requested-With: XMLHttpRequest   (sem ele a resposta é [])
Auth: cookie de sessão logada (não há API/token oficial)
```

- `tiposServico` observado: `INS-INS2-INS3-MIGE-MIGF-MUD-MUDF`.
- `lookback`: `30` (30 e 60 deram resultado idêntico — não é a janela de reincidência; é
  provavelmente o nº de meses de histórico com teto).
- `techId`: id numérico do técnico na Unetvale, que corresponde ao
  `technicians.codigo_unetvale` já existente no nosso schema.

Resposta = config Highcharts JSON, com 14 meses móveis e 3 séries por técnico:
`Total de OS's` (coluna), `Contratos com atendimentos` reincidentes (coluna) e
`% com atendimentos reincidentes` (linha = o IQI). As séries de coluna trazem `oss[]` com os
números de OS de cada mês (permite drilldown). Exemplo real (Carlos Henrique, ago/2025):
30 OSs, 6 reincidentes → 20%. **Quanto menor o percentual, melhor.**

O sistema precisa persistir esse indicador para: (1) uma tela gerencial de produtividade que
combina IQI + métricas internas das planilhas; (2) uma visão do próprio IQI no app do técnico.

---

## Decisão

**Ingerir o IQI por scraping autenticado do endpoint da Unetvale**, persistindo snapshots
mensais por técnico no nosso banco. Decisão do gestor em 19/07 (o cálculo interno foi
considerado — ver abaixo — mas optou-se por espelhar o número oficial da operadora).

### 1. Coletor isolado em `src/lib/iqi/` (espelha a filosofia do ETL — ADR-006)

Toda a lógica de login, fetch, parsing e normalização fica isolada em `src/lib/iqi/`,
consumida por uma Server Action que apenas orquestra. Componentes nunca chamam a Unetvale.

Fluxo do coletor:
1. **Login**: replicar o POST do formulário de login da Unetvale com a credencial de serviço,
   capturando o cookie de sessão. (Não há API/token; a autenticação é por sessão.)
2. **Fetch por técnico**: para cada técnico ativo com `codigo_unetvale`, GET no endpoint com o
   header `X-Requested-With: XMLHttpRequest`.
3. **Parse**: ler `xAxis.categories` (competências `MM/AAAA`) e as 3 séries; derivar por mês
   `total_os`, `contratos_reincidentes` e `pct_reincidencia`.
4. **Upsert idempotente** por `(tenant_id, tecnico_id, competencia)`.

### 2. Credencial da Unetvale só no servidor, nunca no cliente

A credencial de serviço (usuário/senha Unetvale) vive **somente no ambiente do servidor**
(variável de ambiente / Supabase Vault). Nunca em código client-side, nunca no bundle, nunca
exposta a `NEXT_PUBLIC_*`. O coletor roda em Server Action com o service role (padrão das
operações administrativas — ver regra de RLS no CLAUDE.md).

### 3. Persistência: nova tabela `iqi_snapshots` (migration numerada)

Nova migration SQL numerada em `supabase/migrations/` (schema é fonte de verdade — nada no
painel Supabase). Esboço:

```sql
CREATE TABLE iqi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,              -- "AAAA-MM"
  total_os INTEGER NOT NULL,
  contratos_reincidentes INTEGER NOT NULL,
  pct_reincidencia NUMERIC(5,2) NOT NULL,
  os_nums JSONB,                          -- drilldown (números de OS do mês)
  tipos_servico TEXT NOT NULL,            -- filtro usado na coleta
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tecnico_id, competencia)
);
-- RLS por tenant (padrão ADR-002). Técnico só lê a própria linha; gestor lê as do tenant.
```

### 4. Disparo: coleta agendada 2x/dia (08:00 e 20:00 America/São_Paulo) via Vercel Cron

A coleta roda **automaticamente duas vezes por dia, às 08:00 e às 20:00 (horário de Brasília)**.
O projeto é hospedado na Vercel (README), então usamos **Vercel Cron**:

- `vercel.json` com duas entradas de cron apontando para um route handler.
  **Vercel Cron executa em UTC** e o Brasil é UTC−3 sem horário de verão → 08:00/20:00 BRT =
  **11:00 / 23:00 UTC**:
  ```json
  {
    "crons": [
      { "path": "/api/cron/iqi", "schedule": "0 11 * * *" },
      { "path": "/api/cron/iqi", "schedule": "0 23 * * *" }
    ]
  }
  ```
- **Route handler** `src/app/api/cron/iqi/route.ts` — fino, só orquestra: valida o header
  `Authorization: Bearer $CRON_SECRET` (segredo que a Vercel injeta) e chama o **mesmo coletor**
  de `src/lib/iqi/` usado pela sincronização manual. Nenhuma lógica duplicada.
- **Sincronização manual** continua existindo (botão "Sincronizar IQI" na tela gerencial →
  Server Action que chama o mesmo coletor), para forçar uma coleta fora do horário.

> **Exceção de estrutura de rotas (documentada por este ADR):** o CLAUDE.md restringe rotas aos
> grupos `(public)/(admin)/(manager)/(technician)`. Um endpoint de cron não é uma página de
> usuário e não cabe em nenhum grupo; criar `src/app/api/cron/iqi/route.ts` é uma exceção
> deliberada, justificada aqui, e protegida por `CRON_SECRET` (não é acessível sem o segredo).

### 5. Match técnico por `codigo_unetvale`

O `techId` da Unetvale casa com `technicians.codigo_unetvale`. Técnicos sem `codigo_unetvale`
preenchido são ignorados na coleta e reportados (não falham a sincronização inteira).

---

## Considerados e rejeitados

### A. Calcular o IQI internamente a partir das planilhas (rejeitado como fonte primária)

Nosso modelo OS→visitas (ADR-003) já prevê a métrica "% de OSs com retrabalho". Temos
`service_orders.contrato`, `service_visits` com finalidade (incluindo "Suporte Fibra") e datas —
seria possível derivar reincidência (instalação seguida de suporte no mesmo contrato dentro de
uma janela). **Rejeitado como fonte primária** por decisão do gestor: prioriza-se espelhar o
número **oficial** que a operadora usa. Risco assumido: dependência de credencial e do HTML/rota
da Unetvale (frágil). O cálculo interno permanece disponível como **caminho de conciliação**
futuro (validar o número raspado) — evolução para modelo híbrido, se desejado.

### B. Raspar o HTML renderizado do gráfico (rejeitado)

Desnecessário: o endpoint devolve JSON estruturado. Fazer scraping do SVG/HTML seria mais
frágil. Consumimos o JSON diretamente (sem cheerio/puppeteer).

### C. Guardar a credencial em tabela do banco (rejeitado)

Credencial de terceiro em tabela amplia a superfície de vazamento. Mantém-se em variável de
ambiente/Vault do servidor.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Unetvale muda login/rota/HTML → coleta quebra | Coletor isolado e testável; falha reportada com clareza; snapshot anterior permanece válido no banco |
| Credencial de serviço vaza | Só no servidor; nunca em client/bundle; rotacionável |
| Login exige captcha/2FA no futuro | Fallback para cálculo interno (opção A); reavaliar em ADR |
| Número raspado diverge do esperado | `os_nums[]` guardado permite auditoria; conciliação futura com dado interno |
| "Tempo real" no app do técnico | O dado é **as-of última sincronização** (não é tempo real estrito). A tela deve exibir `synced_at`. Ver plano de sprint. |

---

## Consequências

- Nova dependência operacional: credencial de serviço da Unetvale precisa existir e ser mantida.
- Nova tabela `iqi_snapshots` + migration numerada.
- Novo módulo `src/lib/iqi/` com testes (lógica de domínio → testes obrigatórios, CLAUDE.md §6).
- Novos envs no servidor: `UNETVALE_USER`, `UNETVALE_PASSWORD`, `CRON_SECRET` (nunca `NEXT_PUBLIC_`).
- Novo `vercel.json` (crons) e route handler `src/app/api/cron/iqi` (exceção de rota documentada).
- Base para a tela gerencial de produtividade e para o IQI no app do técnico (ver plano de sprint).
