import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** True while the phone has a connection (React Query's view of it, fed by NetInfo). */
export function useOnlineManager(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
}
