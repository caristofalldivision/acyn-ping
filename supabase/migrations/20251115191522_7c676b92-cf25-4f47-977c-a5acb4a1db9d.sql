-- Create user knowledge base table
CREATE TABLE public.user_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, key)
);

-- Enable Row Level Security
ALTER TABLE public.user_knowledge ENABLE ROW LEVEL SECURITY;

-- Create policies for user knowledge
CREATE POLICY "Users can view their own knowledge"
ON public.user_knowledge
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge"
ON public.user_knowledge
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge"
ON public.user_knowledge
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge"
ON public.user_knowledge
FOR DELETE
USING (auth.uid() = user_id);

-- Create chat history table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat messages
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_knowledge_updated_at
BEFORE UPDATE ON public.user_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();