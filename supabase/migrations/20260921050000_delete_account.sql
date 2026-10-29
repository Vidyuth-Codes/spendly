-- Lets a signed-in user permanently delete their own account and all of their data.
-- Google Play requires an in-app way to do this.
--
-- The app cannot delete an auth user itself (that needs the service-role key, which must never ship in
-- an app). This function runs with the owner's privileges instead, but can only ever delete the caller:
-- the id comes from the session token (auth.uid()), never from a parameter.
--
-- Every user-owned table references auth.users with ON DELETE CASCADE, so profiles, categories,
-- transactions, income sources, budgets, goals, contributions, carry and merchant rules all go with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
