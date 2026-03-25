import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, ArrowDown, Paperclip, FileText, Lightbulb, Terminal, Wifi, Save, Layout } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DownloadButton } from "./DownloadButton";
import { ScriptGenerator } from "./ScriptGenerator";
import { SavedScripts } from "./SavedScripts";
import { CaptivePortalBuilder } from "./CaptivePortalBuilder";

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

const suggestions = [
  { icon: Terminal, label: "Generate config scripts", prompt: "__OPEN_SCRIPTS__" },
  { icon: Wifi, label: "Setup a hotspot", prompt: "Help me set up a MikroTik hotspot from scratch. Ask me about my device model and RouterOS version first." },
  { icon: Lightbulb, label: "Brainstorm ideas", prompt: "Help me brainstorm ideas" },
  { icon: FileText, label: "Draft an email", prompt: "Help me draft a professional email" },
];

export const ChatInterface = ({
  conversationId,
  userKnowledge,
  onTitleGenerated,
  userName = "there",
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScriptGenerator, setShowScriptGenerator] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
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
        setMessages(data.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })));
      } else {
        setMessages([]);
      }
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    loadChatHistory();
  }, [conversationId]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const c = scrollContainerRef.current;
    if (c.scrollHeight - c.scrollTop - c.clientHeight < 100) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const c = scrollContainerRef.current;
    setShowScrollButton(c.scrollHeight - c.scrollTop - c.clientHeight >= 100);
  };

  const scrollToBottom = () => scrollRef.current?.scrollIntoView({ behavior: "smooth" });

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  const generateTitle = async (firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    if (conversationId && onTitleGenerated) {
      const { error } = await supabase.from("conversations").update({ title }).eq("id", conversationId);
      if (!error) onTitleGenerated(title);
    }
  };

  const sendMessage = async (content?: string) => {
    const messageContent = content || input;
    if (messageContent === "__OPEN_SCRIPTS__") {
      setShowScriptGenerator(true);
      return;
    }
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
        user_id: userId, conversation_id: conversationId, role: "user", content: messageContent,
      });

      if (messages.length === 0) await generateTitle(messageContent);

      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: [...messages, userMessage], userKnowledge, conversationId, userId },
      });
      if (error) throw error;

      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);

      await supabase.from("chat_messages").insert({
        user_id: userId, conversation_id: conversationId, role: "assistant", content: data.reply,
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const detectDownloadableContent = (content: string): { filename: string; mimeType: string } | null => {
    const codeMatch = content.match(/```(\w+)/);
    if (codeMatch) {
      const ext: Record<string, string> = { typescript: "ts", javascript: "js", python: "py", html: "html", css: "css", json: "json", sql: "sql" };
      return { filename: `code.${ext[codeMatch[1]] || "txt"}`, mimeType: "text/plain" };
    }
    if (content.includes("# PRD") || content.includes("# Product Requirements")) return { filename: "prd.md", mimeType: "text/markdown" };
    if (content.includes("## Proposal") || content.includes("# Proposal")) return { filename: "proposal.md", mimeType: "text/markdown" };
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showEmptyState = messages.length === 0;

  if (showScriptGenerator) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ScriptGenerator
          onSendToChat={(prompt) => {
            setShowScriptGenerator(false);
            sendMessage(prompt);
          }}
          onBack={() => setShowScriptGenerator(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {showEmptyState ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="max-w-lg w-full text-center space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  Hi, <span className="text-primary">{userName}</span>
                </h1>
                <p className="text-lg text-muted-foreground mt-2">What can I help with?</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.prompt)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary text-left transition-colors group"
                  >
                    <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    <span className="text-sm text-foreground">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[75%] ${
                  msg.role === "user"
                    ? "rounded-2xl rounded-br-md px-4 py-2.5 bg-primary text-primary-foreground"
                    : ""
                }`}>
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start fade-in">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex gap-1.5 py-3">
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}

        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            size="icon"
            variant="outline"
            className="fixed bottom-24 right-4 md:right-8 rounded-full h-8 w-8 shadow-lg z-10"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 md:p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl bg-card border border-border px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg flex-shrink-0 text-muted-foreground hover:text-foreground">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Topha..."
              disabled={loading}
              rows={1}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[36px] max-h-[200px] py-2 px-1 text-sm placeholder:text-muted-foreground"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-8 w-8 rounded-lg flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
            Topha can make mistakes. Consider checking important info.
          </p>
        </div>
      </div>
    </div>
  );
};
