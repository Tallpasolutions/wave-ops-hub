-- Auth Hook: injeta role, tenant_id e technician_id no JWT ao gerar o token.
-- Configurar manualmente em: Authentication → Hooks → Custom Access Token Hook.
-- Ver: docs/manual-steps/supabase-auth-hook.md

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

  -- Pega claims base do evento (sempre objeto jsonb, nunca null aqui)
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- Usuário não encontrado ou inativo: retorna claims base sem custom claims.
  -- O login não falha aqui — falha no app via getCurrentUser() que checa ativo.
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('claims', claims);
  END IF;

  -- Mescla custom claims usando operador || (jsonb concat).
  -- to_jsonb(NULL::uuid) gera JSON null válido — preserva NULL para tenant_id/technician_id.
  claims := claims
    || jsonb_build_object('role', v_role)
    || jsonb_build_object('tenant_id', to_jsonb(v_tenant_id))
    || jsonb_build_object('technician_id', to_jsonb(v_tech_id));

  RETURN jsonb_build_object('claims', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_jwt_claims TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_jwt_claims FROM PUBLIC, anon, authenticated;
