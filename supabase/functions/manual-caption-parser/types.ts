
export interface AnalysisRequest {
  messageId: string;
  caption?: string;
  media_group_id?: string;
  correlationId?: string;
  isEdit?: boolean;
  trigger_source?: string;
}

export interface MediaGroupResult {
  success: boolean;
  synced_count: number;
  media_group_id: string;
  error?: string;
}
