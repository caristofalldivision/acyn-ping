import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Check, X, MessageSquarePlus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  is_archived: boolean;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
}

const groupByDate = (conversations: Conversation[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  conversations.forEach((c) => {
    const d = new Date(c.updated_at);
    if (d >= today) groups[0].items.push(c);
    else if (d >= weekAgo) groups[1].items.push(c);
    else groups[2].items.push(c);
  });

  return groups.filter((g) => g.items.length > 0);
};

export const ConversationList = ({
  activeConversationId, onConversationSelect, onNewConversation,
}: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations").select("*").eq("user_id", user.id)
      .eq("is_archived", false).order("updated_at", { ascending: false });
    if (!error && data) setConversations(data);
  };

  const grouped = useMemo(() => groupByDate(conversations), [conversations]);

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    const { error } = await supabase.from("conversations").update({ title: editTitle.trim() }).eq("id", id);
    if (error) toast({ title: "Error", description: "Failed to update title", variant: "destructive" });
    else { await loadConversations(); setEditingId(null); }
  };

  const deleteConversation = async () => {
    if (!conversationToDelete) return;
    const { error } = await supabase.from("conversations").delete().eq("id", conversationToDelete);
    if (error) toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    else { await loadConversations(); if (conversationToDelete === activeConversationId) onNewConversation(); }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-3">
          <Button onClick={onNewConversation} variant="outline" className="w-full rounded-lg h-9 text-sm gap-2 border-border" size="sm">
            <MessageSquarePlus className="w-4 h-4" /> New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group relative rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      activeConversationId === conv.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    onClick={() => onConversationSelect(conv.id)}
                  >
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && saveEdit(conv.id)}
                          className="h-7 text-xs rounded-md bg-input"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(conv.id)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm truncate pr-12">{conv.title}</p>
                        <div
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md" onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md text-destructive" onClick={() => { setConversationToDelete(conv.id); setDeleteDialogOpen(true); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConversation} className="rounded-lg">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
