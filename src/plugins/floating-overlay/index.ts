import { registerPlugin } from '@capacitor/core';
import type { FloatingOverlayPlugin } from './definitions';

const FloatingOverlay = registerPlugin<FloatingOverlayPlugin>('FloatingOverlay', {
  web: () => import('./web').then(m => new m.FloatingOverlayWeb()),
});

export * from './definitions';
export { FloatingOverlay };
