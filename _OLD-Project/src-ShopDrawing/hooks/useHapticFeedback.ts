import { useCallback } from 'react';

/**
 * Cross-platform haptic feedback hook
 * Uses Vibration API for Android and AudioContext for iOS
 */
export function useHapticFeedback() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const triggerVibration = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const triggerIOSHaptic = useCallback((type: 'success' | 'error') => {
    // iOS doesn't support Vibration API, but we can use AudioContext
    // to trigger a subtle haptic-like feedback through the speaker/motor
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return false;

      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Use low frequency for "haptic" feel
      oscillator.frequency.value = type === 'success' ? 200 : 150;
      oscillator.type = 'sine';

      // Very quick burst - almost inaudible but provides feedback
      gainNode.gain.value = 0.01; // Very low volume

      const now = ctx.currentTime;
      oscillator.start(now);
      
      if (type === 'success') {
        // Single short pulse
        oscillator.stop(now + 0.05);
      } else {
        // Two pulses for error
        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.setValueAtTime(0, now + 0.05);
        gainNode.gain.setValueAtTime(0.01, now + 0.1);
        oscillator.stop(now + 0.15);
      }

      // Clean up
      setTimeout(() => ctx.close(), 200);
      return true;
    } catch (e) {
      console.log('[Haptic] iOS fallback failed:', e);
      return false;
    }
  }, []);

  const triggerSuccess = useCallback(() => {
    // Try vibration API first (Android, some desktop browsers)
    if (triggerVibration(100)) return;
    
    // iOS fallback
    if (isIOS) {
      triggerIOSHaptic('success');
    }
  }, [isIOS, triggerVibration, triggerIOSHaptic]);

  const triggerError = useCallback(() => {
    // Try vibration API first (Android)
    if (triggerVibration([100, 50, 100])) return;
    
    // iOS fallback
    if (isIOS) {
      triggerIOSHaptic('error');
    }
  }, [isIOS, triggerVibration, triggerIOSHaptic]);

  const trigger = useCallback((success: boolean) => {
    if (success) {
      triggerSuccess();
    } else {
      triggerError();
    }
  }, [triggerSuccess, triggerError]);

  return {
    trigger,
    triggerSuccess,
    triggerError,
    isIOS,
  };
}
