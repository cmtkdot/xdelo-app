# Project Brief: xdelo-app

## Project Overview
xdelo-app is a Telegram Message Processing System designed to handle, process, and analyze media messages from Telegram. The system downloads media from Telegram, stores it in Supabase Storage, analyzes captions for structured data, and maintains relationships between grouped media messages.

## Core Objectives
1. Efficiently process Telegram media messages (photos, videos, documents, audio)
2. Extract structured data from captions using pattern matching
3. Maintain relationships between media group messages
4. Provide error recovery and audit mechanisms
5. Support caption editing and content synchronization

## Key Components
1. **Telegram Webhook Handler**: Entry point for all Telegram updates
2. **Media Processing Pipeline**: Handles media downloads and storage
3. **Caption Analysis System**: Extracts product data from captions
4. **Media Group Synchronization**: Maintains relationships between grouped messages
5. **Error Handling and Recovery**: Provides mechanisms for error recovery
6. **Audit System**: Logs all system operations

## Technical Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Tremor
- **Backend**: Supabase (PostgreSQL, Storage, Edge Functions)
- **API Integration**: Telegram Bot API
- **Language**: TypeScript

## Success Criteria
1. Reliable processing of Telegram media messages
2. Accurate extraction of structured data from captions
3. Consistent synchronization of media group messages
4. Robust error handling and recovery mechanisms
5. Comprehensive audit logging
