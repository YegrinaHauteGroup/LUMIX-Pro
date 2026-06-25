-- ============================================================
-- Migration 016: generic edit-history audit logging.
-- Writes every create/update/delete on the main domain tables to
-- audit_logs, resolving the acting staff member from auth.uid().
-- Powers the header "데이터 히스토리" popover.
-- ============================================================
create or replace function public.log_audit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_actor uuid;
  v_action audit_action;
  v_center uuid;
  v_rec uuid;
begin
  if TG_OP = 'INSERT' then v_action := 'create'; v_center := NEW.center_id; v_rec := NEW.id;
  elsif TG_OP = 'UPDATE' then v_action := 'update'; v_center := NEW.center_id; v_rec := NEW.id;
  else v_action := 'delete'; v_center := OLD.center_id; v_rec := OLD.id;
  end if;
  if v_center is null then return coalesce(NEW, OLD); end if;

  select id into v_actor from public.staff_profiles
   where user_id = auth.uid() and deleted_at is null limit 1;

  insert into public.audit_logs(center_id, actor_staff_id, action, target_table, target_record_id, occurred_at)
  values (v_center, v_actor, v_action, TG_TABLE_NAME, v_rec, now());

  return coalesce(NEW, OLD);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'children','classes','activities','attendances','care_notes','health_profiles',
    'meal_logs','interactions','sna_entities','analysis_quests','peer_assessments',
    'staff_child_assessments','guardian_child_assessments','guardian_profiles','child_guardians'
  ] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.log_audit()', t);
  end loop;
end $$;
