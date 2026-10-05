import { useEffect, useState } from 'react';

import { isReduceMotionEnabled, subscribeReduceMotion } from '@/theme';

/**
 * Tracks the OS "reduce motion" accessibility setting.
 *
 * glassmorphism-design requires motion to respect this preference, and
 * ui-ux-pro-max rates ignoring it as High severity.
 *
 * Starts as `false` so motion is enabled by default and does not visibly
 * disable itself for users who never set the preference, then syncs to the
 * real value on mount.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    const unsubscribe = subscribeReduceMotion((enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return reduceMotion;
}