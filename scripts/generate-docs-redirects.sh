#!/bin/bash
# Generate redirect pages for old VitePress URLs to new Fumadocs URLs
# This creates HTML files with meta refresh redirects

set -e

# Accept target directory as argument, default to website/out
OUT_DIR="${1:-website/out}"

# Redirect mapping: old_path -> new_path
# Format: "old_relative_path new_relative_path"
declare -a REDIRECTS=(
  # Guide section
  "docs/guide/what-is-rabbit-relay docs/what-is-rabbit-relay"
  "docs/guide/quickstart docs/quickstart"
  "docs/guide/delivery-semantics docs/delivery-semantics"
  "docs/guide/configuration docs/configuration"
  
  # Learn section
  "docs/learn/rabbitmq-basics docs/rabbitmq-basics"
  "docs/learn/exchanges-queues-bindings docs/exchanges-queues-bindings"
  "docs/learn/acknowledgements docs/delivery-semantics"
  "docs/learn/retry-dlq-redrive docs/retry-dlq"
  "docs/learn/topology-ownership docs/topology-modes"
  
  # Features section
  "docs/features/typed-events docs/typed-events"
  "docs/features/publisher-confirms docs/publisher-confirms"
  "docs/features/rpc docs/rpc"
  "docs/features/message-size-guard docs/message-size-guard"
  "docs/features/amqplib-escape-hatch docs/amqp-escape-hatch"
  "docs/features/middleware docs/middleware"
  "docs/features/headers-and-tracing docs/headers-and-tracing"
  "docs/features/consumer-concurrency docs/consumer-concurrency"
  "docs/features/error-handling docs/error-handling"
  "docs/features/retry-policy docs/exponential-backoff"
  "docs/features/dead-letter-queues docs/retry-dlq"
  "docs/features/ttl-dedupe docs/ttl-dedupe"
  "docs/features/reconnect docs/reconnect"
  "docs/features/health-checks docs/health-checks"
  "docs/features/graceful-shutdown docs/graceful-shutdown"
  "docs/features/lifecycle-hooks docs/lifecycle-hooks"
  "docs/features/opentelemetry docs/opentelemetry"
  "docs/features/topology-modes docs/topology-modes"
  "docs/features/topology-planner docs/topology-planner"
  "docs/features/topology-validation docs/topology-validation"
  "docs/features/plugins docs/plugins"
  "docs/features/cli-reference docs/cli-reference"
  
  # Examples section (all redirect to examples index)
  "docs/examples/basics docs/examples"
  "docs/examples/confirms docs/examples"
  "docs/examples/rpc docs/examples"
  "docs/examples/backpressure docs/examples"
  "docs/examples/retry-dlq docs/examples"
  "docs/examples/delayed-retry docs/examples"
  "docs/examples/dlq docs/examples"
  "docs/examples/idempotent-consumer docs/examples"
  "docs/examples/health-shutdown docs/examples"
  "docs/examples/lifecycle-hooks docs/examples"
  "docs/examples/dlq-redrive docs/examples"
  "docs/examples/topology-planner docs/examples"
  "docs/examples/topology-validation docs/examples"
  "docs/examples/topology-modes docs/examples"
  "docs/examples/escape-hatch docs/examples"
  "docs/examples/plugins docs/examples"
  "docs/examples/developer-experience docs/examples"
  "docs/examples/opentelemetry docs/examples"
)

# Generate redirect pages
for redirect in "${REDIRECTS[@]}"; do
  old_path=$(echo "$redirect" | cut -d' ' -f1)
  new_path=$(echo "$redirect" | cut -d' ' -f2)
  
  # Create directory if it doesn't exist
  mkdir -p "$OUT_DIR/$old_path"
  
  # Generate redirect HTML
  cat > "$OUT_DIR/$old_path/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0;url=/rabbit-relay/$new_path">
  <link rel="canonical" href="https://bitspacerlabs.github.io/rabbit-relay/$new_path">
</head>
<body>
  <p>If you are not redirected automatically, <a href="/rabbit-relay/$new_path">click here</a>.</p>
</body>
</html>
EOF
  
  echo "Created redirect: $old_path -> $new_path"
done

echo "Generated ${#REDIRECTS[@]} redirect pages"
