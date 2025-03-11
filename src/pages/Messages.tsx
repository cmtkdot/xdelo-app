
import React from 'react';
import { Helmet } from 'react-helmet';
import MessageListContainer from '../components/Messages/MessageListContainer';

export default function MessagesPage() {
  return (
    <div className="container mx-auto">
      <Helmet>
        <title>Message Queue | Telegram Processing</title>
      </Helmet>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Message Processing Queue</h1>
      </div>
      
      <div className="space-y-6">
        <MessageListContainer />
      </div>
    </div>
  );
};
