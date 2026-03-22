import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, Database, Brain, CheckCircle, Sliders, CalendarDays, MessageSquare } from "lucide-react";
import { KnowledgeBase } from "./KnowledgeBase";
import { MemoryViewer } from "./MemoryViewer";
import { ReviewLearning } from "./ReviewLearning";
import { LearningControl } from "./LearningControl";
import { CalendarView } from "./CalendarView";
import { MessageHistory } from "./MessageHistory";

interface SettingsPanelProps {
  onKnowledgeUpdate: () => void;
}

export const SettingsPanel = ({ onKnowledgeUpdate }: SettingsPanelProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl bg-background border-border overflow-hidden flex flex-col">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">Settings</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-6 bg-secondary p-1 rounded-lg">
            {[
              { value: "calendar", icon: CalendarDays, label: "Calendar" },
              { value: "messages", icon: MessageSquare, label: "Messages" },
              { value: "training", icon: Database, label: "Training" },
              { value: "memory", icon: Brain, label: "Memory" },
              { value: "review", icon: CheckCircle, label: "Review" },
              { value: "learning", icon: Sliders, label: "Learning" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Icon className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="calendar" className="h-full m-0 overflow-auto"><CalendarView /></TabsContent>
            <TabsContent value="messages" className="h-full m-0 overflow-auto"><MessageHistory /></TabsContent>
            <TabsContent value="training" className="h-full m-0 overflow-auto"><KnowledgeBase onKnowledgeUpdate={onKnowledgeUpdate} /></TabsContent>
            <TabsContent value="memory" className="h-full m-0 overflow-auto"><MemoryViewer /></TabsContent>
            <TabsContent value="review" className="h-full m-0 overflow-auto"><ReviewLearning /></TabsContent>
            <TabsContent value="learning" className="h-full m-0 overflow-auto"><LearningControl /></TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
