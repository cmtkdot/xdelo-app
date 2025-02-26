
CREATE OR REPLACE VIEW public.media_storage_status AS
SELECT 
    m.file_unique_id,
    m.mime_type,
    m.public_url,
    CASE 
        WHEN so.id IS NOT NULL THEN true
        ELSE false
    END as is_stored,
    so.created_at as storage_created_at,
    so.updated_at as storage_updated_at,
    so.bucket_id,
    m.telegram_message_id,
    m.created_at as message_created_at
FROM 
    messages m
LEFT JOIN 
    storage.objects so ON so.name = (m.file_unique_id || '.' || split_part(m.mime_type, '/', 2))
WHERE 
    m.file_unique_id IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.media_storage_status TO authenticated;
GRANT SELECT ON public.media_storage_status TO service_role;
