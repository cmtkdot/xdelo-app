
// Next.js API route for storage path standardization
import { supabase } from '@/integrations/supabase/client';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get parameters from request body
    const { limit = 200, dryRun = false, messageIds = [] } = req.body;

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
      body: { 
        limit: Number(limit),
        dryRun: Boolean(dryRun),
        messageIds: Array.isArray(messageIds) ? messageIds : []
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    // Return success response
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error standardizing storage paths:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown error occurred' 
    });
  }
}
