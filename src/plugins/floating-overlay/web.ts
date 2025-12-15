import { WebPlugin } from '@capacitor/core';
import type { FloatingOverlayPlugin } from './definitions';

export class FloatingOverlayWeb extends WebPlugin implements FloatingOverlayPlugin {
  async checkPermission(): Promise<{ granted: boolean }> {
    // Web doesn't need overlay permission
    console.log('FloatingOverlay: Web platform - permission always granted');
    return { granted: true };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    // Web doesn't need overlay permission
    console.log('FloatingOverlay: Web platform - no permission needed');
    return { granted: true };
  }

  async showOverlay(): Promise<void> {
    // On web, the overlay is managed by React components
    console.log('FloatingOverlay: Web platform - use React component');
  }

  async hideOverlay(): Promise<void> {
    console.log('FloatingOverlay: Web platform - use React component');
  }

  async isOverlayVisible(): Promise<{ visible: boolean }> {
    return { visible: false };
  }

  async updatePosition(options: { x: number; y: number }): Promise<void> {
    console.log('FloatingOverlay: updatePosition', options);
  }
}
