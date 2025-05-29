
import { useState } from 'react'
import { Message } from '@/types'
import { useTelegramOperations } from './useTelegramOperations'

export function useMessageViewHandlers() {
  const [selectedMessages, setSelectedMessages] = useState<Record<string, Message>>({})
  const { deleteMessage: telegramDeleteMessage, isProcessing } = useTelegramOperations()

  const handleToggleSelect = (message: Message) => {
    setSelectedMessages(prev => {
      const newSelected = { ...prev }
      if (newSelected[message.id]) {
        delete newSelected[message.id]
      } else {
        newSelected[message.id] = message
      }
      return newSelected
    })
  }

  const clearSelection = () => {
    setSelectedMessages({})
  }

  const getSelectedMessageIds = () => {
    return Object.keys(selectedMessages)
  }

  const getSelectedMessagesArray = () => {
    return Object.values(selectedMessages)
  }

  const deleteMessage = async (message: Message, deleteTelegram: boolean = false) => {
    try {
      await telegramDeleteMessage(message, deleteTelegram)
      // Remove from selection if it was selected
      setSelectedMessages(prev => {
        const newSelected = { ...prev }
        delete newSelected[message.id]
        return newSelected
      })
    } catch (error) {
      console.error('Error deleting message:', error)
      throw error
    }
  }

  return {
    selectedMessages,
    handleToggleSelect,
    clearSelection,
    getSelectedMessageIds,
    getSelectedMessagesArray,
    deleteMessage,
    isProcessing
  }
}
