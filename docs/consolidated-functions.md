
# Consolidated Database Functions

This document outlines the consolidated functions after the cleanup and optimization process.

## Media Group Functions

### xdelo_sync_media_group_content
- **Purpose**: Synchronizes analyzed content across all messages in a media group.
- **Improvements**:
  - Uses advisory locks to prevent concurrent updates to the same media group
  - Includes comprehensive error handling
  - Supports edit history synchronization
  - Updates group metadata consistently

### xdelo_check_media_group_content
- **Purpose**: Checks if a message can inherit analyzed content from its media group.
- **Improvements**:
  - Better handling of caption detection
  - Clear success/failure reporting
  - Proper transaction handling

### xdelo_repair_orphaned_media_group_messages
- **Purpose**: Finds and fixes media group messages that missed synchronization.
- **Improvements**:
  - Targeted repair for only affected messages
  - Logs repair attempts and results
  - Returns detailed information about repaired messages

## Message Processing Functions

### xdelo_get_message_processing_stats
- **Purpose**: Provides comprehensive statistics about message processing states.
- **Improvements**:
  - Includes all relevant processing states
  - Provides age information for oldest pending/processing messages
  - Detects stalled messages

### xdelo_reset_stalled_messages
- **Purpose**: Identifies and resets messages stuck in processing state.
- **Improvements**:
  - Configurable time threshold
  - Tracks processing time for stalled messages
  - Returns detailed information about reset operations

### xdelo_process_pending_messages
- **Purpose**: Processes messages in pending state, either by analyzing or syncing.
- **Improvements**:
  - Attempts media group sync first for efficiency
  - Handles errors consistently
  - Returns detailed processing results

## Maintenance Functions

### xdelo_repair_all_processing_systems
- **Purpose**: Comprehensive repair function that fixes multiple issues.
- **Features**:
  - Resets stalled messages
  - Repairs orphaned media group messages
  - Fixes message relationship inconsistencies
  - Returns detailed repair statistics

### xdelo_repair_message_relationships
- **Purpose**: Fixes inconsistencies in message relationships.
- **Features**:
  - Handles orphaned references to non-existent messages
  - Fixes media groups with multiple original caption claims
  - Provides detailed repair statistics

## Transaction Functions

### xdelo_begin_transaction
- **Purpose**: Begins a new database transaction for multi-step operations.
- **Features**:
  - Generates a unique transaction ID
  - Provides timestamp for tracking

### xdelo_update_message_with_analyzed_content
- **Purpose**: Safely updates a message with parsed content in a transaction.
- **Features**:
  - Row locking to prevent concurrent updates
  - Comprehensive error handling
  - Audit logging
  - Triggers media group synchronization

## Scheduled Maintenance

Three cron jobs have been established for regular maintenance:

1. **Every 5 minutes**: Processes pending messages
2. **Hourly**: Resets stalled messages
3. **Daily (3 AM)**: Comprehensive system repair

These jobs ensure the system remains healthy and data stays consistent without manual intervention.
