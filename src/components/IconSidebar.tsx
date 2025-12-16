import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Search, MessageSquare, List, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconSidebarProps {
  onNewConversation: () => void;
  onShowConversations: () => void;
}

export const IconSidebar = ({ onNewConversation, onShowConversations }: IconSidebarProps) => {
  const [activeItem, setActiveItem] = useState<string>("chat");

  const navItems = [
    { id: "new", icon: Plus, label: "New Chat", action: onNewConversation },
    { id: "search", icon: Search, label: "Search" },
    { id: "chat", icon: MessageSquare, label: "Chats", action: onShowConversations },
    { id: "list", icon: List, label: "History" },
  ];

  return (
    <div className="h-full w-16 flex flex-col items-center py-4 bg-sidebar-background border-r border-sidebar-border">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="icon"
            className={cn(
              "w-10 h-10 rounded-xl transition-all",
              activeItem === item.id 
                ? "bg-primary/20 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            onClick={() => {
              setActiveItem(item.id);
              item.action?.();
            }}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </Button>
        ))}
      </div>
    </div>
  );
};