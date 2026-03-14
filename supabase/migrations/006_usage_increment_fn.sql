-- Atomic increment for usage_tracking to prevent overwrite race condition
create or replace function increment_usage(
  p_workspace_id uuid,
  p_period       date,
  p_leads        int default 0,
  p_replies      int default 0
)
returns void
language plpgsql
as $$
begin
  insert into usage_tracking (workspace_id, period, leads_discovered, replies_generated)
  values (p_workspace_id, p_period, p_leads, p_replies)
  on conflict (workspace_id, period) do update
    set leads_discovered  = usage_tracking.leads_discovered  + excluded.leads_discovered,
        replies_generated = usage_tracking.replies_generated + excluded.replies_generated;
end;
$$;
