import React from 'react';
import { MessageListContainer } from '../components/Messages/MessageListContainer';

export default function MessagesPage() {
  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
      </div>
      <MessageListContainer />
    </div>
  );
} 