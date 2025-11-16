import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LearnedItem {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: string;
  importance_score: number;
  learned_at: string;
  user_approved: boolean | null;
}

export const ReviewLearning = () => {
  const [pendingItems, setPendingItems] = useState<LearnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const fetchPendingItems = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from("learned_knowledge")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("is_active", true)
        .is("user_approved", null)
        .order("learned_at", { ascending: false });

      if (error) throw error;
      setPendingItems(data || []);
    } catch (error) {
      console.error("Error fetching pending items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("learned_knowledge")
        .update({ user_approved: true })
        .eq("id", id);

      if (error) throw error;

      setPendingItems(pendingItems.filter(item => item.id !== id));
      toast({
        title: "Knowledge approved",
        description: "Topher will use this information in future conversations.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve knowledge",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("learned_knowledge")
        .update({ user_approved: false, is_active: false })
        .eq("id", id);

      if (error) throw error;

      setPendingItems(pendingItems.filter(item => item.id !== id));
      toast({
        title: "Knowledge rejected",
        description: "This information won't be used.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject knowledge",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          No pending knowledge to review. Topher will automatically learn from your conversations.
        </p>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 pr-4">
        {pendingItems.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{item.category}</Badge>
                    <Badge variant="secondary">
                      Confidence: {item.confidence}
                    </Badge>
                    <Badge variant="default">
                      Importance: {item.importance_score}/10
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm">{item.key}</h4>
                  <p className="text-sm text-muted-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">
                    Learned {new Date(item.learned_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApprove(item.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
