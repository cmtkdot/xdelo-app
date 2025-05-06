import { cn } from '@/lib/utils';
import { Message } from '@/types';
import { EmptyState } from './grid/EmptyState';
import { MessageCard } from './grid/MessageCard';

interface MessageGridViewProps {
  messageGroups: Message[][];
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  selectedMessages: Record<string, Message>;
  hasMoreItems: boolean;
  onLoadMore: () => void;
}

export function MessageGridView({
  messageGroups,
  onSelect,
  onView,
  onEdit,
  onDelete,
  selectedMessages,
  hasMoreItems,
  onLoadMore
}: MessageGridViewProps) {
  if (!messageGroups || messageGroups.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className={cn(
        "grid gap-3",
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      )}>
        {messageGroups.map((group) => {
          // Skip empty groups
          if (!group || group.length === 0) return null;

          // Use the first message of each group for the card
          const message = group[0];

          return (
            <MessageCard
              key={message.id}
              message={message}
              onSelect={onSelect}
              onView={() => onView(group)}
              onEdit={onEdit}
              onDelete={onDelete}
              isSelected={!!selectedMessages[message.id]}
            />
          );
        })}
      </div>

      {hasMoreItems && (
        <div className="flex justify-center mt-4">
          <button
            onClick={onLoadMore}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-md text-sm font-medium"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
