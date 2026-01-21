import type { EventEnvelope, Plugin } from "../../lib";

const short = (x: string) => (x.length > 48 ? x.slice(0, 45) + "..." : x);

export const loggerPlugin = (serviceName: string): Plugin => ({
  async beforeProduce(evt: EventEnvelope) {
    console.log(`[plugin:logger] -> produce  name=${evt.name} id=${evt.id} svc=${serviceName}`);
  },
  async afterProduce(evt: EventEnvelope, _result: unknown) {
    console.log(`[plugin:logger] <- produced name=${evt.name} id=${evt.id}`);
  },
  async beforeProcess(_tag: number | string, evt: EventEnvelope) {
    console.log(
      `[plugin:logger] -> process  name=${evt.name} corr=${evt.meta?.corrId ?? "-"} data=${short(JSON.stringify(evt.data ?? {}))}`
    );
  },
  async afterProcess(_tag: number | string, evt: EventEnvelope, _result: unknown) {
    console.log(`[plugin:logger] <- processed name=${evt.name}`);
  },
});
