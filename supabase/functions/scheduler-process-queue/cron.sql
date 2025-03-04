
-- Enable the required extensions if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the function to run every 15 minutes
select cron.schedule(
  'process-pending-messages',
  '*/15 * * * *',
  $$
  begin
    -- Process any pending messages directly
    perform xdelo_process_pending_messages(20);
    
    -- Reset any stalled messages
    perform xdelo_reset_stalled_messages();
    
    -- Log the scheduled run
    insert into unified_audit_logs (
      event_type,
      metadata,
      event_timestamp
    ) values (
      'scheduler_processed_pending',
      jsonb_build_object(
        'run_time', now(),
        'type', 'direct_processing'
      ),
      now()
    );
  end;
  $$
);
