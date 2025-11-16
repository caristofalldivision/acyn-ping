import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Save, X, History } from "lucide-react";
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
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
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
      setSelectedKnowledgeId(knowledgeId);
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
      // Save to history
      await supabase.from("knowledge_history").insert({
        knowledge_id: id,
        old_value: oldValue,
        new_value: editValue,
        reason: "User manual edit",
      });

      // Update knowledge
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
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 pr-4">
        {knowledge.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{item.category}</Badge>
                    <Badge variant="secondary">v{item.version}</Badge>
                    <Badge variant="default">
                      Importance: {item.importance_score}/10
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm">{item.key}</h4>
                  {editingId === item.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(item.id, item.value)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(item.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchHistory(item.id)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Knowledge History: {item.key}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3 pr-4">
                          {history.map((h) => (
                            <Card key={h.id} className="p-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(h.changed_at).toLocaleString()}
                                </p>
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    <span className="font-semibold">Old:</span> {h.old_value}
                                  </p>
                                  <p className="text-sm">
                                    <span className="font-semibold">New:</span> {h.new_value}
                                  </p>
                                  {h.reason && (
                                    <p className="text-xs text-muted-foreground">
                                      Reason: {h.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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
