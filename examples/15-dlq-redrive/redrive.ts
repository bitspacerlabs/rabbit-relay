import { RabbitMQBroker } from "../../lib";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

(async () => {
  const dryRun = hasFlag("--dry-run");
  const limit = Number(readArg("--limit") ?? 10);

  const broker = new RabbitMQBroker("dlq-redrive.operator");

  const result = await broker.redriveDlq({
    fromQueue: "redrive.jobs.dlq",
    toExchange: "redrive.jobs.ex",
    routingKey: "redrive.job",
    limit,
    dryRun,
  });

  console.log("[redrive] result:", JSON.stringify(result, null, 2));

  await broker.close();
})();
