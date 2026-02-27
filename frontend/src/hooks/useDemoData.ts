/* ===================================================================
   Demo Data Hook
   Returns whether the current user is on a demo account.
   Pages use this to conditionally show demo/sample data or empty states.
   =================================================================== */

import { useAuthStore } from '@/lib/stores';

/**
 * Returns true if the current authenticated user is a demo account.
 * Demo accounts see sample/mock data; regular accounts see live data only.
 */
export function useIsDemoAccount(): boolean {
  return useAuthStore((s) => s.isDemoAccount);
}

/**
 * Generic helper: returns demoData for demo accounts, emptyValue otherwise.
 * @example const tasks = useDemoData(SAMPLE_TASKS, []);
 */
export function useDemoData<T>(demoData: T, emptyValue: T): T {
  const isDemo = useIsDemoAccount();
  return isDemo ? demoData : emptyValue;
}
