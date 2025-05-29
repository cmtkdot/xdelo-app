
import React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

export function EnsureMatchingConfigColumn() {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Product matching configuration is managed through the system settings.
      </AlertDescription>
    </Alert>
  )
}
