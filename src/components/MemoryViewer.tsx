import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Save, X, History, Brain } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LearnedKnowledge {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: string;
  importance_score: number;
  version: number;
  learned_at: string;
  updated_at: string;
}

interface HistoryItem {
  id: string;
  old_value: string;
  new_value: string;
  reason: string | null;
  changed_at: string;
}

export const MemoryViewer = () => {
  const [knowledge, setKnowledge] = useState<LearnedKnowledge[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "style">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data, error } = await supabase
        .from("learned_knowledge")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("is_active", true)
        .or("user_approved.eq.true,user_approved.is.null")
        .order("importance_score", { ascending: false });

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error("Error fetching knowledge:", error);
    }
  };

  const fetchHistory = async (knowledgeId: string) => {
    try {
      const { data, error } = await supabase
        .from("knowledge_history")
        .select("*")
        .eq("knowledge_id", knowledgeId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleEdit = (item: LearnedKnowledge) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const handleSave = async (id: string, oldValue: string) => {
    try {
      await supabase.from("knowledge_history").insert({
        knowledge_id: id,
        old_value: oldValue,
        new_value: editValue,
        reason: "User manual edit",
      });

      const { error } = await supabase
        .from("learned_knowledge")
        .update({ 
          value: editValue,
          user_approved: true
        })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      fetchKnowledge();
      toast({
        title: "Knowledge updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update knowledge",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("learned_knowledge")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      fetchKnowledge();
      toast({
        title: "Knowledge archived",
        description: "This information has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete knowledge",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Learned Memory</h2>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("all")}
          className="rounded-lg"
        >
          All Knowledge
        </Button>
        <Button
          variant={viewMode === "style" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("style")}
          className="rounded-lg"
        >
          Communication Style
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {knowledge
            .filter((item) => {
              if (viewMode === "style") {
                return (
                  item.category === "preferences" &&
                  (item.key.includes("response") ||
                    item.key.includes("punctuation") ||
                    item.key.includes("detail") ||
                    item.key.includes("tone") ||
                    item.key.includes("format"))
                );
              }
              return true;
            })
            .map((item) => (
            <Card key={item.id} className="p-3 bg-secondary/50 border-border/50">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      <Badge variant="secondary" className="text-xs">v{item.version}</Badge>
                      <Badge variant="default" className="text-xs">
                        {item.importance_score}/10
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm">{item.key}</h4>
                    {editingId === item.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 h-8 text-sm rounded-lg"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSave(item.id, item.value)}
                          className="h-8 rounded-lg"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-lg"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{item.value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(item.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => fetchHistory(item.id)}
                          className="h-7 w-7 rounded-lg"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg bg-card border-border">
                        <DialogHeader>
                          <DialogTitle>History: {item.key}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2 pr-4">
                            {history.map((h) => (
                              <Card key={h.id} className="p-3 bg-secondary/50">
                                <p className="text-xs text-muted-foreground mb-1">
                                  {new Date(h.changed_at).toLocaleString()}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">Old:</span> {h.old_value}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">New:</span> {h.new_value}
                                </p>
                                {h.reason && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Reason: {h.reason}
                                  </p>
                                )}
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(item)}
                      className="h-7 w-7 rounded-lg"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
