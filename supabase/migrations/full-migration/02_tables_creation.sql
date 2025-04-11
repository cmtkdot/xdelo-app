-- XdeloMedia Core Tables Migration
-- This script creates all the core tables needed for the application

-- Drop existing tables if migrating to a clean database (uncomment if needed)
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS other_messages CASCADE;
-- DROP TABLE IF EXISTS deleted_messages CASCADE;
-- DROP TABLE IF EXISTS unified_audit_logs CASCADE;
-- DROP TABLE IF EXISTS analysis_queue CASCADE;
-- DROP TABLE IF EXISTS product_matching_config CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS raw_product_entries CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;
-- DROP TABLE IF EXISTS sync_matches CASCADE;

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the messages table for storing media messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_message_id BIGINT,
    chat_id BIGINT,
    chat_type telegram_chat_type,
    chat_title TEXT,
    media_group_id TEXT,
    message_caption_id UUID,
    is_original_caption BOOLEAN DEFAULT FALSE,
    group_caption_synced BOOLEAN DEFAULT FALSE,
    caption TEXT,
    file_id TEXT,
    file_unique_id TEXT, -- Unique constraint added in separate migration
    public_url TEXT,
    mime_type TEXT,
    file_size BIGINT,
    is_edited BOOLEAN DEFAULT FALSE,
    edit_date TIMESTAMP WITH TIME ZONE,
    edit_history JSONB,
    edit_count INTEGER DEFAULT 0,
    storage_path TEXT,
    extraction_error TEXT,
    error_type TEXT,
    product_name TEXT,
    product_sku TEXT,
    product_price NUMERIC,
    product_price_currency TEXT,
    purchase_date DATE,
    product_quantity NUMERIC,
    product_category TEXT,
    product_description TEXT,
    store_name TEXT,
    product_url TEXT,
    forward_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_url TEXT,
    processing_state processing_state_type NOT NULL DEFAULT 'initialized',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_correlation_id UUID,
    analyzed_content JSONB,
    correlation_id TEXT,
    retry_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMP WITH TIME ZONE,
    purchase_order_uid TEXT,
    old_analyzed_content JSONB, -- Stores previous analysis results when caption changes
    old_product_name TEXT,
    old_product_description TEXT,
    old_purchase_date DATE,
    old_product_quantity NUMERIC,
    user_id UUID,
    duplicate_reference_id TEXT,
    telegram_metadata JSONB,
    is_edit BOOLEAN DEFAULT FALSE,
    trigger_source TEXT,
    message_type TEXT,
    text TEXT,
    media_type TEXT,
    extension TEXT,
    message_data JSONB, -- Complete Telegram message data
    processing_error TEXT,
    caption_data TEXT,
    message_date DATE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    is_forward BOOLEAN DEFAULT FALSE,
    forward_info JSONB -- Standardized forward information structure
);

-- Create the other_messages table for storing text and non-media messages
CREATE TABLE IF NOT EXISTS other_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    message_type TEXT NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    chat_type telegram_chat_type NOT NULL,
    chat_title TEXT,
    message_text TEXT,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    edit_date TIMESTAMP WITH TIME ZONE,
    edit_history JSONB,
    processing_state processing_state_type NOT NULL DEFAULT 'completed',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_correlation_id UUID,
    analyzed_content JSONB,
    old_analyzed_content JSONB, -- Array of previous analyzed content when text changes
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id TEXT,
    error_type TEXT,
    error_message TEXT,
    telegram_data JSONB, -- Complete Telegram message data
    message_url TEXT,
    is_forward BOOLEAN,
    forward_info JSONB, -- Standardized forward information structure
    retry_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMP WITH TIME ZONE,
    message_date TEXT,
    processing_error TEXT,
    message_data JSONB,
    edit_count BIGINT DEFAULT 0,
    
    -- Add unique constraint for telegram_message_id and chat_id
    CONSTRAINT unique_telegram_message UNIQUE (telegram_message_id, chat_id)
);

-- Create the deleted_messages table for tracking deleted messages
CREATE TABLE IF NOT EXISTS deleted_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID,
    telegram_message_id BIGINT,
    chat_id BIGINT,
    media_group_id TEXT,
    file_unique_id TEXT,
    caption TEXT,
    message_data JSONB,
    analyzed_content JSONB,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_by TEXT,
    deletion_reason TEXT,
    deletion_metadata JSONB
);

-- Create the unified_audit_logs table for tracking all system events
CREATE TABLE IF NOT EXISTS unified_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type audit_event_type NOT NULL,
    chat_id BIGINT,
    message_id BIGINT,
    user_id UUID,
    file_unique_id TEXT,
    media_group_id TEXT,
    entity_id UUID,
    entity_type TEXT,
    operation_type message_operation_type,
    correlation_id TEXT,
    metadata JSONB,
    error_message TEXT,
    previous_state JSONB,
    new_state JSONB,
    processing_time DOUBLE PRECISION
);

-- Create the analysis_queue table for message processing queue
CREATE TABLE IF NOT EXISTS analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    message_type TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    status processing_state DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    correlation_id TEXT,
    
    CONSTRAINT fk_message
        FOREIGN KEY(message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
);

-- Create the product_matching_config table for product matching configuration
CREATE TABLE IF NOT EXISTS product_matching_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    matching_rules JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    version INTEGER DEFAULT 1,
    description TEXT
);

-- Create the profiles table for user profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    website TEXT,
    telegram_id BIGINT,
    telegram_username TEXT,
    telegram_settings JSONB,
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Create the raw_product_entries table for product data
CREATE TABLE IF NOT EXISTS raw_product_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    raw_text TEXT,
    extracted_data JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_version TEXT,
    matched_product_id UUID,
    confidence_score NUMERIC,
    approval_status TEXT,
    user_feedback JSONB
);

-- Create the settings table for system settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_public BOOLEAN DEFAULT FALSE,
    schema JSONB
);

-- Create the sync_matches table for data synchronization
CREATE TABLE IF NOT EXISTS sync_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_id UUID NOT NULL,
    glide_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    direction sync_direction_type NOT NULL DEFAULT 'both',
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status sync_status DEFAULT 'pending',
    metadata JSONB,
    error_message TEXT,
    retries INTEGER DEFAULT 0,
    
    CONSTRAINT unique_sync_match UNIQUE (supabase_id, glide_id, table_name)
);
