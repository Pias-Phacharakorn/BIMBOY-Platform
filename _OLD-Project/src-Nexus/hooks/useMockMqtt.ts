import { useEffect } from "react";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

// Simulates an MQTT broker. In real use, swap with `mqtt.js` and call
// pushMqtt on each `message` event. The shape stays identical.
const TOPICS: { topic: string; unit: string; base: number; jitter: number; spike?: number }[] = [
  { topic: "plant/a/pipe-03/temp", unit: "°C", base: 38, jitter: 4, spike: 55 },
  { topic: "plant/a/pump-01/vibration", unit: "mm/s", base: 2.5, jitter: 1, spike: 7 },
  { topic: "plant/a/tank-02/level", unit: "%", base: 65, jitter: 8 },
  { topic: "plant/a/ambient/humidity", unit: "%", base: 55, jitter: 5 },
  { topic: "plant/a/ambient/temp", unit: "°C", base: 27, jitter: 2 },
];

let started = false;

export function useMockMqtt() {
  const pushMqtt = useDigitalTwinStore((s) => s.pushMqtt);
  const iotActive = useDigitalTwinStore((s) => s.iotActive);

  useEffect(() => {
    if (!iotActive || started) return;
    started = true;
    // Seed
    TOPICS.forEach((t) => pushMqtt(t.topic, t.base, t.unit));
    const id = setInterval(() => {
      TOPICS.forEach((t) => {
        const spike = t.spike && Math.random() < 0.08 ? t.spike : 0;
        const v = +(t.base + (Math.random() - 0.5) * t.jitter + spike).toFixed(2);
        pushMqtt(t.topic, v, t.unit);
      });
    }, 2000);
    return () => {
      clearInterval(id);
      started = false;
    };
  }, [iotActive, pushMqtt]);
}

export const KNOWN_TOPICS = TOPICS.map((t) => t.topic);