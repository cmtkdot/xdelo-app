import { useState, useCallback, useEffect } from 'react'
import { Message } from '@/types/entities/Message'

interface PublicViewerState {
  isOpen: boolean
  currentGroup: Message[]
  groupIndex: number
  itemIndex: number
}

export function usePublicViewer(messageGroups: Message[][] = []) {
  const [state, setState] = useState<PublicViewerState>({
    isOpen: false,
    currentGroup: [],
    groupIndex: -1,
    itemIndex: 0
  })

  // Debug logging when messageGroups change
  useEffect(() => {
    console.log('usePublicViewer: messageGroups updated', { 
      count: messageGroups.length,
      groupSizes: messageGroups.map(g => g.length)
    })
  }, [messageGroups])

  // Debug logging when state changes
  useEffect(() => {
    if (state.isOpen) {
      console.log('PublicViewer state changed:', { 
        isOpen: state.isOpen,
        groupIndex: state.groupIndex,
        groupSize: state.currentGroup.length,
        itemIndex: state.itemIndex
      })
    }
  }, [state])

  // Open the viewer with a specific message group
  const openViewer = useCallback((group: Message[], initialIndex = 0) => {
    console.log(`usePublicViewer: Opening viewer with group of ${group.length} items at index ${initialIndex}`)
    
    if (group.length === 0) {
      console.error('usePublicViewer: Cannot open viewer with empty group')
      return
    }
    
    // Log the first item in the group for debugging
    console.log('usePublicViewer: First item in group:', {
      id: group[0].id,
      caption: group[0].caption,
      mimeType: group[0].mime_type
    })
    
    let groupIndex = -1
    
    // Find the group in our groups array
    if (messageGroups.length > 0) {
      for (let i = 0; i < messageGroups.length; i++) {
        if (messageGroups[i].some(item => group.some(g => g.id === item.id))) {
          groupIndex = i
          break
        }
      }
    }
    
    console.log('openViewer resolved groupIndex:', groupIndex)
    
    setState({
      isOpen: true,
      currentGroup: group,
      groupIndex: groupIndex >= 0 ? groupIndex : 0,
      itemIndex: initialIndex >= 0 && initialIndex < group.length ? initialIndex : 0
    })
  }, [messageGroups])

  // Close the viewer
  const closeViewer = useCallback(() => {
    console.log('Closing viewer')
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Navigate to previous group
  const goToPreviousGroup = useCallback(() => {
    console.log('goToPreviousGroup called', { currentIndex: state.groupIndex })
    
    if (state.groupIndex <= 0 || !messageGroups.length) {
      console.log('Cannot go to previous group: at first group or no groups')
      return
    }
    
    const prevIndex = state.groupIndex - 1
    const prevGroup = messageGroups[prevIndex]
    
    if (prevGroup && prevGroup.length > 0) {
      console.log('Moving to previous group', { 
        newIndex: prevIndex, 
        groupSize: prevGroup.length 
      })
      
      setState({
        isOpen: true,
        currentGroup: prevGroup,
        groupIndex: prevIndex,
        itemIndex: 0
      })
    } else {
      console.warn('Previous group is empty or undefined')
    }
  }, [state.groupIndex, messageGroups])

  // Navigate to next group
  const goToNextGroup = useCallback(() => {
    console.log('goToNextGroup called', { 
      currentIndex: state.groupIndex,
      totalGroups: messageGroups.length
    })
    
    if (state.groupIndex < 0 || state.groupIndex >= messageGroups.length - 1) {
      console.log('Cannot go to next group: at last group or invalid index')
      return
    }
    
    const nextIndex = state.groupIndex + 1
    const nextGroup = messageGroups[nextIndex]
    
    if (nextGroup && nextGroup.length > 0) {
      console.log('Moving to next group', { 
        newIndex: nextIndex, 
        groupSize: nextGroup.length 
      })
      
      setState({
        isOpen: true,
        currentGroup: nextGroup,
        groupIndex: nextIndex,
        itemIndex: 0
      })
    } else {
      console.warn('Next group is empty or undefined')
    }
  }, [state.groupIndex, messageGroups])

  // Share functionality
  const shareCurrentItem = useCallback((mediaItem: Message, shareType: 'telegram' | 'direct') => {
    if (!mediaItem) {
      console.warn('Cannot share: no media item provided')
      return
    }
    
    let shareUrl = ''
    
    if (shareType === 'telegram' && mediaItem.chat_id && mediaItem.telegram_message_id) {
      const chatId = mediaItem.chat_id.toString().replace('-100', '')
      shareUrl = `https://t.me/c/${chatId}/${mediaItem.telegram_message_id}`
    } else if (shareType === 'direct' && mediaItem.public_url) {
      shareUrl = mediaItem.public_url
    }
    
    console.log('Sharing media item', { 
      id: mediaItem.id,
      type: shareType,
      url: shareUrl 
    })
    
    if (shareUrl) {
      try {
        if (navigator.share) {
          navigator.share({
            title: mediaItem.caption || 'Shared media',
            url: shareUrl
          })
        } else {
          window.open(shareUrl, '_blank')
        }
      } catch (error) {
        console.error('Error sharing content:', error)
        window.open(shareUrl, '_blank')
      }
    } else {
      console.warn('Cannot share: no valid URL generated')
    }
  }, [])

  return {
    isOpen: state.isOpen,
    currentGroup: state.currentGroup,
    groupIndex: state.groupIndex,
    itemIndex: state.itemIndex,
    hasNext: state.groupIndex < messageGroups.length - 1 && state.groupIndex >= 0,
    hasPrevious: state.groupIndex > 0,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup,
    shareCurrentItem
  }
} 