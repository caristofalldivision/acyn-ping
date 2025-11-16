-- Create enum for knowledge confidence levels
CREATE TYPE knowledge_confidence AS ENUM ('high', 'medium', 'low');

-- Create enum for knowledge categories
CREATE TYPE knowledge_category AS ENUM ('facts', 'preferences', 'skills', 'goals', 'patterns', 'context');

-- Create learned_knowledge table for AI-discovered facts
CREATE TABLE public.learned_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category knowledge_category NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence knowledge_confidence NOT NULL,
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  learned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  importance_score INTEGER NOT NULL DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10),
  user_approved BOOLEAN DEFAULT NULL
);

-- Create knowledge_history table to track changes
CREATE TABLE public.knowledge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.learned_knowledge(id) ON DELETE CASCADE,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_sessions table to track background analysis
CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analyzed_messages_count INTEGER NOT NULL DEFAULT 0,
  new_knowledge_count INTEGER NOT NULL DEFAULT 0,
  updated_knowledge_count INTEGER NOT NULL DEFAULT 0,
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('completed', 'failed', 'in_progress'))
);

-- Enable RLS on all new tables
ALTER TABLE public.learned_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for learned_knowledge
CREATE POLICY "Users can view their own learned knowledge"
  ON public.learned_knowledge
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own learned knowledge"
  ON public.learned_knowledge
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learned knowledge"
  ON public.learned_knowledge
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert learned knowledge"
  ON public.learned_knowledge
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for knowledge_history
CREATE POLICY "Users can view their knowledge history"
  ON public.knowledge_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learned_knowledge
      WHERE id = knowledge_history.knowledge_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert knowledge history"
  ON public.knowledge_history
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for learning_sessions
CREATE POLICY "Users can view their own learning sessions"
  ON public.learning_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert learning sessions"
  ON public.learning_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update learning sessions"
  ON public.learning_sessions
  FOR UPDATE
  USING (true);

-- Create trigger for learned_knowledge updated_at
CREATE TRIGGER update_learned_knowledge_updated_at
  BEFORE UPDATE ON public.learned_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_learned_knowledge_user_id ON public.learned_knowledge(user_id);
CREATE INDEX idx_learned_knowledge_is_active ON public.learned_knowledge(is_active);
CREATE INDEX idx_learned_knowledge_importance ON public.learned_knowledge(importance_score);
CREATE INDEX idx_knowledge_history_knowledge_id ON public.knowledge_history(knowledge_id);
CREATE INDEX idx_learning_sessions_user_id ON public.learning_sessions(user_id);