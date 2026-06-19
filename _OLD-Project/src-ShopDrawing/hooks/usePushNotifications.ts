import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
  isIOSPWA: boolean;
  vapidKeyConfigured: boolean;
}

// Convert base64 URL-safe string to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Cache the VAPID key after fetching
let cachedVapidKey: string | null = null;

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
    isIOSPWA: false,
    vapidKeyConfigured: false,
  });

  // Check if running as iOS PWA
  const checkIOSPWA = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return isIOS && isStandalone;
  }, []);

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    
    console.log('[Push] Support check:', { hasServiceWorker, hasPushManager, hasNotification });
    
    return hasServiceWorker && hasPushManager && hasNotification;
  }, []);

  // Fetch VAPID public key from edge function
  const fetchVapidKey = useCallback(async (): Promise<string | null> => {
    if (cachedVapidKey) return cachedVapidKey;

    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-key');
      
      if (error || !data?.configured || !data?.publicKey) {
        console.error('[Push] Failed to get VAPID key:', error || 'Not configured');
        return null;
      }

      cachedVapidKey = data.publicKey;
      return cachedVapidKey;
    } catch (error) {
      console.error('[Push] Error fetching VAPID key:', error);
      return null;
    }
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!checkSupport()) {
      setState(prev => ({ ...prev, isLoading: false, isSupported: false }));
      return;
    }

    try {
      // First check if VAPID key is configured
      const vapidKey = await fetchVapidKey();
      const vapidKeyConfigured = !!vapidKey;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
     // If there's a browser subscription, verify it's also registered on the server
     // This uses the secure edge function that doesn't expose credentials
     let serverSubscribed = false;
     if (subscription) {
       try {
         const { data, error } = await supabase.functions.invoke('check-push-subscription');
         if (!error && data?.subscribed) {
           serverSubscribed = true;
         }
       } catch (e) {
         console.log('[Push] Could not verify server subscription:', e);
       }
     }
 
      setState(prev => ({
        ...prev,
        isSupported: true,
       isSubscribed: !!subscription && serverSubscribed,
        permission: Notification.permission,
        isIOSPWA: checkIOSPWA(),
        isLoading: false,
        vapidKeyConfigured,
      }));
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [checkSupport, checkIOSPWA, fetchVapidKey]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    const vapidKey = await fetchVapidKey();
    
    if (!vapidKey) {
      console.error('[Push] VAPID public key not configured');
      toast.error('Push notifications are not configured');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        toast.error('Please allow notifications to receive drawing updates');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      console.log('[Push] Created subscription:', subscription);

      // Send subscription to backend
      const { error } = await supabase.functions.invoke('subscribe-push', {
        body: {
          subscription: subscription.toJSON(),
          action: 'subscribe',
        },
      });

      if (error) {
        console.error('[Push] Backend subscription error:', error);
        toast.error('Failed to save notification preferences');
        await subscription.unsubscribe();
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      toast.success('You will now receive drawing update notifications');
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      return true;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      toast.error('Failed to enable notifications');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [fetchVapidKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        // Notify backend
        await supabase.functions.invoke('subscribe-push', {
          body: {
            subscription: subscription.toJSON(),
            action: 'unsubscribe',
          },
        });

        // Unsubscribe from browser
        await subscription.unsubscribe();
      }

      toast.success('Notifications disabled');
      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      toast.error('Failed to disable notifications');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  // Toggle subscription
  const toggleSubscription = useCallback(async (): Promise<boolean> => {
    if (state.isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [state.isSubscribed, subscribe, unsubscribe]);

  // Initial check
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggleSubscription,
    checkSubscription,
  };
}
