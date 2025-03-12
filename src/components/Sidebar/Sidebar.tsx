import React from 'react';
import { Link } from 'react-router-dom';
import { HomeIcon, ListChecks, RocketIcon, DatabaseIcon } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="fixed h-screen w-64 pt-16 pb-4">
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden py-3 px-4 space-y-1">
        <Link
          to="/"
          className="flex items-center rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
        >
          <HomeIcon className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/message-queue"
          className="flex items-center rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
        >
          <RocketIcon className="mr-2 h-4 w-4" />
          <span>Message Queue</span>
        </Link>
        <Link
          to="/file-repair"
          className="flex items-center rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
        >
          <ListChecks className="mr-2 h-4 w-4" />
          <span>File Repair</span>
        </Link>
        
        {/* Add SQL Console link */}
        <Link
          to="/sql-console"
          className="flex items-center rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
        >
          <DatabaseIcon className="mr-2 h-4 w-4" />
          <span>SQL Console</span>
        </Link>
      </div>
    </aside>
  );
}
