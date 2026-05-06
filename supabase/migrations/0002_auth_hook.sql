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

  -- Usuário não encontrado ou inativo: retorna claims sem modificação.
  -- O acesso falhará pelo check de ativo em getCurrentUser() no app.
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('claims', event -> 'claims');
  END IF;

  -- Mescla claims customizadas com as claims base do Supabase
  claims := event -> 'claims';
  claims := jsonb_set(claims, '{role}',          to_jsonb(v_role));
  claims := jsonb_set(claims, '{tenant_id}',     to_jsonb(v_tenant_id::text));
  claims := jsonb_set(claims, '{technician_id}', to_jsonb(v_tech_id::text));

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Permite que o Supabase Auth chame a função
GRANT EXECUTE ON FUNCTION public.custom_jwt_claims TO supabase_auth_admin;
-- Remove permissão pública (defesa em profundidade)
REVOKE EXECUTE ON FUNCTION public.custom_jwt_claims FROM PUBLIC;
