import { RabbitMQBroker } from "../../lib";
import type {
  EventEnvelope,
  TopologyValidationResult,
} from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
};

type OrderEvent = EventEnvelope<OrderCreated>;

function printValidation(title: string, result: TopologyValidationResult) {
  console.log(`\n========== ${title} ==========\n`);
  console.log(JSON.stringify(result, null, 2));

  const blockingIssues = result.issues.filter(
    (issue) => issue.type !== "binding_not_validated"
  );

  if (blockingIssues.length === 0) {
    console.log("[validation] topology resources exist");
  } else {
    console.log("[validation] missing/invalid resources found");
  }
}

(async () => {
  const broker = new RabbitMQBroker("topology-validation.demo", {
    exchangeType: "topic",
    durable: true,
  });

  // This example intentionally uses assert mode first so it can create the
  // resources locally, then validate the resulting topology passively.
  const sub = await broker
    .queue("validation.orders.q", {
      amqp: {
        queue: {
          arguments: {
            "x-queue-type": "classic",
          },
        },
      },
    })
    .exchange<{ "orders.created": OrderEvent }>("validation.orders.ex", {
      exchangeType: "topic",
      routingKey: "orders.*",
      deadLetter: {
        exchange: "validation.orders.dlx",
        queue: "validation.orders.dlq",
        routingKey: "orders.dead",
        autoDeclare: true,
      },
    });

  console.log("\n========== planned topology ==========\n");
  console.log(JSON.stringify(sub.planTopology(), null, 2));

  const subResult = await sub.validateTopology();
  printValidation("sub.validateTopology()", subResult);

  const brokerResult = await broker.validateTopology();
  printValidation("broker.validateTopology()", brokerResult);

  await broker.close();
})();
