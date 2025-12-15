export interface FloatingOverlayPlugin {
  /**
   * Check if overlay permission is granted
   */
  checkPermission(): Promise<{ granted: boolean }>;

  /**
   * Request overlay permission (opens system settings on Android)
   */
  requestPermission(): Promise<{ granted: boolean }>;

  /**
   * Show the floating overlay window
   */
  showOverlay(): Promise<void>;

  /**
   * Hide the floating overlay window
   */
  hideOverlay(): Promise<void>;

  /**
   * Check if overlay is currently visible
   */
  isOverlayVisible(): Promise<{ visible: boolean }>;

  /**
   * Update overlay position
   */
  updatePosition(options: { x: number; y: number }): Promise<void>;

  /**
   * Add listener for overlay events
   */
  addListener(
    eventName: 'overlayClick' | 'overlayDrag' | 'overlayDismiss',
    listenerFunc: (data: any) => void
  ): Promise<{ remove: () => void }>;
}
