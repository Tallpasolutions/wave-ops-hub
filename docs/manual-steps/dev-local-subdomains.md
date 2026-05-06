# Dev Local com Subdomínios *.localhost

## Como acessar

Browsers modernos (Chrome, Firefox, Safari, Edge) resolvem `*.localhost`
automaticamente para 127.0.0.1. Não é necessário editar `/etc/hosts`.

## URLs de dev

| Portal | URL |
|---|---|
| Raiz (redireciona automaticamente) | http://localhost:3000 |
| Tenant Wave | http://wave.localhost:3000 |
| Admin Tallpa | http://admin.localhost:3000/admin/dashboard |

## Configuração de variável de ambiente

```bash
# .env.local
NEXT_PUBLIC_ROOT_DOMAIN=localhost
```

## Supabase: configurar Allowed Redirect URLs

Para que os fluxos de recuperação de senha e primeiro acesso funcionem em dev,
adicione as seguintes URLs em **Supabase > Auth > URL Configuration > Redirect URLs**:

```
http://*.localhost:3000/**
```

## Fallback para dispositivos móveis (não implementado)

`*.localhost` pode não resolver em alguns dispositivos móveis em rede local.
Para esses casos raros, opções recomendadas:
- Usar ngrok com subdomínio reservado
- Configurar proxy reverso local (ex: Caddy) com `*.tallpa.local`
- Acessar via IP da máquina dev (sem multi-tenant — apenas tenant default)

**NÃO usar query param `?tenant=`** — adiciona vetor de ataque ao isolamento de tenant.
