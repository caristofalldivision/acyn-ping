import { useState, useRef, useEffect } from "react";
import { X, Send, Calendar, Mail, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BubbleChatProps {
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const quickActions = [
  { icon: Calendar, label: "Schedule", prompt: "What's on my schedule today?" },
  { icon: Mail, label: "Email", prompt: "Help me send a quick email" },
  { icon: Clock, label: "Remind", prompt: "Set a reminder for me" },
];

export const BubbleChat = ({ onClose }: BubbleChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey! How can I help you quickly?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Please sign in",
          description: "You need to be signed in to use quick chat.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Build messages array for the chat function
      const chatMessages = [
        ...messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content }
      ];

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: chatMessages,
          userKnowledge: [],
          userId: session.user.id,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply || "I couldn't process that request.",
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Quick chat error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] 
                 rounded-2xl overflow-hidden bubble-chat-enter"
      style={{
        background: "hsl(var(--card) / 0.95)",
        backdropFilter: "blur(20px)",
        boxShadow: `
          0 0 40px hsl(var(--orb-glow) / 0.15),
          0 8px 32px hsl(var(--background) / 0.5),
          0 0 0 1px hsl(var(--border) / 0.5)
        `,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Quick Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-muted"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`text-sm ${
              msg.role === "user"
                ? "text-right"
                : "text-left"
            }`}
          >
            <span
              className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="text-left">
            <span className="inline-block px-3 py-2 rounded-2xl rounded-bl-sm bg-muted">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 px-3 pb-2">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs gap-1 rounded-full border-border/50 hover:bg-muted"
            onClick={() => sendMessage(action.prompt)}
            disabled={isLoading}
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 pt-1 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-9 text-sm rounded-full bg-muted/50 border-border/50"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
