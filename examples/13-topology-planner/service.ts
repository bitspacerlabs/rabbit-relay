import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope, TopologyPlan } from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
};

type OrderEvent = EventEnvelope<OrderCreated>;

function printPlan(title: string, plan: TopologyPlan) {
  console.log(`\n========== ${title} ==========\n`);
  console.log(JSON.stringify(plan, null, 2));
}

(async () => {
  // plan-only means this example can build the topology plan without
  // declaring exchanges, queues, or bindings in RabbitMQ.
  const broker = new RabbitMQBroker("topology-planner.demo", {
    exchangeType: "topic",
    durable: true,
    topologyMode: "plan-only",
  });

  const orders = await broker
    .queue("planner.orders.q", {
      amqp: {
        queue: {
          arguments: {
            "x-queue-type": "classic",
          },
        },
      },
    })
    .exchange<{ "orders.created": OrderEvent }>("planner.orders.ex", {
      exchangeType: "topic",
      routingKey: "orders.*",
      deadLetter: {
        exchange: "planner.orders.dlx",
        queue: "planner.orders.dlq",
        routingKey: "orders.dead",
        autoDeclare: true,
      },
    });

  const audit = await broker
    .queue("planner.audit.q")
    .exchange<{ "orders.created": OrderEvent }>("planner.audit.ex", {
      exchangeType: "fanout",
      routingKey: "",
    });

  printPlan("orders sub plan", orders.planTopology());
  printPlan("audit sub plan", audit.planTopology());
  printPlan("broker full plan", broker.planTopology());

  await broker.close();
})();
