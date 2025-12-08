import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Brain, TrendingUp, Sliders } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LearningSession {
  id: string;
  run_at: string;
  status: string;
  analyzed_messages_count: number;
  new_knowledge_count: number;
  updated_knowledge_count: number;
}

export function LearningControl() {
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("learning_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("run_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerManualLearning = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('background-learning');
      
      if (error) throw error;
      
      toast({
        title: "Learning Completed!",
        description: "Check the Memory tab for new insights.",
      });
      
      await loadSessions();
    } catch (error) {
      console.error("Learning failed:", error);
      toast({
        title: "Learning Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <Sliders className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Learning Control</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Topher automatically learns from your conversations every 6 hours
      </p>

      <Button 
        onClick={triggerManualLearning} 
        disabled={isRunning}
        className="w-full rounded-xl mb-4"
      >
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Learning...
          </>
        ) : (
          <>
            <TrendingUp className="mr-2 h-4 w-4" />
            Run Learning Now
          </>
        )}
      </Button>

      <h4 className="font-medium text-sm mb-3">Recent Sessions</h4>
      
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-4 bg-secondary/50 border-border/50">
          <p className="text-sm text-muted-foreground text-center">
            No learning sessions yet. Click "Run Learning Now" to start.
          </p>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-4">
            {sessions.map(session => (
              <Card key={session.id} className="p-3 bg-secondary/50 border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.run_at).toLocaleString()}
                  </span>
                  {getStatusBadge(session.status)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Analyzed {session.analyzed_messages_count} messages</div>
                  <div>Found {session.new_knowledge_count} new facts</div>
                  <div>Updated {session.updated_knowledge_count} existing</div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
