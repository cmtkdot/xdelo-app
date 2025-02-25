# Telegram Webhook Flow - Detailed Implementation

## Message Processing Flow Diagram

```mermaid
flowchart TD
    A[Telegram Webhook Receives Message] --> B{Contains Media?}
    
    B -->|Yes| C[Upload to telegram-media storage]
    B -->|No| D[Store in other_messages table]
    
    C --> E{Has Caption?}
    
    E -->|Yes| F[Send for Manual Parsing]
    E -->|No| G{Is part of Media Group?}
    
    F --> H{Product Name > 23 chars?}
    
    H -->|Yes| I[Send to AI for Analysis]
    H -->|No| J[Use Manual Parsing Result]
    
    I --> K[Update analyzed_content]
    J --> K
    
    K --> L[Sync analyzed_content to all media in group]
    
    G -->|Yes| M{Group has message with analyzed_content?}
    G -->|No| N[Leave state as pending]
    
    M -->|Yes| O[Sync analyzed_content from group]
    M -->|No| N
</flowchart>
```

## Comprehensive Process Flow

### 1. Webhook Message Reception
- **Entry Point**: Telegram sends an update to the webhook endpoint
- **Data Received**: Contains message object with chat info, message ID, media (if any), caption (if any)
- **Initial Processing**: Log the incoming request with correlation ID for tracing
- **Validation**: Verify the update contains a valid message or channel post

### 2. Media Detection & Classification
- **Decision Point**: Check if message contains media (photo, video, document)
  - **Media Types Handled**:
    - Photos: Use largest size from photo array
    - Videos: Extract thumbnail and metadata
    - Documents: Process if they have visual content
  - **Non-Media Handling**: Route text messages, commands, etc. to other_messages table
  - **Data Extraction**: Get file_id, file_unique_id, dimensions, mime_type, etc.

### 3. Media Processing & Storage
- **Duplicate Check**: Query database for existing media with same file_unique_id
- **Storage Process**:
  - Get file URL from Telegram using getFile API
  - Download media content as binary data
  - Upload to 'telegram-media' bucket with file_unique_id as unique identifier
  - Generate public URL for future access
- **Database Storage**:
  - Store complete metadata in 'messages' table
  - Include chat info, message info, file details, processing state
  - Set initial processing_state to 'initialized' or 'pending' based on caption presence

### 4. Caption Analysis & Parsing
- **With Caption**:
  - **Manual Parsing Process**:
    - Extract product_name: Text before '#', line break, dash, or 'x'
    - Extract product_code: Text following '#' symbol
    - Extract vendor_uid: First 1-4 letters of product_code (uppercase)
    - Extract purchase_date: Parse date portion from product_code
      - Format 6 digits (mmDDyy) to YYYY-MM-DD
      - Format 5 digits (mDDyy) to YYYY-MM-DD with leading zero
    - Extract quantity: Number following 'x' or similar quantity indicators
    - Extract notes: Text in parentheses or remaining unclassified text
  - **AI Analysis Decision**:
    - Check if product_name length > 23 characters
    - If yes, send for AI analysis without considering confidence score
    - AI enhances extraction accuracy for complex product descriptions
  - **Result Storage**:
    - Update message record with analyzed_content
    - Set processing_state to 'completed'
    - Record processing timestamp

- **Without Caption**:
  - **Media Group Check**:
    - Query for other messages with same media_group_id
    - Look for any message in group with analyzed_content
    - If found, copy analyzed_content to current message
    - If not found, leave processing_state as 'pending'
    - System will update when caption-containing message arrives

### 5. Media Group Synchronization
- **Group Detection**: Identify all messages with same media_group_id
- **Source of Truth**: First message with caption becomes authoritative
- **Synchronization Process**:
  - Mark source message with is_original_caption = true
  - Update all other messages in group with:
    - Same analyzed_content
    - message_caption_id pointing to source message ID (explicitly linking non-caption holders to the caption holder)
    - is_original_caption = false
    - group_caption_synced = true
    - processing_state = 'completed'
  - Update group metadata (count, timestamps)
- **Handling Late Arrivals**:
  - If new message joins existing group, check for analyzed content
  - Apply group content if available, otherwise wait for caption
- **Message ID Propagation**:
  - All non-caption holders in the group receive the message_caption_id field
  - This creates a direct reference to the message containing the original caption
  - Enables efficient querying of related messages and their source caption

### 6. Error Handling & Recovery
- **Error States**: Track processing failures in error_message field
- **Retry Mechanism**: Increment retry_count and schedule retries
- **Logging**: Record all state transitions in message_state_logs table
- **Correlation**: Use correlation_id to track message processing across systems

## Data Structure Details

### analyzed_content Object Structure
```json
{
  "product_name": "Cannabis product name (text before '#')",
  "product_code": "Abbreviation with '#' prefix (e.g., #CHAD120523)",
  "vendor_uid": "Vendor short code (1-4 letters after '#')",
  "purchase_date": "Date in YYYY-MM-DD format (converted from mmDDyy or mDDyy)",
  "quantity": "Integer value (after 'x')",
  "notes": "Any other information not covered by other fields",
  "parsing_metadata": {
    "method": "manual | ai | hybrid",
    "confidence": "Score between 0.1 and 1.0",
    "timestamp": "ISO date string",
    "needs_ai_analysis": "Boolean based on product_name length > 23 chars"
  }
}
```

## Detailed Parsing Rules & Examples

### 1. Product Name Extraction
- **Rule**: Extract text before '#', line break, dash, or 'x'
- **Priority**: First delimiter encountered determines end of product name
- **Example**: "Blue Dream #CHAD120523 x2" → "Blue Dream"
- **Edge Case**: If no delimiter found, use entire caption as product name

### 2. Product Code Parsing
- **Format**: #[vendor_uid][purchase_date]
- **Regex**: `/#([A-Za-z0-9-]+)/`
- **Example**: "#CHAD120523" → "CHAD120523"
- **Validation**: Must follow # symbol, may contain letters, numbers, hyphens

### 3. Vendor UID Extraction
- **Rule**: First 1-4 uppercase letters in product_code
- **Regex**: `/^([A-Za-z]{1,4})/`
- **Examples**: 
  - "CHAD120523" → "CHAD"
  - "Z31524" → "Z"
- **Storage**: Always stored in uppercase

### 4. Purchase Date Parsing
- **Input Formats**:
  - 6 digits (mmDDyy): "120523" → "2023-12-05"
  - 5 digits (mDDyy): "31524" → "2024-03-15"
- **Process**:
  1. Extract digits after vendor_uid
  2. Add leading zero if 5 digits
  3. Parse month (first 2 digits)
  4. Parse day (next 2 digits)
  5. Parse year (last 2 digits, prefixed with "20")
  6. Validate as real date
  7. Format as YYYY-MM-DD
- **Validation**: Check if resulting date is valid and not in future

### 5. Quantity Detection
- **Primary Pattern**: Number after "x"
- **Alternative Patterns**:
  - "qty: 2"
  - "quantity: 2"
  - "2 pcs" or "2 pieces"
  - "2 units"
  - Standalone number at end
- **Example**: "Blue Dream #CHAD120523 x2" → quantity: 2
- **Validation**: Must be positive integer less than 10,000

### 6. Notes Extraction
- **Primary Source**: Text in parentheses
- **Alternative**: Any remaining text after removing product name, code, and quantity
- **Example**: "Blue Dream #CHAD120523 x2 (organic)" → notes: "organic"
- **Fallback Information**: If parsing encounters issues, fallback information is added to notes
