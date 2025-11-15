import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DownloadButton } from "./DownloadButton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  conversationId: string | null;
  userKnowledge: any[];
  onTitleGenerated?: (title: string) => void;
}

export const ChatInterface = ({ 
  conversationId, 
  userKnowledge,
  onTitleGenerated 
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load chat history when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([{
        role: "assistant",
        content: "Hello! I'm Topher, your AI assistant. How can I help you today?",
      }]);
      return;
    }

    const loadChatHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!error && data && data.length > 0) {
        setMessages(data.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })));
      } else {
        setMessages([{
          role: "assistant",
          content: "Hello! I'm Topher, your AI assistant. How can I help you today?",
        }]);
      }

      // Scroll to bottom when conversation loads
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };

    loadChatHistory();
  }, [conversationId]);

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

  const generateTitle = async (firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    if (conversationId && onTitleGenerated) {
      const { error } = await supabase
        .from("conversations")
        .update({ title })
        .eq("id", conversationId);
      
      if (!error) {
        onTitleGenerated(title);
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !conversationId) return;

    const userMessage: Message = { role: "user", content: input };
    const userInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Save user message
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          conversation_id: conversationId,
          role: "user",
          content: userInput,
        });

        // Generate title from first message
        if (messages.length <= 1) {
          await generateTitle(userInput);
        }
      }

      // Get AI response
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [...messages, userMessage],
          userKnowledge,
          conversationId,
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
          conversation_id: conversationId,
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

  const detectDownloadableContent = (content: string): { filename: string; mimeType: string } | null => {
    // Detect code blocks with language
    const codeMatch = content.match(/```(\w+)/);
    if (codeMatch) {
      const lang = codeMatch[1];
      const extensions: Record<string, string> = {
        typescript: "ts",
        javascript: "js",
        python: "py",
        java: "java",
        cpp: "cpp",
        html: "html",
        css: "css",
        json: "json",
        xml: "xml",
        sql: "sql",
      };
      return {
        filename: `code.${extensions[lang] || "txt"}`,
        mimeType: "text/plain",
      };
    }

    // Detect structured documents
    if (content.includes("# Product Requirements Document") || content.includes("# PRD")) {
      return { filename: "prd.md", mimeType: "text/markdown" };
    }
    if (content.includes("CONTRACT") || content.includes("AGREEMENT")) {
      return { filename: "contract.txt", mimeType: "text/plain" };
    }
    if (content.includes("## Proposal") || content.includes("# Proposal")) {
      return { filename: "proposal.md", mimeType: "text/markdown" };
    }

    return null;
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
                  <>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {detectDownloadableContent(msg.content) && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <DownloadButton
                          content={msg.content}
                          filename={detectDownloadableContent(msg.content)!.filename}
                          mimeType={detectDownloadableContent(msg.content)!.mimeType}
                        />
                      </div>
                    )}
                  </>
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
