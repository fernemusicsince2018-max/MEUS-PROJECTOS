-- Este ficheiro ficou apenas como guardrail para evitar setups incompletos.
-- Para Supabase Postgres usa o schema actual em:
--   backend/postgresql/schema.sql
-- E depois aplica as migrations em:
--   backend/postgresql/migrations/

do $$
begin
  raise exception using
    message = 'Schema legado desativado. Para Supabase usa backend/postgresql/schema.sql e as migrations em backend/postgresql/migrations/.';
end;
$$;
