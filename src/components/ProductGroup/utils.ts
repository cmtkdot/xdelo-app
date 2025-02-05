
import { MediaItem, AnalyzedContent } from "@/types";
import { format } from "date-fns";

export const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), 'MM/dd/yyyy');
  } catch (error) {
    console.error("Error formatting date:", error);
    return '';
  }
};

export const getMainMedia = (group: MediaItem[]) => {
  return group.find(media => media.is_original_caption) || group[0];
};

export const getAnalyzedContent = (group: MediaItem[]) => {
  const mainMedia = getMainMedia(group);
  return group.find(media => media.is_original_caption)?.analyzed_content || mainMedia.analyzed_content;
};

