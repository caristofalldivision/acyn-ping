-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add conversation_id to chat_messages (nullable initially)
ALTER TABLE public.chat_messages ADD COLUMN conversation_id UUID;

-- Create a default "General" conversation for each existing user
INSERT INTO public.conversations (user_id, title)
SELECT DISTINCT user_id, 'General'
FROM public.chat_messages
WHERE user_id IS NOT NULL;

-- Link all existing messages to the default conversation
UPDATE public.chat_messages cm
SET conversation_id = c.id
FROM public.conversations c
WHERE cm.user_id = c.user_id
  AND c.title = 'General'
  AND cm.conversation_id IS NULL;

-- Make conversation_id NOT NULL
ALTER TABLE public.chat_messages ALTER COLUMN conversation_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.chat_messages
  ADD CONSTRAINT fk_conversation
  FOREIGN KEY (conversation_id)
  REFERENCES public.conversations(id)
  ON DELETE CASCADE;

-- Add trigger to update conversations.updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);