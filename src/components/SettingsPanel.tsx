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
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-secondary">
          <Settings className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl md:max-w-3xl bg-background border-border overflow-hidden flex flex-col">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-semibold">Settings & Tools</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-6 bg-secondary/50 p-1 rounded-xl">
            <TabsTrigger 
              value="calendar" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CalendarDays className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="messages" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageSquare className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger 
              value="training" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Database className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Training</span>
            </TabsTrigger>
            <TabsTrigger 
              value="memory" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Brain className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Memory</span>
            </TabsTrigger>
            <TabsTrigger 
              value="review" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CheckCircle className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Review</span>
            </TabsTrigger>
            <TabsTrigger 
              value="learning" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Sliders className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Learning</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="calendar" className="h-full m-0 overflow-auto">
              <CalendarView />
            </TabsContent>
            <TabsContent value="messages" className="h-full m-0 overflow-auto">
              <MessageHistory />
            </TabsContent>
            <TabsContent value="training" className="h-full m-0 overflow-auto">
              <KnowledgeBase onKnowledgeUpdate={onKnowledgeUpdate} />
            </TabsContent>
            <TabsContent value="memory" className="h-full m-0 overflow-auto">
              <MemoryViewer />
            </TabsContent>
            <TabsContent value="review" className="h-full m-0 overflow-auto">
              <ReviewLearning />
            </TabsContent>
            <TabsContent value="learning" className="h-full m-0 overflow-auto">
              <LearningControl />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
