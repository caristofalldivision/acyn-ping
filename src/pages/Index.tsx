import { useEffect, useState } from "react";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { ConversationList } from "@/components/ConversationList";
import { SettingsPanel } from "@/components/SettingsPanel";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Brain, Menu, LogOut, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userKnowledge, setUserKnowledge] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    if (metadata?.full_name) setUserName(metadata.full_name.split(" ")[0]);
    else if (metadata?.name) setUserName(metadata.name.split(" ")[0]);
    else if (email) setUserName(email.split("@")[0]);

    const { data } = await supabase
      .from("learned_knowledge")
      .select("value")
      .eq("user_id", session.user.id)
      .eq("key", "user_name")
      .eq("is_active", true)
      .single();
    if (data?.value) setUserName(data.value);
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
      if (newConv) setActiveConversationId(newConv.id);
    }
  };

  const handleNewConversation = async () => {
    if (!session?.user) return;
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ user_id: session.user.id, title: "New Conversation" })
      .select()
      .single();
    if (newConv) setActiveConversationId(newConv.id);
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
        <div className="text-center space-y-3">
          <Brain className="w-10 h-10 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:flex w-[260px] flex-col border-r border-border bg-sidebar-background flex-shrink-0">
          <div className="h-14 px-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Ping</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-secondary"
              onClick={handleNewConversation}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationList
              activeConversationId={activeConversationId}
              onConversationSelect={setActiveConversationId}
              onNewConversation={handleNewConversation}
            />
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-secondary text-foreground text-xs">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground truncate flex-1">{userName}</span>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 md:h-14 px-3 md:px-4 flex items-center justify-between border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] bg-sidebar-background border-border">
                <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
                  <Brain className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Ping</span>
                </div>
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

            {/* Mobile sidebar toggle hidden on desktop if sidebar visible */}
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-8 w-8 rounded-lg"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}

            <div className="flex items-center gap-2 md:hidden">
              <Brain className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Ping</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg md:hidden"
              onClick={handleNewConversation}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <SettingsPanel onKnowledgeUpdate={fetchUserKnowledge} />
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive md:hidden"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Chat */}
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
