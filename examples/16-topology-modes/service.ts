import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope, TopologyPlan } from "../../lib";

type DemoMessage = {
  id: string;
  mode: "assert" | "passive" | "plan-only";
};

type DemoEvent = EventEnvelope<DemoMessage>;

function printPlan(title: string, plan: TopologyPlan) {
  console.log(`\n========== ${title} ==========\n`);
  console.log(JSON.stringify(plan, null, 2));
}

(async () => {
  const broker = new RabbitMQBroker("topology-modes.demo", {
    exchangeType: "topic",
    durable: true,
  });

  const assertSub = await broker
    .queue("modes.assert.q")
    .exchange<{ "modes.assert": DemoEvent }>("modes.assert.ex", {
      exchangeType: "topic",
      routingKey: "modes.assert",
      topologyMode: "assert",
      deadLetter: {
        exchange: "modes.assert.dlx",
        queue: "modes.assert.dlq",
        routingKey: "modes.assert.dead",
        autoDeclare: true,
      },
    });

  console.log("[assert] topology created");
  printPlan("[assert] plan", assertSub.planTopology());

  const passiveSub = await broker
    .queue("modes.assert.q")
    .exchange<{ "modes.assert": DemoEvent }>("modes.assert.ex", {
      exchangeType: "topic",
      routingKey: "modes.assert",
      topologyMode: "passive",
      deadLetter: {
        exchange: "modes.assert.dlx",
        queue: "modes.assert.dlq",
        routingKey: "modes.assert.dead",
        autoDeclare: true,
      },
    });

  console.log("[passive] topology exists");
  printPlan("[passive] plan", passiveSub.planTopology());

  const planOnlySub = await broker
    .queue("modes.plan-only.fake.q")
    .exchange<{ "modes.plan-only": DemoEvent }>("modes.plan-only.fake.ex", {
      exchangeType: "topic",
      routingKey: "modes.plan-only",
      topologyMode: "plan-only",
      deadLetter: {
        exchange: "modes.plan-only.fake.dlx",
        queue: "modes.plan-only.fake.dlq",
        routingKey: "modes.plan-only.dead",
        autoDeclare: true,
      },
    });

  console.log("[plan-only] plan generated without RabbitMQ assertion");
  printPlan("[plan-only] plan", planOnlySub.planTopology());

  printPlan("[broker] merged full plan", broker.planTopology());

  await broker.close();
})();
