import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";

export const PWAInstallPrompt = () => {
  const { canInstall, promptInstall, isInstalled, isStandalone } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Check if user has dismissed before
    const wasDismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Show prompt after a delay on mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile && !isInstalled && !isStandalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstalled, isStandalone]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  const handleInstall = async () => {
    if (canInstall) {
      const installed = await promptInstall();
      if (installed) {
        setShowPrompt(false);
      }
    }
  };

  if (!showPrompt || dismissed || isInstalled || isStandalone) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[60] p-4 animate-fade-in"
      style={{
        background: "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.95) 100%)",
      }}
    >
      <div 
        className="max-w-md mx-auto rounded-2xl p-4 border border-border/50"
        style={{
          background: "hsl(var(--card) / 0.9)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 -4px 30px hsl(var(--background) / 0.5)",
        }}
      >
        <div className="flex items-start gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/20"
          >
            <Smartphone className="w-6 h-6 text-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Install Ping</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isIOS 
                ? "Tap the share button and select 'Add to Home Screen'"
                : "Add to your home screen for quick access"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!isIOS && canInstall && (
          <Button
            className="w-full mt-3 gap-2 rounded-xl"
            onClick={handleInstall}
          >
            <Download className="w-4 h-4" />
            Install Now
          </Button>
        )}

        {isIOS && (
          <div className="mt-3 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <span>1. Tap</span>
              <span className="px-2 py-1 bg-background rounded">Share ↑</span>
            </p>
            <p className="mt-2 flex items-center gap-2">
              <span>2. Select</span>
              <span className="px-2 py-1 bg-background rounded">Add to Home Screen</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
