# XdeloMedia Full Database Migration

This directory contains a complete set of migration scripts for the XdeloMedia application database. The scripts should be run in the following order:

1. `01_custom_types.sql` - Creates all custom enum types needed by the application
2. `02_tables_creation.sql` - Creates the core tables with their basic structure
3. `03_indexes.sql` - Creates all necessary indexes for performance optimization
4. `04_functions.sql` - Creates the core database functions
5. `05_triggers.sql` - Sets up all triggers for automated data handling
6. `06_views.sql` - Creates database views
7. `07_rls_policies.sql` - Sets up Row Level Security policies
8. `08_extensions.sql` - Enables any required PostgreSQL extensions

Each script is designed to be run independently, but they should be executed in sequence to ensure proper dependencies are maintained.

## Migration Strategy

1. Create a backup of the existing database
2. Run the scripts in sequence
3. Verify data integrity after migration

## Key Tables

- `messages` - Stores media messages (photos, videos, documents)
- `other_messages` - Stores text messages and non-media content
- `unified_audit_logs` - Tracks all system actions and events
- `product_matching_config` - Configuration for product matching
- `profiles` - User profile information
- `settings` - System settings

## Important Functions

- `upsert_media_message` - Handles media message creation and updates
- `upsert_text_message` - Handles text message creation and updates
- `xdelo_sync_media_group` - Synchronizes media group captions and content
- `xdelo_process_caption_workflow` - Processes caption analysis workflow
