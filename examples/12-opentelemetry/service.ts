import {
  RabbitMQBroker,
  attachOpenTelemetry,
  event,
} from "../../lib";
import type { EventEnvelope } from "../../lib";

type DemoJob = {
  jobId: string;
  shouldFail?: boolean;
};

type DemoEvent = EventEnvelope<DemoJob>;

type FakeSpan = {
  name: string;
  attributes: Record<string, unknown>;
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  recordException(error: unknown): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
};

function createFakeTracer() {
  return {
    startSpan(name: string): FakeSpan {
      const span: FakeSpan = {
        name,
        attributes: {},

        setAttribute(key, value) {
          this.attributes[key] = value;
        },

        setAttributes(attributes) {
          this.attributes = {
            ...this.attributes,
            ...attributes,
          };
        },

        addEvent(eventName, attributes) {
          console.log("[otel] event", {
            span: this.name,
            event: eventName,
            attributes,
          });
        },

        recordException(error) {
          console.log("[otel] exception", {
            span: this.name,
            error: error instanceof Error ? error.message : String(error),
          });
        },

        setStatus(status) {
          console.log("[otel] status", {
            span: this.name,
            status,
          });
        },

        end() {
          console.log("[otel] span ended", {
            name: this.name,
            attributes: this.attributes,
          });
        },
      };

      console.log("[otel] span started", name);

      return span;
    },
  };
}

(async () => {
  const EXCHANGE = "otel.demo.ex";
  const QUEUE = "otel.demo.q";

  const broker = new RabbitMQBroker("otel.demo.service");

  const otel = attachOpenTelemetry(broker, {
    tracer: createFakeTracer(),
    serviceName: "otel-demo-service",
  });

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "otel.job": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "otel.job",
      deadLetter: {
        exchange: "otel.demo.dlx",
        queue: "otel.demo.dlq",
        routingKey: "otel.job.dead",
        autoDeclare: true,
      },
    });

  sub.handle("otel.job", async (_id, ev) => {
    console.log("[handler] received", ev.data);

    if (ev.data.shouldFail) {
      throw new Error(`job failed: ${ev.data.jobId}`);
    }

    console.log("[handler] success", ev.data.jobId);
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "retry",
    retry: {
      attempts: 1,
      delayMs: 1000,
      then: "dead-letter",
    },
  });

  const makeJob = event("otel.job", "v1").of<DemoJob>();

  await sub.produce(
    makeJob({
      jobId: "job-ok",
    }),
    makeJob({
      jobId: "job-fail",
      shouldFail: true,
    })
  );

  console.log("[service] OpenTelemetry adapter demo running");
  console.log("[service] press Ctrl+C to stop");

  process.on("SIGINT", async () => {
    console.log("\n[service] received SIGINT");

    otel.detach();
    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[service] received SIGTERM");

    otel.detach();
    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  });
})();
