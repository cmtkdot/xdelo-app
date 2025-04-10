create table public.other_messages (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  message_type text not null,
  telegram_message_id bigint not null,
  chat_id bigint not null,
  chat_type public.telegram_chat_type not null,
  chat_title text null,
  message_text text null,
  is_edited boolean not null default false,
  edit_date timestamp with time zone null,
  edit_history jsonb null,
  processing_state public.processing_state_type not null default 'completed'::processing_state_type,
  processing_started_at timestamp with time zone null,
  processing_completed_at timestamp with time zone null,
  processing_correlation_id uuid null,
  analyzed_content jsonb null,
  product_name text null,
  product_code text null,
  vendor_uid text null,
  purchase_date date null,
  product_quantity numeric null,
  notes text null,
  error_message text null,
  telegram_data jsonb null,
  message_url text null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  correlation_id text null,
  is_forward boolean null,
  forward_info jsonb null,
  retry_count integer null default 0,
  last_error_at timestamp with time zone null,
  old_analyzed_content jsonb null,
  constraint other_messages_pkey primary key (id),
  constraint check_valid_forward_info check (validate_forward_info (forward_info)),
  constraint check_valid_processing_state check (
    (
      processing_state = any (
        array[
          'initialized'::processing_state_type,
          'pending'::processing_state_type,
          'processing'::processing_state_type,
          'completed'::processing_state_type,
          'error'::processing_state_type
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_other_messages_analyzed_content on public.other_messages using gin (analyzed_content) TABLESPACE pg_default
where
  (analyzed_content is not null);

create index IF not exists idx_other_messages_chat_id on public.other_messages using btree (chat_id) TABLESPACE pg_default;

create index IF not exists idx_other_messages_chat_telegram_info on public.other_messages using btree (chat_id, telegram_message_id, chat_type) TABLESPACE pg_default;

create index IF not exists idx_other_messages_created_at on public.other_messages using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_other_messages_is_edited on public.other_messages using btree (is_edited) TABLESPACE pg_default;

create index IF not exists idx_other_messages_message_type on public.other_messages using btree (message_type) TABLESPACE pg_default;

create index IF not exists idx_other_messages_processing_correlation on public.other_messages using btree (processing_correlation_id) TABLESPACE pg_default
where
  (processing_correlation_id is not null);

create index IF not exists idx_other_messages_processing_state on public.other_messages using btree (processing_state) TABLESPACE pg_default;

create index IF not exists idx_other_messages_product_code on public.other_messages using btree (product_code) TABLESPACE pg_default
where
  (product_code is not null);

create index IF not exists idx_other_messages_product_name on public.other_messages using btree (product_name) TABLESPACE pg_default
where
  (product_name is not null);

create index IF not exists idx_other_messages_product_quantity on public.other_messages using btree (product_quantity) TABLESPACE pg_default
where
  (product_quantity is not null);

create index IF not exists idx_other_messages_purchase_date on public.other_messages using btree (purchase_date) TABLESPACE pg_default
where
  (purchase_date is not null);

create index IF not exists idx_other_messages_telegram_message_id on public.other_messages using btree (telegram_message_id) TABLESPACE pg_default;

create index IF not exists idx_other_messages_user_id on public.other_messages using btree (user_id) TABLESPACE pg_default
where
  (user_id is not null);

create index IF not exists idx_other_messages_vendor_uid on public.other_messages using btree (vendor_uid) TABLESPACE pg_default
where
  (vendor_uid is not null);

create index IF not exists idx_other_messages_is_forward on public.other_messages using btree (is_forward) TABLESPACE pg_default
where
  (is_forward = true);

  create table public.unified_audit_logs (
  id uuid not null default gen_random_uuid (),
  event_type text not null,
  entity_id uuid not null,
  telegram_message_id bigint null,
  chat_id bigint null,
  event_timestamp timestamp with time zone not null default now(),
  previous_state jsonb null,
  new_state jsonb null,
  metadata jsonb null,
  correlation_id text null,
  user_id uuid null,
  error_message text null,
  message_type text null,
  source_message_id uuid null,
  target_message_id uuid null,
  operation_type public.message_operation_type null,
  constraint unified_audit_logs_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_entity_id on public.unified_audit_logs using btree (entity_id) TABLESPACE pg_default;

create index IF not exists idx_unified_audit_logs_correlation_id on public.unified_audit_logs using btree (correlation_id) TABLESPACE pg_default
where
  (correlation_id is not null);

create index IF not exists idx_unified_audit_logs_event_type on public.unified_audit_logs using btree (event_type) TABLESPACE pg_default;

create index IF not exists idx_unified_audit_logs_message_ids on public.unified_audit_logs using btree (source_message_id, target_message_id) TABLESPACE pg_default;

create index IF not exists idx_unified_audit_logs_timestamp on public.unified_audit_logs using btree (event_timestamp) TABLESPACE pg_default;