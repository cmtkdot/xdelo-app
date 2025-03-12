
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useSqlQuery } from '@/hooks/useSqlQuery';

export function SqlConsole() {
  const [sqlQuery, setSqlQuery] = useState('');
  const { executeQuery, isExecuting, results } = useSqlQuery();
  const [activeTab, setActiveTab] = useState('table');

  const handleExecute = async () => {
    if (!sqlQuery.trim()) return;
    await executeQuery(sqlQuery);
  };

  const renderResultsTable = () => {
    if (!results?.data || !Array.isArray(results.data)) {
      return <div className="p-4 text-gray-500">No results to display</div>;
    }

    const firstRow = results.data[0];
    if (!firstRow) {
      return <div className="p-4 text-gray-500">Query returned 0 rows</div>;
    }

    const columns = Object.keys(firstRow);

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((column) => (
                <th key={column} className="border px-4 py-2 text-left">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column}`} className="border px-4 py-2">
                    {renderCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCellValue = (value: any) => {
    if (value === null) return <span className="text-gray-400">NULL</span>;
    if (typeof value === 'object') return <span className="text-blue-600">{JSON.stringify(value)}</span>;
    return String(value);
  };

  const renderResultsJson = () => {
    if (!results) return null;
    
    return (
      <pre className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm rounded">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  const renderMetadata = () => {
    if (!results?.metadata) return null;
    
    return (
      <div className="text-sm text-gray-500 mt-2">
        <p>Execution time: {results.metadata.execution_time_ms}ms</p>
        <p>Rows: {results.metadata.row_count}</p>
        <p>Query hash: {results.metadata.query_hash}</p>
      </div>
    );
  };

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>SQL Console</CardTitle>
          <CardDescription>
            Execute SQL queries directly against your Supabase database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your SQL query here..."
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="font-mono text-sm min-h-32"
            />
            
            <div className="flex justify-between items-center">
              <Button
                onClick={handleExecute}
                disabled={isExecuting || !sqlQuery.trim()}
                className="flex items-center"
              >
                {isExecuting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Executing...
                  </>
                ) : (
                  'Execute Query'
                )}
              </Button>
              
              {results && (
                <div className="text-sm text-gray-500">
                  {results.success ? 
                    `Success: ${results.data?.length || 0} rows returned` : 
                    `Error: ${results.error}`
                  }
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        {results && (
          <CardFooter className="flex flex-col items-start pt-4 pb-6">
            {renderMetadata()}
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="json">JSON View</TabsTrigger>
              </TabsList>
              <TabsContent value="table" className="border rounded-md mt-2">
                {renderResultsTable()}
              </TabsContent>
              <TabsContent value="json" className="mt-2">
                {renderResultsJson()}
              </TabsContent>
            </Tabs>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
