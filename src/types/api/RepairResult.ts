
export interface RepairResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: Record<string, string>;
  messages: string[];
}
