import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";

const prometheusExporter = new PrometheusExporter({
  port: 9464, // default prometheus scrape port
  endpoint: "/metrics",
});

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_COLLECTOR_ENDPOINT!}/v1/traces`,
  }),
  metricReader: prometheusExporter, // replaces PeriodicExportingMetricReader
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: "liteparse-server",
});

sdk.start();
