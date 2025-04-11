# XdeloMedia PostgreSQL Migration Scripts

This directory contains a comprehensive set of migration scripts for transferring your database structure and functionality to a new Supabase PostgreSQL instance. The scripts focus specifically on the media message and caption synchronization functionality.

## Migration Files Overview

### 1. Custom Types (`01_custom_types.sql`)

Defines all the custom ENUM types used throughout the application, including:
- `processing_state_type` - Tracks message processing states (initialized, pending, processing, completed, error)
- `audit_event_type` - Event types for the unified audit log system

### 2. Tables Creation (`02_tables_creation.sql`)

Creates the core tables for the application:
- `messages` - Stores media messages with captions, file information, and processing state
- `other_messages` - Stores non-media messages (text messages)
- `deleted_messages` - Archives deleted messages for auditing and recovery
- `unified_audit_logs` - Comprehensive audit trail for all system events

The `messages` table is designed with careful consideration for caption handling, including:
- `analyzed_content` - JSONB field for parsed caption data
- `old_analyzed_content` - JSONB array for storing edit history
- `media_group_id` - For grouping related media messages
- `is_original_caption` - Tracks the canonical source of a caption
- `group_caption_synced` - Indicates whether the message is in sync with its group

### 3. Database Indexes (`03_indexes.sql`)

Creates optimized indexes for efficient query performance, including:
- `idx_file_unique_id` - For finding messages by unique file ID
- `idx_messages_media_group_id` - For finding all messages in a media group
- `idx_messages_chat_telegram_message_id` - For finding messages by chat and message ID
- GIN indexes for JSONB fields to enable efficient searching of structured data

### 4. Core Functions (`04a_core_functions.sql`)

Implements essential database functions:
- `upsert_media_message` - Core function for inserting/updating media messages
- `upsert_text_message` - Function for inserting/updating text messages
- `xdelo_log_audit_event` - Comprehensive event logging

The `upsert_media_message` function handles the specialized logic for:
- Detecting caption changes
- Moving current `analyzed_content` to `old_analyzed_content` when captions change
- Resetting processing state for changed captions
- Setting appropriate flags for media group membership

### 5. Media Synchronization Functions (`04b_media_sync_functions.sql`)

Specialized functions for media group synchronization:
- `xdelo_sync_media_group` - Coordinates synchronization of content across messages in a group
- `sync_media_group_captions` - Updates captions for all messages in a group
- `trigger_sync_media_group_captions` - Handles automatic synchronization when captions change
- `xdelo_process_caption_workflow` - Processes caption updates with proper history preservation

### 6. Triggers (`05_triggers.sql`)

Creates trigger functions and triggers to enforce business rules:
- `prevent_unnecessary_message_updates` - Prevents redundant updates to messages
- `sync_caption_fields_trigger` - Keeps caption fields in sync
- `xdelo_log_deleted_message` - Logs message deletions to audit trail
- `trigger_sync_media_group_captions` - Ensures media group caption synchronization

### 7. Database Views (`06_database_views.sql`)

Creates views for optimized data access:
- `v_media_group_consistency` - Monitors media groups for synchronization issues
- `v_media_messages` - Provides streamlined access to media messages

### 8. RLS Policies (`07_rls_policies.sql`)

Sets up Row Level Security policies for proper data access control:
- Enables RLS on all relevant tables
- Creates policies for authenticated users to perform CRUD operations
- Ensures proper security boundaries while maintaining functionality

### 9. Supporting Functions (`08_supporting_functions.sql`)

Utility functions for edge functions and system maintenance:
- `xdelo_find_caption_message` - Finds caption sources in media groups
- `extract_media_dimensions` - Extracts dimensions from message data
- `align_caption_and_analyzed_content` - Ensures field consistency
- `xdelo_reset_stalled_messages` - Handles messages stuck in processing
- `xdelo_set_message_processing` and related functions - Manage message processing lifecycle

### 10. Validation and Testing (`09_validation_tests.sql`)

Comprehensive tests to validate the migration and document expected behavior:
- Schema validation tests
- Functional tests for media message insertion and synchronization
- Caption propagation and history preservation tests
- Test data cleanup and reporting mechanisms

## Usage Instructions

1. Run these scripts in sequential order (01 to 09) to create a complete working environment
2. After running all scripts, execute the validation script to verify functionality
3. For troubleshooting, check the detailed output from the validation script

## Key Features Preserved

- **Media Group Synchronization**: All messages in a media group maintain consistent captions
- **Caption History Preservation**: When captions change, previous versions are archived in `old_analyzed_content`
- **Processing State Management**: Caption changes trigger appropriate reprocessing
- **Audit Trail**: All significant actions are tracked in the unified audit logs
- **Security**: Row Level Security ensures proper data access control

## Database Schema Highlights

The `messages` table serves as the central hub for all media message handling with these key characteristics:
- Primary key: `id` (UUID)
- Unique constraint: `file_unique_id` (TEXT)
- Caption-related fields: `caption`, `analyzed_content`, `old_analyzed_content`
- Media group fields: `media_group_id`, `is_original_caption`, `group_caption_synced`
- Processing fields: `processing_state`, `error_message`, `retry_count`

These migration scripts ensure a smooth transition to your new database environment while preserving all the essential functionality of your media messaging system.
