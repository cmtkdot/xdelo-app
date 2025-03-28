
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // Get the request body
    const body = await req.json();
    const { migration, description } = body;

    if (!migration) {
      return new Response(
        JSON.stringify({ error: "Migration name is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    let sql = "";
    
    // Define the available migrations
    switch (migration) {
      case "add_telegram_metadata_function":
        sql = `
          -- Create the metadata extraction function that mirrors the JavaScript implementation
          CREATE OR REPLACE FUNCTION public.xdelo_extract_telegram_metadata(telegram_data jsonb)
          RETURNS jsonb
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $function$
          DECLARE
            metadata jsonb;
            message_obj jsonb;
            message_type text;
            media jsonb;
          BEGIN
            -- Initialize with update_id if present
            metadata := jsonb_build_object(
              'update_id', telegram_data->'update_id'
            );
            
            -- Determine message type
            IF telegram_data ? 'message' THEN
              message_obj := telegram_data->'message';
              message_type := 'message';
            ELSIF telegram_data ? 'edited_message' THEN
              message_obj := telegram_data->'edited_message';
              message_type := 'edited_message';
            ELSIF telegram_data ? 'channel_post' THEN
              message_obj := telegram_data->'channel_post';
              message_type := 'channel_post';
            ELSIF telegram_data ? 'edited_channel_post' THEN
              message_obj := telegram_data->'edited_channel_post';
              message_type := 'edited_channel_post';
            ELSE
              -- Unknown message type, return minimal data
              RETURN metadata;
            END IF;
            
            -- Add message type to metadata
            metadata := metadata || jsonb_build_object('message_type', message_type);
            
            -- Extract essential message data
            IF message_obj IS NOT NULL THEN
              metadata := metadata || jsonb_build_object(
                'message_id', message_obj->'message_id',
                'date', message_obj->'date',
                'message_thread_id', message_obj->'message_thread_id'
              );
              
              -- Extract chat info
              IF message_obj ? 'chat' THEN
                metadata := metadata || jsonb_build_object(
                  'chat', jsonb_build_object(
                    'id', message_obj->'chat'->'id',
                    'type', message_obj->'chat'->'type',
                    'title', message_obj->'chat'->'title',
                    'username', message_obj->'chat'->'username'
                  )
                );
              END IF;
              
              -- Extract sender info
              IF message_obj ? 'from' THEN
                metadata := metadata || jsonb_build_object(
                  'from', jsonb_build_object(
                    'id', message_obj->'from'->'id',
                    'first_name', message_obj->'from'->'first_name',
                    'last_name', message_obj->'from'->'last_name',
                    'username', message_obj->'from'->'username',
                    'is_bot', message_obj->'from'->'is_bot'
                  )
                );
              END IF;
              
              -- Extract forwarded message info
              IF message_obj ? 'forward_date' OR message_obj ? 'forward_from' OR message_obj ? 'forward_from_chat' THEN
                metadata := metadata || jsonb_build_object(
                  'forward_info', jsonb_build_object(
                    'date', message_obj->'forward_date',
                    'from', message_obj->'forward_from',
                    'from_chat', CASE 
                      WHEN message_obj ? 'forward_from_chat' THEN
                        jsonb_build_object(
                          'id', message_obj->'forward_from_chat'->'id',
                          'type', message_obj->'forward_from_chat'->'type',
                          'title', message_obj->'forward_from_chat'->'title'
                        )
                      ELSE NULL
                    END,
                    'from_message_id', message_obj->'forward_from_message_id',
                    'signature', message_obj->'forward_signature',
                    'sender_name', message_obj->'forward_sender_name',
                    'origin', message_obj->'forward_origin'
                  )
                );
              END IF;
              
              -- Extract basic media info without large binary data
              IF message_obj ? 'photo' AND jsonb_array_length(message_obj->'photo') > 0 THEN
                -- For photo, just keep the largest version's metadata
                media := message_obj->'photo'->-1;
                metadata := metadata || jsonb_build_object(
                  'media', jsonb_build_object(
                    'type', 'photo',
                    'file_id', media->'file_id',
                    'file_unique_id', media->'file_unique_id',
                    'width', media->'width',
                    'height', media->'height',
                    'file_size', media->'file_size'
                  )
                );
              ELSIF message_obj ? 'video' THEN
                metadata := metadata || jsonb_build_object(
                  'media', jsonb_build_object(
                    'type', 'video',
                    'file_id', message_obj->'video'->'file_id',
                    'file_unique_id', message_obj->'video'->'file_unique_id',
                    'width', message_obj->'video'->'width',
                    'height', message_obj->'video'->'height',
                    'duration', message_obj->'video'->'duration',
                    'file_size', message_obj->'video'->'file_size',
                    'mime_type', message_obj->'video'->'mime_type'
                  )
                );
              ELSIF message_obj ? 'document' THEN
                metadata := metadata || jsonb_build_object(
                  'media', jsonb_build_object(
                    'type', 'document',
                    'file_id', message_obj->'document'->'file_id',
                    'file_unique_id', message_obj->'document'->'file_unique_id',
                    'file_name', message_obj->'document'->'file_name',
                    'file_size', message_obj->'document'->'file_size',
                    'mime_type', message_obj->'document'->'mime_type'
                  )
                );
              END IF;
              
              -- Extract text and caption
              metadata := metadata || jsonb_build_object(
                'text', message_obj->'text',
                'caption', message_obj->'caption',
                'caption_entities', message_obj->'caption_entities',
                'media_group_id', message_obj->'media_group_id'
              );
            END IF;
            
            RETURN metadata;
          END;
          $function$;

          -- Add or modify triggers that depend on this function
          DROP TRIGGER IF EXISTS trg_handle_telegram_data_insert ON public.messages;
          DROP TRIGGER IF EXISTS trg_handle_telegram_data_update ON public.messages;

          CREATE TRIGGER trg_handle_telegram_data_insert
          BEFORE INSERT ON public.messages
          FOR EACH ROW
          EXECUTE FUNCTION handle_telegram_data_insert();

          CREATE TRIGGER trg_handle_telegram_data_update
          BEFORE UPDATE ON public.messages
          FOR EACH ROW
          EXECUTE FUNCTION handle_telegram_data_update();
        `;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Unknown migration type" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
    }

    // Execute the SQL function
    const { data, error } = await supabaseClient.rpc("xdelo_execute_sql_migration", {
      sql_command: sql
    });

    if (error) {
      console.error("Error executing SQL migration:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message, 
          details: error.details || error.hint
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Log the executed migration
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: "system_migration_executed",
      entity_type: "database",
      metadata: {
        migration_name: migration,
        description: description || "Manual system migration",
        success: true,
        execution_timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        migration: migration,
        message: "Migration completed successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in migration function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred executing the migration"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
