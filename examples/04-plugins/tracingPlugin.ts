import type { EventEnvelope, EventMeta, Plugin } from "../../lib";

function uuidish() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export const tracingPlugin = (): Plugin => ({
  async beforeProduce(evt: EventEnvelope) {
    const meta: EventMeta = evt.meta || (evt.meta = {});
    if (!meta.corrId) meta.corrId = uuidish();
  },
  async afterProduce(_evt: EventEnvelope, _result: unknown) {},
  async beforeProcess(_tag: number | string, evt: EventEnvelope) {
    const meta: EventMeta = evt.meta || (evt.meta = {});
    if (!meta.corrId) meta.corrId = uuidish();
  },
  async afterProcess(_tag: number | string, _evt: EventEnvelope, _result: unknown) {},
});
