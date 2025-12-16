import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Database, Brain, CheckCircle, Sliders, CalendarDays, MessageSquare, Layers } from "lucide-react";
import { KnowledgeBase } from "./KnowledgeBase";
import { MemoryViewer } from "./MemoryViewer";
import { ReviewLearning } from "./ReviewLearning";
import { LearningControl } from "./LearningControl";
import { CalendarView } from "./CalendarView";
import { MessageHistory } from "./MessageHistory";
import { Capacitor } from "@capacitor/core";

interface SettingsPanelProps {
  onKnowledgeUpdate: () => void;
}

const OVERLAY_ENABLED_KEY = "topher-overlay-enabled";

export const getOverlayEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem(OVERLAY_ENABLED_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

export const setOverlayEnabled = (enabled: boolean) => {
  localStorage.setItem(OVERLAY_ENABLED_KEY, JSON.stringify(enabled));
  window.dispatchEvent(new CustomEvent("overlay-setting-changed", { detail: enabled }));
};

export const SettingsPanel = ({ onKnowledgeUpdate }: SettingsPanelProps) => {
  const [overlayEnabled, setOverlayEnabledState] = useState(getOverlayEnabled());
  const isNative = Capacitor.isNativePlatform();

  const handleOverlayToggle = (enabled: boolean) => {
    setOverlayEnabledState(enabled);
    setOverlayEnabled(enabled);
  };

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
        
        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-7 bg-secondary/50 p-1 rounded-xl">
            <TabsTrigger 
              value="general" 
              className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
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
            <TabsContent value="general" className="h-full m-0 overflow-auto">
              <div className="space-y-6 p-1">
                <div>
                  <h3 className="text-lg font-medium mb-4">General Settings</h3>
                  
                  {/* Floating Overlay Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                    <div className="space-y-1">
                      <Label htmlFor="overlay-toggle" className="text-base font-medium">
                        Floating Assistant
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isNative 
                          ? "Show floating orb when app is in background"
                          : "Show floating orb on mobile for quick access"
                        }
                      </p>
                    </div>
                    <Switch
                      id="overlay-toggle"
                      checked={overlayEnabled}
                      onCheckedChange={handleOverlayToggle}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
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