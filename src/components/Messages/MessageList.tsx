import React from 'react';
import type { Message } from './types';
import { MessageControls } from './MessageControls';
import { format } from 'date-fns';

interface MessageListProps {
  messages: Message[];
  onRefresh?: () => void;
}

export function MessageList({ messages, onRefresh }: MessageListProps) {
  // Filter messages to show only those with captions but no analysis
  const unanalyzedMessages = messages.filter(message => 
    message.caption && 
    !message.analyzed_content
  );

  if (!unanalyzedMessages || unanalyzedMessages.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <div className="text-gray-500 text-lg">No unanalyzed messages found</div>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
        >
          Refresh Messages
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Media</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Details</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Analysis</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {unanalyzedMessages.map((message) => (
            <tr key={message.id} className="hover:bg-gray-50">
              <td className="py-4 pl-4 pr-3 sm:pl-6 max-w-[200px]">
                {message.public_url ? (
                  <div className="relative group">
                    <img 
                      src={message.public_url} 
                      alt={message.caption || 'Message media'} 
                      className="w-full h-auto rounded-lg cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => window.open(message.public_url, '_blank')}
                    />
                    {message.media_group_id && (
                      <span className="absolute top-2 right-2 px-2 py-1 text-xs bg-black bg-opacity-50 text-white rounded">
                        Group: {message.media_group_id}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No media</div>
                )}
              </td>
              <td className="px-3 py-4 text-sm text-gray-500">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">
                    {message.caption}
                  </div>
                  <div>ID: {message.id}</div>
                  {message.chat_title && (
                    <div>Chat: {message.chat_title}</div>
                  )}
                  {message.created_at && (
                    <div>Created: {format(new Date(message.created_at), 'MMM d, yyyy HH:mm')}</div>
                  )}
                </div>
              </td>
              <td className="px-3 py-4 text-sm text-gray-500">
                {message.analyzed_content ? (
                  <div className="space-y-1">
                    {message.analyzed_content.product_name && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Product:</span>
                        <span>{message.analyzed_content.product_name}</span>
                      </div>
                    )}
                    {message.analyzed_content.product_code && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Code:</span>
                        <span>{message.analyzed_content.product_code}</span>
                      </div>
                    )}
                    {message.analyzed_content.quantity && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Qty:</span>
                        <span>{message.analyzed_content.quantity}</span>
                      </div>
                    )}
                    {message.analyzed_content.parsing_metadata?.method && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                          ${message.analyzed_content.parsing_metadata.method === 'ai' ? 'bg-purple-100 text-purple-800' :
                            message.analyzed_content.parsing_metadata.method === 'manual' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {message.analyzed_content.parsing_metadata.method.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 italic">No analysis</span>
                )}
              </td>
              <td className="px-3 py-4 text-sm">
                <div className="space-y-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${message.processing_state === 'completed' ? 'bg-green-100 text-green-800' :
                      message.processing_state === 'error' ? 'bg-red-100 text-red-800' :
                      message.processing_state === 'processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                    {message.processing_state}
                  </span>
                  {message.retry_count > 0 && (
                    <div className="text-xs text-gray-500">
                      Retries: {message.retry_count}
                    </div>
                  )}
                  {message.error_message && (
                    <div className="text-xs text-red-600 max-w-xs truncate" title={message.error_message}>
                      {message.error_message}
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <MessageControls message={message} onSuccess={onRefresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 