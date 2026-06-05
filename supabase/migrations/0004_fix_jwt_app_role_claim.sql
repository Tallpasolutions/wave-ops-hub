-- Renomeia a custom claim de 'role' para 'app_role'.
--
-- CAUSA: o campo 'role' no JWT é reservado pelo PostgREST — ele faz
-- SET ROLE <valor> antes de executar queries. Com 'role: tenant_owner',
-- o PostgREST tentava SET ROLE tenant_owner que não existe como role
-- do PostgreSQL, quebrando todas as queries com erro "role does not exist".
--
-- SOLUÇÃO: usar 'app_role' para nossas permissões de negócio, preservando
-- o campo 'role: authenticated' padrão do Supabase intacto.

-- 1. Atualiza o Auth Hook para usar 'app_role'
CREATE OR REPLACE FUNCTION public.custom_jwt_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_role      text;
  v_tenant_id uuid;
  v_tech_id   uuid;
  claims      jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;

  SELECT role, tenant_id, technician_id
    INTO v_role, v_tenant_id, v_tech_id
    FROM public.users
   WHERE id = v_user_id
     AND ativo = true;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('claims', claims);
  END IF;

  claims := claims
    || jsonb_build_object('app_role', v_role)
    || jsonb_build_object('tenant_id', to_jsonb(v_tenant_id))
    || jsonb_build_object('technician_id', to_jsonb(v_tech_id));

  RETURN jsonb_build_object('claims', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_jwt_claims TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_jwt_claims FROM PUBLIC, anon, authenticated;

-- 2. Atualiza os helpers de RLS para ler de 'app_role'
CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json ->> 'app_role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_tallpa_owner() RETURNS BOOLEAN AS $$
  SELECT current_user_role() = 'tallpa_owner';
$$ LANGUAGE sql STABLE;
