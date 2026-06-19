import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import {
  listMqttMappings,
  upsertMqttMapping,
  deleteMqttMapping,
} from "@/lib/twin.functions";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useDigitalTwinStore as _store } from "@/store/useDigitalTwinStore";
import { useCanEdit } from "./usePermissions";

/**
 * Hydrates the active IFC model's `mqttTopic` fields from the database and
 * persists any changes the user makes through `setElementMqtt`.
 */
export function useMqttMappingPersistence() {
  const { user } = useAuth();
  const fetchMappings = useServerFn(listMqttMappings);
  const upsertFn = useServerFn(upsertMqttMapping);
  const deleteFn = useServerFn(deleteMqttMapping);

  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const setElementMqtt = useDigitalTwinStore((s) => s.setElementMqtt);
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);
  const canEdit = useCanEdit("iot");

  const hydrated = useRef<string | null>(null); // model id we hydrated for
  const lastSnapshot = useRef<Record<string, string | undefined>>({});
  const skipNextDiff = useRef(false);

  // Load saved mappings whenever a model becomes available (per user).
  useEffect(() => {
    if (!user || !projectId || !model) return;
    const key = `${user.id}:${projectId}:${model.id}`;
    if (hydrated.current === key) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMappings({ data: { projectId } });
        if (cancelled) return;
        const byEl = new Map(rows.map((r) => [r.elementId, r.topic]));
        skipNextDiff.current = true;
        model.elements.forEach((el) => {
          const saved = byEl.get(el.id);
          if (saved && saved !== el.mqttTopic) setElementMqtt(el.id, saved);
        });
        hydrated.current = key;
        // refresh snapshot to current state
        lastSnapshot.current = Object.fromEntries(
          useDigitalTwinStore
            .getState()
            .activeIfcModel?.elements.map((e) => [e.id, e.mqttTopic]) ?? [],
        );
      } catch (err) {
        console.error("Failed to load MQTT mappings", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, projectId, model, fetchMappings, setElementMqtt]);

  // Persist user edits by diffing the model's mqttTopic fields against the
  // last hydrated snapshot whenever the store changes.
  useEffect(() => {
    if (!user || !projectId || !canEdit) return;
    const unsub = useDigitalTwinStore.subscribe((state) => {
      const m = state.activeIfcModel;
      if (!m || hydrated.current !== `${user.id}:${projectId}:${m.id}`) return;
      if (skipNextDiff.current) {
        skipNextDiff.current = false;
        return;
      }
      const prev = lastSnapshot.current;
      m.elements.forEach((el) => {
        const before = prev[el.id];
        const after = el.mqttTopic;
        if (before === after) return;
        prev[el.id] = after;
        if (after && after.length > 0) {
          upsertFn({ data: { projectId, elementId: el.id, topic: after } }).catch((e) => {
            console.error("Save mapping failed", e);
            toast.error("Couldn't save MQTT mapping");
          });
        } else {
          deleteFn({ data: { projectId, elementId: el.id } }).catch((e) => {
            console.error("Delete mapping failed", e);
          });
        }
      });
    });
    return () => unsub();
  }, [user, projectId, canEdit, upsertFn, deleteFn]);
}