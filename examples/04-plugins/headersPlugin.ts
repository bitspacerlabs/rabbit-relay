import type { EventEnvelope, EventMeta, Plugin } from "../../lib";

function rid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export const headersPlugin = (serviceName: string): Plugin => ({
  async beforeProduce(evt: EventEnvelope) {
    const meta: EventMeta = evt.meta || (evt.meta = {});
    const headers = (meta.headers = { ...(meta.headers || {}) });
    if (!headers["x-service"]) headers["x-service"] = serviceName;
    if (!headers["x-request-id"]) headers["x-request-id"] = rid();
  },
  async afterProduce(_evt: EventEnvelope, _result: unknown) {},
  async beforeProcess(_tag: number | string, _evt: EventEnvelope) {},
  async afterProcess(_tag: number | string, _evt: EventEnvelope, _result: unknown) {},
});
