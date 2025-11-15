import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KnowledgeItem {
  id: string;
  category: string;
  key: string;
  value: string;
}

interface KnowledgeBaseProps {
  onKnowledgeUpdate: () => void;
}

export const KnowledgeBase = ({ onKnowledgeUpdate }: KnowledgeBaseProps) => {
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [category, setCategory] = useState("personal");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const categories = [
    "personal",
    "preferences",
    "schedule",
    "contacts",
    "goals",
    "health",
    "other",
  ];

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_knowledge")
      .select("*")
      .eq("user_id", user.id)
      .order("category", { ascending: true });

    if (error) {
      console.error("Error fetching knowledge:", error);
      return;
    }

    setKnowledge(data || []);
  };

  const addKnowledge = async () => {
    if (!key.trim() || !value.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("user_knowledge").upsert({
      user_id: user.id,
      category,
      key,
      value,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Knowledge added successfully",
      });
      setKey("");
      setValue("");
      fetchKnowledge();
      onKnowledgeUpdate();
    }

    setLoading(false);
  };

  const deleteKnowledge = async (id: string) => {
    const { error } = await supabase.from("user_knowledge").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Knowledge deleted",
      });
      fetchKnowledge();
      onKnowledgeUpdate();
    }
  };

  return (
    <Card className="glass-card flex flex-col h-full glow-border">
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-semibold glow-text">Knowledge Base</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Teach Topher about yourself
        </p>
      </div>

      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 border-b border-border">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Key (e.g., 'name' or 'favorite color')"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="bg-input border-border text-sm"
        />
        <Input
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="bg-input border-border text-sm"
        />
        <Button
          onClick={addKnowledge}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-sm"
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Add Knowledge
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-4">
        <div className="space-y-2">
          {knowledge.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-lg p-2 sm:p-3 fade-in"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-primary font-medium mb-1">
                    {item.category}
                  </div>
                  <div className="text-xs sm:text-sm font-medium">{item.key}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">
                    {item.value}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteKnowledge(item.id)}
                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8 p-0"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
