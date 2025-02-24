
import { Message as BaseMessage } from "@/types";

export type Message = BaseMessage;

export interface MessageControlsProps {
  message: Message;
  onSuccess?: () => void;
}
