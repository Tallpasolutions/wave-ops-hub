-- Bloqueia slugs que colidiriam com o portal admin ou subdomínios reservados Tallpa.
-- O middleware diferencia admin.* como portal Tallpa — um tenant com slug 'admin'
-- causaria colisão silenciosa. A lista cobre subdomínios que a Tallpa pode usar no futuro.
-- Aplicar via Supabase SQL Editor (nunca via pnpm db:push).

ALTER TABLE tenants
  ADD CONSTRAINT slug_not_reserved
  CHECK (slug NOT IN ('admin', 'api', 'www', 'app', 'auth', 'static', 'public', 'assets', 'cdn', 'docs'));
