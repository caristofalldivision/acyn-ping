import { useEffect, useState } from "react";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { KnowledgeBase } from "@/components/KnowledgeBase";
import { ConversationList } from "@/components/ConversationList";
import { ReviewLearning } from "@/components/ReviewLearning";
import { MemoryViewer } from "@/components/MemoryViewer";
import { LearningControl } from "@/components/LearningControl";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Brain, Menu } from "lucide-react";

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserKnowledge();
        createOrLoadDefaultConversation(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const createOrLoadDefaultConversation = async (userId: string) => {
    // Load most recent conversation
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
      // Create new conversation if none exists
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

  return (
    <div className="min-h-screen bg-background">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Brain className="w-12 h-12 mx-auto animate-pulse text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : !session ? (
        <Auth />
      ) : (
        <div className="container mx-auto p-4 min-h-screen">
          <header className="mb-8 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="icon" className="rounded-2xl">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-80 bg-card/95 backdrop-blur-xl border-border/30">
                  <div className="h-full">
                    <ConversationList
                      activeConversationId={activeConversationId}
                      onConversationSelect={(id) => {
                        setActiveConversationId(id);
                        setMobileMenuOpen(false);
                      }}
                      onNewConversation={handleNewConversation}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gradient-start to-gradient-end flex items-center justify-center glow-effect">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">Topher</h1>
            </div>
            <Button onClick={handleSignOut} variant="outline" className="rounded-2xl">
              Sign Out
            </Button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 h-[calc(100vh-140px)]">
            {/* Desktop conversation list */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="glass-card rounded-3xl border border-border/30 p-4 h-full">
                <ConversationList
                  activeConversationId={activeConversationId}
                  onConversationSelect={setActiveConversationId}
                  onNewConversation={handleNewConversation}
                />
              </div>
            </div>

            {/* Chat interface */}
            <div className="lg:col-span-3">
              <ChatInterface 
                conversationId={activeConversationId}
                userKnowledge={userKnowledge}
                onTitleGenerated={() => {}}
              />
            </div>

            {/* Memory System (Knowledge + Learned + Review) */}
            <div className="lg:col-span-2">
              <Card className="h-full glass-card rounded-3xl border-border/30">
                <Tabs defaultValue="manual" className="h-full flex flex-col">
                  <div className="p-4 pb-0">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-2xl">
                      <TabsTrigger value="manual" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-gradient-start data-[state=active]:to-gradient-end data-[state=active]:text-white">Manual</TabsTrigger>
                      <TabsTrigger value="learned" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-gradient-start data-[state=active]:to-gradient-end data-[state=active]:text-white">Learned</TabsTrigger>
                      <TabsTrigger value="review" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-gradient-start data-[state=active]:to-gradient-end data-[state=active]:text-white">Review</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="manual" className="flex-1 overflow-hidden">
                    <KnowledgeBase onKnowledgeUpdate={fetchUserKnowledge} />
                  </TabsContent>
                  <TabsContent value="learned" className="flex-1 p-4 overflow-hidden">
                    <MemoryViewer />
                  </TabsContent>
                  <TabsContent value="review" className="flex-1 p-4 overflow-hidden">
                    <ReviewLearning />
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
