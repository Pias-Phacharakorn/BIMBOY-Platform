/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Web Push API type declarations
declare global {
  interface PushSubscriptionOptionsInit {
    userVisibleOnly?: boolean;
    applicationServerKey?: BufferSource | string | null;
  }

  interface PushSubscriptionJSON {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: Record<string, string>;
  }

  interface PushSubscription {
    readonly endpoint: string;
    readonly expirationTime: number | null;
    readonly options: PushSubscriptionOptionsInit;
    getKey(name: string): ArrayBuffer | null;
    toJSON(): PushSubscriptionJSON;
    unsubscribe(): Promise<boolean>;
  }

  interface PushManager {
    getSubscription(): Promise<PushSubscription | null>;
    permissionState(options?: PushSubscriptionOptionsInit): Promise<PermissionState>;
    subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
  }

  interface ServiceWorkerRegistration {
    readonly pushManager: PushManager;
  }
}

export {};
