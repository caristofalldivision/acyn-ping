import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, Database, Brain, CheckCircle, Sliders } from "lucide-react";
import { KnowledgeBase } from "./KnowledgeBase";
import { MemoryViewer } from "./MemoryViewer";
import { ReviewLearning } from "./ReviewLearning";
import { LearningControl } from "./LearningControl";

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
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl bg-background border-border overflow-hidden flex flex-col">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-semibold">Settings & Training</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="training" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-xl">
            <TabsTrigger 
              value="training" 
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Database className="w-4 h-4 mr-1 hidden sm:block" />
              Training
            </TabsTrigger>
            <TabsTrigger 
              value="memory" 
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Brain className="w-4 h-4 mr-1 hidden sm:block" />
              Memory
            </TabsTrigger>
            <TabsTrigger 
              value="review" 
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CheckCircle className="w-4 h-4 mr-1 hidden sm:block" />
              Review
            </TabsTrigger>
            <TabsTrigger 
              value="learning" 
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Sliders className="w-4 h-4 mr-1 hidden sm:block" />
              Learning
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-hidden mt-4">
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
