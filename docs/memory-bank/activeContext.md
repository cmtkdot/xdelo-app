# Active Context: xdelo-app

## Current Focus
The current focus is on improving the database functions and their documentation. This includes creating detailed TypeScript and JSDoc documentation for database functions with specifications of data structures, return types, and required inputs.

## Recent Changes
1. Fixed a critical issue in the Telegram webhook media processing flow:
   - Problem: Messages were being processed but not saved to the database correctly
   - Root cause: The `file_unique_id` field was being incorrectly set
   - Solution: Updated the `ProcessingResult` interface to include the `fileUniqueId` property and modified related functions

2. Implemented the new `MediaProcessor` class to replace legacy functions in `mediaUtils.ts`

## Pending Tasks
1. Create documentation for new database functions with detailed definitions, parameters, arguments, and exports
2. Clean up legacy code in `mediaUtils.ts` that is now duplicated in the `MediaProcessor` class
3. Implement proper handling for text-only messages in the `other_messages` table

## Technical Considerations
1. Database Schema:
   - `messages` table: Stores media messages with captions
   - `other_messages` table: Stores text-only messages (structure to be defined)

2. Caption Update Logic Requirements:
   - When a caption changes, move current `analyzed_content` to `old_analyzed_content` array
   - Reset `processing_state` to initiate reprocessing
   - Update `analyzed_content` with new parsed data
   - Sync updates to all messages sharing the same `media_group_id`

3. Critical Fields:
   - `file_unique_id`: Unique identifier for files from Telegram (used for duplicate detection)
   - `media_group_id`: For grouping related media messages (used for synchronization)
   - `processing_state`: Current processing state (used for workflow management)

## Documentation Requirements
1. Use TypeScript and JSDoc format for all documentation
2. Specify data structure, return types, and required inputs for all functions
3. Include examples for usage and edge cases
4. Follow the project's coding style guidelines (Airbnb Style Guide)

## Current Blockers
None identified at this time.

## Next Steps
1. Review existing database functions to identify documentation gaps
2. Create comprehensive documentation for all database functions
3. Implement tests to verify function behavior
4. Update the codebase to use the new `MediaProcessor` class instead of legacy functions
