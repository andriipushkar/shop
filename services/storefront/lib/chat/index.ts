// Re-export chat context
export {
  ChatProvider,
  useChat,
  type ChatMessage,
  type ChatAttachment,
  type Chat,
} from './chat-context';

// Re-export unique exports from chat service (avoid duplicate names)
export {
  chatService,
  useChatService,
  type ChatStatus,
  type ChatPriority,
  type ChatCategory,
  type ChatAgent,
  type ChatBotResponse,
  type ChatBotAction,
} from './chat-service';
