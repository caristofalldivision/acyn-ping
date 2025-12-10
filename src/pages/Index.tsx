import { useEffect, useState } from "react";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { ConversationList } from "@/components/ConversationList";
import { SettingsPanel } from "@/components/SettingsPanel";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Brain, Menu, LogOut } from "lucide-react";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userKnowledge, setUserKnowledge] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        fetchUserKnowledge();
        createOrLoadDefaultConversation(session.user.id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserKnowledge();
        createOrLoadDefaultConversation(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Brain className="w-12 h-12 mx-auto animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-border/50 px-4 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="p-0 w-[85vw] max-w-72 bg-sidebar-background border-border"
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

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Topha</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SettingsPanel onKnowledgeUpdate={fetchUserKnowledge} />
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-secondary"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 border-r border-border/50 bg-sidebar-background flex-shrink-0 overflow-hidden">
          <ConversationList
            activeConversationId={activeConversationId}
            onConversationSelect={setActiveConversationId}
            onNewConversation={handleNewConversation}
          />
        </aside>

        {/* Chat area - ensure it doesn't bleed with min-w-0 */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <ChatInterface
            conversationId={activeConversationId}
            userKnowledge={userKnowledge}
            onTitleGenerated={() => {}}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
