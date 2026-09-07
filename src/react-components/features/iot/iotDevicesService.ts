/**
 * Data access for `iot_devices`. Shaped like `shopDrawingsService.ts`: plain async functions over
 * `supabase.from(...)`, each logging and rethrowing so the calling Query hook surfaces the failure.
 *
 * Row-level security does the authorisation, not this module. Reads are member-level, writes are
 * project-admin — see the migration. The UI hides the write controls from non-admins as a courtesy,
 * but the database is what actually enforces it.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { IotDevice, IotDeviceRow, Metric } from "./iotTypes";

type IotDeviceUpdate = Database["public"]["Tables"]["iot_devices"]["Update"];

const TABLE = "iot_devices";

function toDevice(row: IotDeviceRow): IotDevice {
  return {
    id: row.id,
    projectId: row.project_id,
    ifcGuid: row.ifc_guid,
    modelId: row.model_id,
    deviceCode: row.device_code,
    label: row.label,
    elementCategory: row.element_category,
    metrics: row.metrics ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateIotDeviceInput {
  projectId: string;
  ifcGuid: string;
  modelId: string | null;
  deviceCode: string | null;
  label: string;
  elementCategory: string | null;
  metrics: Metric[];
  createdBy: string | null;
}

export interface UpdateIotDeviceInput {
  id: string;
  label?: string;
  deviceCode?: string | null;
  metrics?: Metric[];
  /** Written when resolution found the element in a model other than the stored hint. */
  modelId?: string | null;
}

/**
 * Postgres unique-violation. Surfaced as a distinct type so the UI can say *which* rule was broken
 * — "that element is already a device" and "that device code is taken" are different problems with
 * different fixes, and a raw constraint name helps nobody.
 */
export type IotConflict = "element" | "device_code" | null;

export function conflictOf(error: unknown): IotConflict {
  const code = (error as { code?: string } | null)?.code;
  if (code !== "23505") return null;
  const message = String((error as { message?: string })?.message ?? "");
  if (message.includes("iot_devices_project_code_key")) return "device_code";
  if (message.includes("iot_devices_project_guid_key")) return "element";
  return null;
}

export const iotDevicesService = {
  async listByProject(projectId: string): Promise<IotDevice[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("label", { ascending: true });

    if (error) {
      console.error(`[iot] failed to list devices for project ${projectId}:`, error);
      throw error;
    }
    return ((data ?? []) as IotDeviceRow[]).map(toDevice);
  },

  async create(input: CreateIotDeviceInput): Promise<IotDevice> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        project_id: input.projectId,
        ifc_guid: input.ifcGuid,
        model_id: input.modelId,
        // An empty string is not a missing code — normalise so the unique constraint sees NULLs,
        // which Postgres permits many of, rather than one blank string blocking every other device.
        device_code: input.deviceCode?.trim() ? input.deviceCode.trim() : null,
        label: input.label.trim(),
        element_category: input.elementCategory,
        metrics: input.metrics,
        created_by: input.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error("[iot] failed to create device:", error);
      throw error;
    }
    return toDevice(data as IotDeviceRow);
  },

  async update(input: UpdateIotDeviceInput): Promise<IotDevice> {
    // Typed against the generated Update shape rather than a loose record, so a mistyped
    // column name is a compile error instead of a silent no-op at runtime.
    const patch: IotDeviceUpdate = {};
    if (input.label !== undefined) patch.label = input.label.trim();
    if (input.metrics !== undefined) patch.metrics = input.metrics;
    if (input.modelId !== undefined) patch.model_id = input.modelId;
    if (input.deviceCode !== undefined) {
      patch.device_code = input.deviceCode?.trim() ? input.deviceCode.trim() : null;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error(`[iot] failed to update device ${input.id}:`, error);
      throw error;
    }
    return toDevice(data as IotDeviceRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      console.error(`[iot] failed to delete device ${id}:`, error);
      throw error;
    }
  },
};
