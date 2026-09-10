/**
 * Everything the IOT tab needs, composed into one hook so the view calls it **once**.
 *
 * This matters structurally: the left and right panels are siblings with the viewport between them,
 * so they cannot share a provider without wrapping the layout. Calling the underlying hooks in each
 * panel would give the tab two selections, two live ticks and two device lists — so the state is
 * owned here and handed down as props.
 */

import { useCallback, useState } from "react";
import { useIotDevices, type UseIotDevices } from "./useIotDevices";
import { useIotChips } from "./useIotChips";
import { useIotBinding, type UseIotBinding } from "./useIotBinding";
import { useDeleteIotDevice, useUpdateIotDevice } from "./useIotDeviceQueries";
import { conflictOf } from "./iotDevicesService";
import { forgetDevice } from "./mockIotProvider";
import type { Metric } from "./iotTypes";

export interface UseIotTab {
  devices: UseIotDevices;
  binding: UseIotBinding;
  canManage: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  editError: string | null;
  saveDevice: (input: { label: string; metrics: Metric[]; deviceCode: string }) => Promise<boolean>;
  deleteDevice: () => Promise<void>;
  onBound: () => void;
}

export function useIotTab(
  isActive: boolean,
  projectId: string | undefined,
  userId: string | undefined,
  canManage: boolean,
): UseIotTab {
  const devices = useIotDevices(isActive, projectId);
  const binding = useIotBinding(
    isActive && canManage,
    projectId,
    userId,
    devices.rows.map((row) => row.device),
  );

  const updateDevice = useUpdateIotDevice(projectId);
  const deleteDevice = useDeleteIotDevice(projectId);
  const [editError, setEditError] = useState<string | null>(null);

  // Floating chips in the viewport. Clicking one selects the device, which is the same entry point
  // the list row uses — so the panel cannot end up describing something other than the highlighted
  // chip. → `docs/feature/iot.md` § Viewport chips.
  useIotChips(
    isActive,
    devices.rows,
    devices.resolved,
    devices.selectedDeviceId,
    devices.select,
  );

  const saveDevice = useCallback(
    async ({ label, metrics, deviceCode }: { label: string; metrics: Metric[]; deviceCode: string }) => {
      const selected = devices.selectedRow;
      if (!selected) return false;
      setEditError(null);
      try {
        await updateDevice.mutateAsync({
          id: selected.device.id,
          label,
          metrics,
          deviceCode: deviceCode.trim() || null,
        });
        return true;
      } catch (err) {
        setEditError(
          conflictOf(err) === "device_code"
            ? "That device code is already used by another device in this project."
            : "Could not save the device. Check your permissions and try again.",
        );
        return false;
      }
    },
    [devices.selectedRow, updateDevice],
  );

  const removeDevice = useCallback(async () => {
    const selected = devices.selectedRow;
    if (!selected) return;
    try {
      await deleteDevice.mutateAsync(selected.device.id);
      // Drop the provider's registration too, so a re-bound element does not inherit the deleted
      // device's metric set before the new row's registration lands.
      forgetDevice(selected.device.id);
      // The right panel cannot keep describing something that no longer exists.
      devices.clearSelection();
    } catch (err) {
      console.warn("[iot] failed to delete device", err);
      setEditError("Could not delete the device. Check your permissions and try again.");
    }
  }, [devices, deleteDevice]);

  const onBound = useCallback(() => setEditError(null), []);

  return {
    devices,
    binding,
    canManage,
    isSaving: updateDevice.isPending,
    isDeleting: deleteDevice.isPending,
    editError,
    saveDevice,
    deleteDevice: removeDevice,
    onBound,
  };
}
