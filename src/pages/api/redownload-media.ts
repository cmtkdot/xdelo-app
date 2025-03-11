
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/integrations/supabase/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messageId, mediaGroupId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
      body: { 
        messageId,
        mediaGroupId,
        correlationId: crypto.randomUUID()
      }
    });

    if (error) {
      console.error('Error calling redownload function:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error in redownload API:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
