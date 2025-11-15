import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  userKnowledge: any[];
}

export const ChatInterface = ({ userKnowledge }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        setMessages(data.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })));
      } else {
        // Show welcome message only if no history
        setMessages([{
          role: "assistant",
          content: "Hello! I'm Topher, your AI assistant. How can I help you today?",
        }]);
      }
    };

    loadChatHistory();
  }, []);

  // Smart auto-scroll: only scroll if user is near bottom
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Track scroll position to show/hide scroll button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Save user message
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "user",
          content: input,
        });
      }

      // Get AI response
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [...messages, userMessage],
          userKnowledge,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: data.reply,
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card flex flex-col h-full shadow-lg">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold">Chat with Topher</h2>
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto relative"
      >
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 fade-in ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm sm:text-base">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            size="icon"
            className="absolute bottom-4 right-4 rounded-full shadow-lg"
            variant="secondary"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
            className="bg-input border-border"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
