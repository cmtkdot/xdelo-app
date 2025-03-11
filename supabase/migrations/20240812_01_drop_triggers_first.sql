
-- Start transaction
BEGIN;

-- First drop the dependent trigger to avoid the error
DROP TRIGGER IF EXISTS xdelo_media_group_history_sync ON public.messages;

-- Commit transaction
COMMIT;
