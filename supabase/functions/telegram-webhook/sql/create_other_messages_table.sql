-- Create other_messages table to handle all non-media messages
CREATE TABLE IF NOT EXISTS public.other_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  message_type text NOT NULL,
  telegram_message_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  chat_type public.telegram_chat_type NOT NULL,
  chat_title text NULL,
  message_text text NULL,
  is_edited boolean NOT NULL DEFAULT false,
  edit_date timestamp with time zone NULL,
  edit_history jsonb NULL,
  processing_state public.processing_state_type NOT NULL DEFAULT 'completed'::processing_state_type,
  processing_started_at timestamp with time zone NULL,
  processing_completed_at timestamp with time zone NULL,
  processing_correlation_id uuid NULL,
  analyzed_content jsonb NULL,
  product_name text NULL,
  product_code text NULL,
  vendor_uid text NULL,
  purchase_date date NULL,
  product_quantity numeric NULL,
  notes text NULL,
  vendor_name text NULL,
  error_message text NULL,
  telegram_data jsonb NULL,
  message_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id text NULL,
  CONSTRAINT other_messages_pkey PRIMARY KEY (id),
  CONSTRAINT check_valid_processing_state CHECK (
    processing_state = ANY (
      ARRAY[
        'initialized'::processing_state_type,
        'pending'::processing_state_type,
        'processing'::processing_state_type,
        'completed'::processing_state_type,
        'error'::processing_state_type
      ]
    )
  )
) TABLESPACE pg_default;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_other_messages_telegram_message_id ON public.other_messages USING btree (telegram_message_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_chat_id ON public.other_messages USING btree (chat_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_message_type ON public.other_messages USING btree (message_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_processing_state ON public.other_messages USING btree (processing_state) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_created_at ON public.other_messages USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_is_edited ON public.other_messages USING btree (is_edited) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_chat_telegram_info ON public.other_messages USING btree (chat_id, telegram_message_id, chat_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_other_messages_processing_correlation ON public.other_messages USING btree (processing_correlation_id) TABLESPACE pg_default WHERE (processing_correlation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_user_id ON public.other_messages USING btree (user_id) TABLESPACE pg_default WHERE (user_id IS NOT NULL);

-- Create function to handle message deletion
CREATE OR REPLACE FUNCTION xdelo_handle_other_message_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the deletion in a deletion log table if needed
  INSERT INTO message_deletion_logs (
    message_id,
    message_type,
    telegram_message_id,
    chat_id,
    deleted_at,
    deletion_reason
  ) VALUES (
    OLD.id,
    'other_message',
    OLD.telegram_message_id,
    OLD.chat_id,
    NOW(),
    'user_initiated'
  );
  
  -- Return the old record to allow the deletion to proceed
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION xdelo_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update message URL
CREATE OR REPLACE FUNCTION xdelo_update_message_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a message URL based on chat type and message ID
  IF NEW.chat_type = 'channel' THEN
    -- For channels, use a different format
    NEW.message_url = 'https://t.me/c/' || SUBSTRING(NEW.chat_id::text, 5) || '/' || NEW.telegram_message_id;
  ELSE
    -- For regular chats
    NEW.message_url = 'https://t.me/c/' || NEW.chat_id || '/' || NEW.telegram_message_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to extract analyzed content fields
CREATE OR REPLACE FUNCTION xdelo_extract_analyzed_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if analyzed_content is not null
  IF NEW.analyzed_content IS NOT NULL THEN
    -- Extract fields from analyzed_content JSON
    NEW.product_name = NEW.analyzed_content->>'product_name';
    NEW.product_code = NEW.analyzed_content->>'product_code';
    NEW.vendor_uid = NEW.analyzed_content->>'vendor_uid';
    NEW.purchase_date = (NEW.analyzed_content->>'purchase_date')::date;
    
    -- Handle quantity (numeric field)
    BEGIN
      NEW.product_quantity = (NEW.analyzed_content->>'quantity')::numeric;
    EXCEPTION WHEN OTHERS THEN
      -- If conversion fails, set to NULL
      NEW.product_quantity = NULL;
    END;
    
    NEW.notes = NEW.analyzed_content->>'notes';
    
    -- Set vendor_name based on vendor_uid if available
    IF NEW.vendor_uid IS NOT NULL THEN
      SELECT name INTO NEW.vendor_name
      FROM vendors
      WHERE uid = NEW.vendor_uid
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create message deletion log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.message_deletion_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  message_type text NOT NULL,
  telegram_message_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  deleted_at timestamp with time zone NOT NULL,
  deletion_reason text NULL,
  CONSTRAINT message_deletion_logs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER xdelo_trg_update_timestamp BEFORE UPDATE ON other_messages FOR EACH ROW EXECUTE FUNCTION xdelo_handle_updated_at();
CREATE TRIGGER xdelo_trg_set_timestamp BEFORE INSERT OR UPDATE ON other_messages FOR EACH ROW EXECUTE FUNCTION xdelo_handle_updated_at();

-- Create trigger for message URL updates
CREATE TRIGGER xdelo_trg_update_message_url BEFORE INSERT OR UPDATE ON other_messages FOR EACH ROW EXECUTE FUNCTION xdelo_update_message_url();

-- Create trigger for message deletion handling
CREATE TRIGGER xdelo_trg_other_message_deletion BEFORE DELETE ON other_messages FOR EACH ROW EXECUTE FUNCTION xdelo_handle_other_message_deletion();

-- Add columns for extracted analyzed content
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS product_name text NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS product_code text NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS vendor_uid text NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS purchase_date date NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS product_quantity numeric NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS notes text NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS vendor_name text NULL;

-- Create trigger to extract analyzed content fields for messages
CREATE TRIGGER xdelo_trg_extract_analyzed_content BEFORE INSERT OR UPDATE OF analyzed_content ON messages FOR EACH ROW EXECUTE FUNCTION xdelo_extract_analyzed_content();

-- Create trigger to extract analyzed content fields for other_messages
CREATE TRIGGER xdelo_trg_extract_other_analyzed_content BEFORE INSERT OR UPDATE OF analyzed_content ON other_messages FOR EACH ROW EXECUTE FUNCTION xdelo_extract_analyzed_content();

-- Create indexes for the extracted fields in messages
CREATE INDEX IF NOT EXISTS idx_messages_product_name ON public.messages USING btree (product_name) TABLESPACE pg_default WHERE (product_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_product_code ON public.messages USING btree (product_code) TABLESPACE pg_default WHERE (product_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_vendor_uid ON public.messages USING btree (vendor_uid) TABLESPACE pg_default WHERE (vendor_uid IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_purchase_date ON public.messages USING btree (purchase_date) TABLESPACE pg_default WHERE (purchase_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_product_quantity ON public.messages USING btree (product_quantity) TABLESPACE pg_default WHERE (product_quantity IS NOT NULL);

-- Create indexes for the extracted fields in other_messages
CREATE INDEX IF NOT EXISTS idx_other_messages_product_name ON public.other_messages USING btree (product_name) TABLESPACE pg_default WHERE (product_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_product_code ON public.other_messages USING btree (product_code) TABLESPACE pg_default WHERE (product_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_vendor_uid ON public.other_messages USING btree (vendor_uid) TABLESPACE pg_default WHERE (vendor_uid IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_purchase_date ON public.other_messages USING btree (purchase_date) TABLESPACE pg_default WHERE (purchase_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_product_quantity ON public.other_messages USING btree (product_quantity) TABLESPACE pg_default WHERE (product_quantity IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_other_messages_analyzed_content ON public.other_messages USING gin (analyzed_content) TABLESPACE pg_default WHERE (analyzed_content IS NOT NULL);
