-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "http";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create custom types
CREATE TYPE message_processing_state AS ENUM (
    'initialized',
    'pending',
    'processing',
    'completed',
    'error'
);

-- Create tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_message_id integer,
    media_group_id text,
    message_caption_id uuid REFERENCES public.messages(id),
    is_original_caption boolean DEFAULT false,
    group_caption_synced boolean DEFAULT false,
    caption text DEFAULT ''::text,
    file_id text,
    file_unique_id text,
    public_url text,
    mime_type text,
    file_size integer,
    width integer,
    height integer,
    duration integer,
    user_id uuid NOT NULL,
    telegram_data jsonb,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    analyzed_content jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    chat_id bigint,
    chat_type text,
    error_message text,
    group_first_message_time timestamp with time zone,
    group_last_message_time timestamp with time zone,
    group_message_count integer DEFAULT 1,
    processing_state message_processing_state DEFAULT 'initialized'::message_processing_state,
    storage_path text,
    purchase_order_uid text,
    retry_count integer DEFAULT 0,
    last_error_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.analysis_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    media_group_id text,
    event_type text NOT NULL,
    old_state text,
    new_state text,
    analyzed_content jsonb,
    created_at timestamp with time zone DEFAULT now(),
    processing_details jsonb,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.other_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message_type text NOT NULL,
    chat_id bigint,
    chat_type text,
    chat_title text,
    message_text text,
    telegram_data jsonb,
    processing_state text DEFAULT 'completed'::text,
    processing_completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS messages_media_group_id_idx ON public.messages(media_group_id);
CREATE INDEX IF NOT EXISTS messages_file_unique_id_idx ON public.messages(file_unique_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS messages_processing_state_idx ON public.messages(processing_state);
CREATE INDEX IF NOT EXISTS audit_log_message_id_idx ON public.analysis_audit_log(message_id);
CREATE INDEX IF NOT EXISTS audit_log_media_group_id_idx ON public.analysis_audit_log(media_group_id);

-- Create RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users only" 
    ON public.profiles FOR INSERT 
    WITH CHECK (true);

-- Messages policies
CREATE POLICY "Allow authenticated users to view messages" 
    ON public.messages FOR SELECT 
    USING (true);

CREATE POLICY "Allow authenticated users to insert messages" 
    ON public.messages FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update messages" 
    ON public.messages FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated users to delete messages" 
    ON public.messages FOR DELETE 
    USING (true);

-- Analysis audit log policies
CREATE POLICY "Allow users to view audit logs" 
    ON public.analysis_audit_log FOR SELECT 
    USING (true);

CREATE POLICY "Allow authenticated users to insert audit logs" 
    ON public.analysis_audit_log FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update audit logs" 
    ON public.analysis_audit_log FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated users to delete audit logs" 
    ON public.analysis_audit_log FOR DELETE 
    USING (true);

-- Other messages policies
CREATE POLICY "Enable all operations for authenticated users on other_messages" 
    ON public.other_messages FOR ALL 
    USING (true);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_storage_on_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.storage_path IS NOT NULL THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'telegram-media'
        AND name = OLD.storage_path;
    END IF;

    IF OLD.file_unique_id IS NOT NULL AND OLD.mime_type IS NOT NULL THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'telegram-media'
        AND name LIKE OLD.file_unique_id || '.%';
    END IF;

    RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER set_timestamp_messages
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_timestamp_other_messages
    BEFORE UPDATE ON public.other_messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_cleanup_storage
    BEFORE DELETE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_storage_on_delete();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('telegram-media', 'telegram-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'telegram-media' );

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'telegram-media' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'telegram-media' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE
USING ( bucket_id = 'telegram-media' AND auth.role() = 'authenticated' );

-- Add necessary edge function secrets (these need to be set manually in the Supabase dashboard)
COMMENT ON DATABASE postgres IS 'Required secrets for edge functions:
- OPENAI_API_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET';