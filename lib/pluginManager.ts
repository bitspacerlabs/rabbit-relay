import { EventEnvelope } from "./eventFactories";

export interface Plugin {
  beforeProduce?(event: EventEnvelope): Promise<void>;
  afterProduce?(event: EventEnvelope, result: unknown): Promise<void>;
  beforeProcess?(id: string | number, event: EventEnvelope): Promise<void>;
  afterProcess?(id: string | number, event: EventEnvelope, result: unknown): Promise<void>;
}

export class PluginManager {
  private plugins: Plugin[] = [];

  register(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  async executeHook<K extends keyof Plugin>(
    hookName: K,
    ...args: Parameters<NonNullable<Plugin[K]>>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const fn = plugin[hookName];
      if (typeof fn === "function") {
        try {
          await (fn as (...a: Parameters<NonNullable<Plugin[K]>>) => Promise<void>)
          .call(plugin, ...args);
        } catch (err) {
          console.error(`Error executing hook ${String(hookName)}:`, err);
        }
      }
    }
  }
}

export const pluginManager = new PluginManager();
