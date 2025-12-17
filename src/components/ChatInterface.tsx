import { useState, useRef, useEffect, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, ArrowDown, Sparkles, Paperclip, FileText, Lightbulb, Briefcase } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DownloadButton } from "./DownloadButton";
import { VoiceOrb } from "./VoiceOrb";

// Lazy load the KineticCore for better performance
const KineticCore = lazy(() => import("./KineticCore").then(m => ({ default: m.KineticCore })));

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  conversationId: string | null;
  userKnowledge: any[];
  onTitleGenerated?: (title: string) => void;
  userName?: string;
}

const quickActions = [
  { 
    icon: FileText, 
    title: "Content Help", 
    subtitle: "Help with me create a Presentation",
    colorClass: "action-card-teal",
    iconColor: "text-action-teal"
  },
  { 
    icon: Lightbulb, 
    title: "Suggestions", 
    subtitle: "Help with me Ideas",
    colorClass: "action-card-green",
    iconColor: "text-action-green"
  },
  { 
    icon: Briefcase, 
    title: "Job Application", 
    subtitle: "Help with me apply for job application",
    colorClass: "action-card-peach",
    iconColor: "text-action-peach"
  },
];

export const ChatInterface = ({
  conversationId,
  userKnowledge,
  onTitleGenerated,
  userName = "there"
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
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
          content: msg.content
        })));
      } else {
        setMessages([]);
      }
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };
    loadChatHistory();
  }, [conversationId]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const sendMessage = async (content?: string) => {
    const messageContent = content || input;
    if (!messageContent.trim() || loading || !conversationId) return;
    
    const userMessage: Message = { role: "user", content: messageContent };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active session");
      const userId = user.id;
      
      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        role: "user",
        content: messageContent
      });
      
      if (messages.length === 0) {
        await generateTitle(messageContent);
      }
      
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [...messages, userMessage],
          userKnowledge,
          conversationId,
          userId
        }
      });
      
      if (error) throw error;
      
      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);
      
      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        role: "assistant",
        content: data.reply
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const detectDownloadableContent = (content: string): { filename: string; mimeType: string } | null => {
    const codeMatch = content.match(/```(\w+)/);
    if (codeMatch) {
      const lang = codeMatch[1];
      const extensions: Record<string, string> = {
        typescript: "ts", javascript: "js", python: "py", java: "java",
        cpp: "cpp", html: "html", css: "css", json: "json", xml: "xml", sql: "sql"
      };
      return { filename: `code.${extensions[lang] || "txt"}`, mimeType: "text/plain" };
    }
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

  const handleMicClick = () => {
    setIsListening(!isListening);
    toast({ title: "Voice Input", description: "Voice input coming soon!" });
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    sendMessage(action.subtitle);
  };

  const showEmptyState = messages.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div 
        ref={scrollContainerRef} 
        onScroll={handleScroll} 
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {showEmptyState ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
            {/* 3D Kinetic Core Orb with WebGL fallback */}
            <Suspense fallback={<VoiceOrb isListening={isListening} onMicClick={handleMicClick} size="lg" />}>
              <KineticCore isListening={isListening} onMicClick={handleMicClick} size="lg" />
            </Suspense>
            
            {/* Greeting */}
            <div className="mt-12 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Hey! <span className="text-primary">{userName}</span>
              </h1>
              <p className="text-xl text-muted-foreground">What can I help with?</p>
            </div>
            
            {/* Quick Actions */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => handleQuickAction(action)}
                  className={`action-card ${action.colorClass} text-left`}
                >
                  <action.icon className={`w-6 h-6 ${action.iconColor} mb-3`} />
                  <h3 className="font-medium text-foreground mb-1">{action.title}</h3>
                  <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card border border-border"
                }`}>
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {detectDownloadableContent(msg.content) && (
                        <div className="mt-3 pt-3 border-t border-border">
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
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <User className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 justify-start fade-in">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button 
            onClick={scrollToBottom} 
            size="icon" 
            className="fixed bottom-28 right-6 rounded-full shadow-lg bg-card border border-border hover:bg-secondary z-10" 
            variant="ghost"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div 
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: "hsl(var(--card) / 0.8)",
              border: "1px solid hsl(var(--border) / 0.5)",
            }}
          >
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyPress={e => e.key === "Enter" && !loading && sendMessage()} 
              placeholder="Ask me anything..." 
              disabled={loading} 
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-0 px-0 text-base placeholder:text-muted-foreground" 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full flex-shrink-0 hover:bg-secondary h-9 w-9"
            >
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button 
              onClick={() => sendMessage()} 
              disabled={loading || !input.trim()} 
              size="icon"
              className="rounded-full h-9 w-9 bg-primary hover:bg-primary/90 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};