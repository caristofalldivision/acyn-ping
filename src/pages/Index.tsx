import { useEffect, useState, lazy, Suspense } from "react";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { ConversationList } from "@/components/ConversationList";
import { IconSidebar } from "@/components/IconSidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Brain, Menu, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Lazy load cosmic background components
const Starfield = lazy(() => import("@/components/Starfield"));
const NebulaBackground = lazy(() => import("@/components/NebulaBackground"));
const FloatingParticles = lazy(() => import("@/components/FloatingParticles"));

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userKnowledge, setUserKnowledge] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        fetchUserKnowledge();
        createOrLoadDefaultConversation(session.user.id);
        extractUserName(session);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserKnowledge();
        createOrLoadDefaultConversation(session.user.id);
        extractUserName(session);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const extractUserName = async (session: Session) => {
    const email = session.user.email;
    const metadata = session.user.user_metadata;
    
    if (metadata?.full_name) {
      setUserName(metadata.full_name.split(" ")[0]);
    } else if (metadata?.name) {
      setUserName(metadata.name.split(" ")[0]);
    } else if (email) {
      setUserName(email.split("@")[0]);
    }

    const { data } = await supabase
      .from("learned_knowledge")
      .select("value")
      .eq("user_id", session.user.id)
      .eq("key", "user_name")
      .eq("is_active", true)
      .single();
    
    if (data?.value) {
      setUserName(data.value);
    }
  };

  const createOrLoadDefaultConversation = async (userId: string) => {
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    } else {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: "New Conversation" })
        .select()
        .single();
      if (newConv) {
        setActiveConversationId(newConv.id);
      }
    }
  };

  const handleNewConversation = async () => {
    if (!session?.user) return;
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ user_id: session.user.id, title: "New Conversation" })
      .select()
      .single();
    if (newConv) {
      setActiveConversationId(newConv.id);
    }
    setMobileMenuOpen(false);
    setShowConversations(false);
  };

  const fetchUserKnowledge = async () => {
    const { data } = await supabase
      .from("user_knowledge")
      .select("*")
      .order("category", { ascending: true });
    setUserKnowledge(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen cosmic-bg">
        <Suspense fallback={null}>
          <Starfield />
          <NebulaBackground />
        </Suspense>
        <div className="text-center space-y-4 relative z-10">
          <div className="relative">
            <Brain className="w-16 h-16 mx-auto text-primary animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full bg-primary/20 animate-ping" />
          </div>
          <p className="text-muted-foreground text-lg">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Cosmic background layers */}
      <div className="absolute inset-0 cosmic-bg" />
      <Suspense fallback={null}>
        <Starfield />
        <NebulaBackground />
        <FloatingParticles />
      </Suspense>

      {/* Icon Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-shrink-0 relative z-20">
        <IconSidebar 
          onNewConversation={handleNewConversation}
          onShowConversations={() => setShowConversations(!showConversations)}
        />
      </aside>

      {/* Conversations Panel - Desktop */}
      {showConversations && (
        <aside className="hidden lg:flex w-64 border-r border-border/30 glass-card flex-shrink-0 overflow-hidden relative z-20">
          <ConversationList
            activeConversationId={activeConversationId}
            onConversationSelect={(id) => {
              setActiveConversationId(id);
            }}
            onNewConversation={handleNewConversation}
          />
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Header */}
        <header className="flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-border/20 backdrop-blur-xl bg-background/40">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="left" 
                className="p-0 w-[85vw] max-w-72 glass-card border-border/30"
              >
                <ConversationList
                  activeConversationId={activeConversationId}
                  onConversationSelect={(id) => {
                    setActiveConversationId(id);
                    setMobileMenuOpen(false);
                  }}
                  onNewConversation={handleNewConversation}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-3 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center animate-glow-pulse">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Topha
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SettingsPanel onKnowledgeUpdate={fetchUserKnowledge} />
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <Avatar className="w-9 h-9 ring-2 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/20 text-primary text-sm font-medium">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Chat area */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <ChatInterface
            conversationId={activeConversationId}
            userKnowledge={userKnowledge}
            onTitleGenerated={() => {}}
            userName={userName}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
