
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Message } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString()
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function groupMessagesByMediaGroup(messages: Message[]): Message[][] {
  const groups: Record<string, Message[]> = {}
  const ungrouped: Message[] = []

  messages.forEach(message => {
    if (message.media_group_id) {
      if (!groups[message.media_group_id]) {
        groups[message.media_group_id] = []
      }
      groups[message.media_group_id].push(message)
    } else {
      ungrouped.push(message)
    }
  })

  // Return grouped messages as arrays, plus individual messages as single-item arrays
  return [
    ...Object.values(groups),
    ...ungrouped.map(msg => [msg])
  ]
}

export function getMediaItemFromMessage(message: Message) {
  return {
    id: message.id,
    public_url: message.public_url,
    mime_type: message.mime_type,
    caption: message.caption,
    width: message.width,
    height: message.height,
    duration: message.duration
  }
}
