import { useCallback, useEffect, useState, type RefObject } from "react";
import { ArSession, type ArSessionStatus } from "@/bim-components";
import { useBimStore } from "@/react-components/store/bimStore";

export function useArSession(overlayRef: RefObject<HTMLElement>) {
  const components = useBimStore((state) => state.components);
  const world = useBimStore((state) => state.world);
  const [status, setStatus] = useState<ArSessionStatus>("idle");
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ArSession.isSupported().then((supported) => {
      if (!cancelled) setIsSupported(supported);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!components || !world) return;

    const arSession = components.get(ArSession);
    arSession.world = world;
    setStatus(arSession.status);

    const onStatusChanged = (nextStatus: ArSessionStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== "error") setError(null);
    };
    const onError = (message: string) => {
      setError(message);
    };
    arSession.onStatusChanged.add(onStatusChanged);
    arSession.onError.add(onError);

    return () => {
      arSession.onStatusChanged.remove(onStatusChanged);
      arSession.onError.remove(onError);
    };
  }, [components, world]);

  const start = useCallback(() => {
    if (!components || !overlayRef.current) return;
    void components.get(ArSession).start(overlayRef.current);
  }, [components, overlayRef]);

  const exit = useCallback(() => {
    if (!components) return;
    void components.get(ArSession).exit();
  }, [components]);

  return { status, isSupported, error, start, exit };
}
