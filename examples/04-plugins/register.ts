// Central place to register all plugins for this process (service)
import { pluginManager } from "../../lib"; // if your lib re-exports: `from '../../lib'`
import { loggerPlugin } from "./loggerPlugin";
import { metricsPlugin } from "./metricsPlugin";
import { headersPlugin } from "./headersPlugin";
import { tracingPlugin } from "./tracingPlugin";

// Call this at process start (publisher/consumer) to activate plugins.
export function registerPlugins(serviceName: string) {
  // Order can matter (headers before logger so logger prints the injected headers/corr)
  pluginManager.register(tracingPlugin());
  pluginManager.register(headersPlugin(serviceName));
  pluginManager.register(metricsPlugin());
  pluginManager.register(loggerPlugin(serviceName));
}
