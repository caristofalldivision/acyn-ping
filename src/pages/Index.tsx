import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { KnowledgeBase } from "@/components/KnowledgeBase";
import { Button } from "@/components/ui/button";
import { LogOut, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userKnowledge, setUserKnowledge] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        fetchUserKnowledge();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserKnowledge();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserKnowledge = async () => {
    const { data } = await supabase
      .from("user_knowledge")
      .select("*")
      .order("category", { ascending: true });
    setUserKnowledge(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "Come back soon!",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Brain className="w-16 h-16 mx-auto text-primary animate-glow" />
          <p className="text-muted-foreground">Initializing Topher...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary animate-glow" />
            <h1 className="text-2xl font-bold glow-text">TOPHER</h1>
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          {/* Chat Interface - Takes 2 columns on large screens */}
          <div className="lg:col-span-2 h-full">
            <ChatInterface userKnowledge={userKnowledge} />
          </div>

          {/* Knowledge Base - Takes 1 column on large screens */}
          <div className="h-full">
            <KnowledgeBase onKnowledgeUpdate={fetchUserKnowledge} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
