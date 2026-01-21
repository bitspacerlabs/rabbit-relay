import type { EventEnvelope, Plugin } from "../../lib";

type Cnt = { produced: number; processed: number };
const byEvent: Record<string, Cnt> = Object.create(null);

function bump(map: Record<string, Cnt>, key: string, field: keyof Cnt) {
  map[key] = map[key] || { produced: 0, processed: 0 };
  map[key][field] += 1;
}

let started = false;

export const metricsPlugin = (): Plugin => {
  if (!started) {
    started = true;
    setInterval(() => {
      const rows = Object.entries(byEvent)
        .map(([name, c]) => `${name.padEnd(20)} | produced=${String(c.produced).padStart(5)} | processed=${String(c.processed).padStart(5)}`)
        .join("\n");
      if (rows) {
        console.log("\n[plugin:metrics] snapshot");
        console.log("event".padEnd(20) + " | produced | processed");
        console.log("-".repeat(48));
        console.log(rows + "\n");
      }
    }, 5000).unref?.();
  }

  return {
    async beforeProduce(evt: EventEnvelope) { bump(byEvent, evt.name, "produced"); },
    async afterProduce(_evt: EventEnvelope, _result: unknown) {},
    async beforeProcess(_t: number | string, _evt: EventEnvelope) {},
    async afterProcess(_t: number | string, evt: EventEnvelope, _result: unknown) {
      bump(byEvent, evt.name, "processed");
    },
  };
};
