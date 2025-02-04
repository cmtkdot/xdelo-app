import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GlideColumnMapping {
  [key: string]: {
    type: string;
    name: string;
  };
}

const columnMapping: GlideColumnMapping = {
  id: { type: "string", name: "mFvhH" },
  telegramMessageId: { type: "number", name: "59aiF" },
  mediaGroupId: { type: "string", name: "3tdPG" },
  messageCaptionId: { type: "string", name: "BSLlx" },
  isOriginalCaption: { type: "boolean", name: "1QYuk" },
  groupCaptionSynced: { type: "boolean", name: "551pz" },
  caption: { type: "string", name: "iFtJQ" },
  fileId: { type: "string", name: "ImQQi" },
  fileUniqueId: { type: "string", name: "rxGro" },
  publicUrl: { type: "uri", name: "9xPNx" },
  mimeType: { type: "string", name: "L9F1w" },
  telegramData: { type: "string", name: "8fwgA" },
  analyzedContent: { type: "string", name: "TUJHC" },
  createdAt: { type: "string", name: "IocHd" },
  updatedAt: { type: "string", name: "r2UKT" },
  groupMessageCount: { type: "number", name: "fNLdN" },
  processingState: { type: "string", name: "THs1j" },
  supabseSyncJson: { type: "string", name: "xJ8jN" }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const GLIDE_API_TOKEN = Deno.env.get('GLIDE_API_TOKEN')
    const GLIDE_APP_ID = '5XJos60qGtkJzQUb5cJq'
    const GLIDE_TABLE_ID = 'native-table-dR5SGqrIbrfg2OKEWWB3'

    if (!GLIDE_API_TOKEN) {
      throw new Error('Missing GLIDE_API_TOKEN')
    }

    const { operation, data } = await req.json()

    // Prepare the mutation based on the operation type
    let mutation;
    if (operation === 'delete') {
      mutation = {
        kind: 'delete-row-from-table',
        tableName: GLIDE_TABLE_ID,
        rowID: data.glide_row_id
      }
    } else {
      // For insert and update operations
      const columnValues = {}
      for (const [key, value] of Object.entries(columnMapping)) {
        const dataKey = key.replace(/([A-Z])/g, '_$1').toLowerCase() // Convert camelCase to snake_case
        if (data[dataKey] !== undefined) {
          columnValues[value.name] = data[dataKey]
        }
      }

      mutation = {
        kind: 'add-row-to-table',
        tableName: GLIDE_TABLE_ID,
        columnValues
      }
    }

    // Send request to Glide API
    const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLIDE_API_TOKEN}`
      },
      body: JSON.stringify({
        appID: GLIDE_APP_ID,
        mutations: [mutation]
      })
    })

    const result = await response.json()

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})