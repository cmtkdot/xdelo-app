
import { SyncLog } from "./types";

interface SyncLogsTableProps {
  logs: SyncLog[];
}

export const SyncLogsTable = ({ logs }: SyncLogsTableProps) => {
  return (
    <div className="border rounded-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs?.map((log) => (
            <tr key={log.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{log.table_name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{log.operation}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                  log.status === 'success' ? 'bg-green-100 text-green-800' : 
                  log.status === 'error' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {log.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{log.error_message}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(log.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
