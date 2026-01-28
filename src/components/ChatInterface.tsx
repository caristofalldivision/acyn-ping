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
    title: "Create Content", 
    subtitle: "Help me create a presentation",
    colorClass: "action-card-teal",
    iconColor: "text-action-teal"
  },
  { 
    icon: Lightbulb, 
    title: "Brainstorm", 
    subtitle: "Help me with creative ideas",
    colorClass: "action-card-green",
    iconColor: "text-action-green"
  },
  { 
    icon: Briefcase, 
    title: "Career Help", 
    subtitle: "Help me with job applications",
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
          <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto px-4">
            {/* Orbital rings around orb */}
            <div className="relative">
              <div className="absolute inset-0 w-80 h-80 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full border border-primary/10 animate-spin-slow" />
              <div className="absolute inset-0 w-96 h-96 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full border border-accent/5 animate-spin-slower" />
              
              {/* 3D Kinetic Core Orb */}
              <Suspense fallback={<VoiceOrb isListening={isListening} onMicClick={handleMicClick} size="lg" />}>
                <KineticCore isListening={isListening} onMicClick={handleMicClick} size="lg" />
              </Suspense>
            </div>
            
            {/* Greeting */}
            <div className="mt-10 text-center relative z-10">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Cosmic AI
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-muted-foreground">
                Hey, <span className="text-primary font-semibold">{userName}</span>!
              </p>
              <p className="text-base sm:text-lg text-muted-foreground/70 mt-2">
                Use hand gestures to command the AI Core
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl relative z-10">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => handleQuickAction(action)}
                  className={`action-card ${action.colorClass} text-left group`}
                >
                  <action.icon className={`w-7 h-7 ${action.iconColor} mb-3 group-hover:scale-110 transition-transform`} />
                  <h3 className="font-semibold text-foreground mb-1 text-base">{action.title}</h3>
                  <p className="text-xs text-muted-foreground/80">{action.subtitle}</p>
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
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center ring-1 ring-primary/20">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-5 py-4 ${
                  msg.role === "user" 
                    ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20" 
                    : "glass-card-strong"
                }`}>
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {detectDownloadableContent(msg.content) && (
                        <div className="mt-3 pt-3 border-t border-border/30">
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
                    <div className="w-9 h-9 rounded-xl bg-secondary/80 flex items-center justify-center ring-1 ring-border/30">
                      <User className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 justify-start fade-in">
                <div className="flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="glass-card-strong rounded-2xl px-5 py-4">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            className="fixed bottom-28 right-6 rounded-full shadow-lg glass-card-strong hover:bg-primary/20 z-20" 
            variant="ghost"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 glass-card-strong">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyPress={e => e.key === "Enter" && !loading && sendMessage()} 
              placeholder="Ask me anything..." 
              disabled={loading} 
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-0 px-0 text-base placeholder:text-muted-foreground/60" 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full flex-shrink-0 hover:bg-primary/10 h-9 w-9"
            >
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button 
              onClick={() => sendMessage()} 
              disabled={loading || !input.trim()} 
              size="icon"
              className="rounded-full h-10 w-10 cosmic-button flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
