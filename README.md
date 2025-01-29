Initial Upload Flow
When media is uploaded via Telegram, it goes through the webhook handler
Files are stored in the telegram-media bucket
Message records are created in the messages table with:
Basic metadata (file_id, mime_type, etc.)
Caption (if provided)
Media group ID (if part of a group)
Processing state set to 'initialized'
Caption Processing States

stateDiagram-v2
    [*] --> initialized
    initialized --> caption_ready: Has Caption
    caption_ready --> analyzing: AI Processing
    analyzing --> analysis_synced: Group Sync
    analysis_synced --> completed: All Done
For Already Uploaded Content:
Content sits in 'initialized' state if no caption
If caption is added/updated:
parse_caption_trigger runs first to extract basic info
trg_mg_01_init_message updates state to 'caption_ready'
trg_mg_02_proc_caption triggers AI analysis
trg_mg_03_sync_group_content syncs with group
trg_mg_04_check_completion marks as complete
Media Group Handling:
If any message in a group gets analyzed:
All group messages get same analyzed_content
Original caption message is marked (is_original_caption = true)
Other messages reference it (message_caption_id)
All marked as group_caption_synced = true
Data Structure:

{
  analyzed_content: {
    product_name?: string
    product_code?: string
    vendor_uid?: string
    purchase_date?: string
    quantity?: number
    notes?: string
  }
  processing_state: 'initialized' | 'caption_ready' | 'analyzing' | 'analysis_synced' | 'completed'
  is_original_caption: boolean
  message_caption_id?: string
  group_caption_synced: boolean
}
