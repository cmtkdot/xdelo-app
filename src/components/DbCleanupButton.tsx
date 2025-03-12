
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDbCleanup } from '@/hooks/useDbCleanup';

export function DbCleanupButton() {
  const { isLoading, results, cleanupFunctions } = useDbCleanup();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Database Function Cleanup</CardTitle>
        <CardDescription>
          Remove deprecated database functions with xdelo_ prefix
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 p-2 border rounded-md">
              <span className="font-medium">Functions checked:</span>
              <span>{results.results.checked}</span>
              <span className="font-medium">Functions removed:</span>
              <span className="text-green-600">{results.results.removed}</span>
              <span className="font-medium">Functions skipped:</span>
              <span className="text-yellow-600">{results.results.skipped}</span>
              <span className="font-medium">Errors:</span>
              <span className="text-red-600">{results.results.errors.length}</span>
            </div>
            
            {results.results.details.length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-medium mb-2">Details:</h4>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {results.results.details.map((detail: any, index: number) => (
                    <div key={index} className={`p-2 text-xs ${index % 2 ? 'bg-gray-50' : ''}`}>
                      <span className="font-medium">{detail.function}: </span>
                      <span className={
                        detail.status === 'removed' ? 'text-green-600' : 
                        detail.status === 'skipped' ? 'text-yellow-600' : 'text-red-600'
                      }>
                        {detail.status}
                      </span>
                      {detail.reason && <span> - {detail.reason}</span>}
                      {detail.error && <span className="text-red-600"> - {detail.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={cleanupFunctions} 
          disabled={isLoading}
          variant="destructive"
          className="w-full"
        >
          {isLoading ? 'Running Cleanup...' : 'Clean Up Database Functions'}
        </Button>
      </CardFooter>
    </Card>
  );
}
