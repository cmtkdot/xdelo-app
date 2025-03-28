} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/auditLogger.ts"; // Import from dedicated module

interface ProcessAudioBody {
