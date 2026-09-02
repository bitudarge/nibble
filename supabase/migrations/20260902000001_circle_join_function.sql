-- Phase 5: joining a circle by invite code.
--
-- circle_members has no client-writable INSERT policy (see the Phase 2 RLS
-- migration's comment on why — a plain insert would let anyone join any
-- circle just by guessing its UUID). This SECURITY DEFINER function is the
-- only way in: it looks up the circle by join_code itself, server-side, and
-- only then inserts the membership row. Bypassing RLS is safe here
-- specifically because the function does exactly one narrow, validated
-- thing — nothing about it is a general-purpose RLS bypass.

create or replace function public.join_circle_by_code(p_join_code text)
returns public.circles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle public.circles;
begin
  select * into v_circle from public.circles where join_code = p_join_code;

  if not found then
    raise exception 'That invite code doesn''t match any circle.';
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle.id, auth.uid(), 'member')
  on conflict (circle_id, user_id) do nothing;

  return v_circle;
end;
$$;

grant execute on function public.join_circle_by_code(text) to authenticated;
