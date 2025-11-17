import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Brain, TrendingUp } from "lucide-react";

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
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <CardTitle>Background Learning</CardTitle>
        </div>
        <CardDescription>
          Topher automatically learns from your conversations every 6 hours
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={triggerManualLearning} 
            disabled={isRunning}
            className="w-full"
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

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Recent Learning Sessions</h4>
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No learning sessions yet. Click "Run Learning Now" to start.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map(session => (
                  <div key={session.id} className="text-sm p-3 border rounded-lg bg-card">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-muted-foreground">
                        {new Date(session.run_at).toLocaleString()}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="text-muted-foreground space-y-1">
                      <div>📊 Analyzed {session.analyzed_messages_count} messages</div>
                      <div>✨ Found {session.new_knowledge_count} new facts</div>
                      <div>🔄 Updated {session.updated_knowledge_count} existing</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
