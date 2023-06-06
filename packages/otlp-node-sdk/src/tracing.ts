import { NodeSampler, type NodeSamplerOptions } from "@mgcrea/otlp-node-sampler";
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import {
  HttpInstrumentation,
  type HttpInstrumentationConfig,
} from "@opentelemetry/instrumentation-http";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { IncomingMessage } from "http";
import {
  NODE_ENV,
  TRACING_IP_ALLOWLIST,
  TRACING_SERVICE_NAME,
  TRACING_SERVICE_VERSION,
  TRACING_USER_AGENT_DENYLIST,
} from "./env";

const isNotNullish = <T>(input: T | null | undefined): input is T => input != null;

const defaultHttpRequestHook: HttpInstrumentationConfig["requestHook"] = (span, request) => {
  if (request instanceof IncomingMessage) {
    const { method, url } = request;
    span.updateName(`${method} ${url}`);
  }
};

type KnownConfigs = {
  node: Parameters<typeof getNodeAutoInstrumentations>[0];
  http: ConstructorParameters<typeof HttpInstrumentation>[0];
  fastify: ConstructorParameters<typeof FastifyInstrumentation>[0];
  prisma: ConstructorParameters<typeof PrismaInstrumentation>[0];
};

type ObjectToTupleUnion<T extends Record<string, unknown>> = {
  [K in keyof T]: [K, T[K]];
}[keyof T];

type KnownPlugins = keyof KnownConfigs;
type KnownPluginsWithOptions = ObjectToTupleUnion<KnownConfigs>;
// type KnownPluginOptions = ExtractSecondItem<KnownConfigs>;

type ConfigureTracingOptions = Pick<NodeSamplerOptions, "ipAllowList" | "userAgentDenyList"> & {
  name: string;
  version: string;
  env?: string;
  logLevel?: DiagLogLevel;
  plugins?: Array<KnownPlugins | KnownPluginsWithOptions>;
  traceExporterOptions?: ConstructorParameters<typeof OTLPTraceExporter>[0];
  metricExporterOptions?: ConstructorParameters<typeof OTLPMetricExporter>[0];
};

export const configureTracing = (options: ConfigureTracingOptions) => {
  const {
    logLevel = DiagLogLevel.INFO,
    name = TRACING_SERVICE_NAME,
    version = TRACING_SERVICE_VERSION,
    env = NODE_ENV,
    ipAllowList = TRACING_IP_ALLOWLIST,
    userAgentDenyList = TRACING_USER_AGENT_DENYLIST,
    plugins = [],
    traceExporterOptions = {},
    // metricExporterOptions = {},
  } = options;

  diag.setLogger(new DiagConsoleLogger(), logLevel);

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: name,
      [SemanticResourceAttributes.SERVICE_VERSION]: version,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env,
    })
  );

  const sampler = new NodeSampler({
    ipAllowList,
    userAgentDenyList,
  });

  const provider = new NodeTracerProvider({
    resource,
    sampler,
  });

  const config = plugins.reduce<Partial<KnownConfigs>>((soFar, value) => {
    const name = Array.isArray(value) ? value[0] : value;
    const options = Array.isArray(value) ? value[1] : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    soFar[name] = options as any;
    return soFar;
  }, {});

  const instrumentations = [
    config.node ? getNodeAutoInstrumentations(config.node) : null,
    config.http
      ? new HttpInstrumentation({
          requestHook: defaultHttpRequestHook,
          ...config.http,
        })
      : null,
    config.fastify
      ? new FastifyInstrumentation({
          ...config.fastify,
        })
      : null,
    config.prisma
      ? new PrismaInstrumentation({
          ...config.prisma,
        })
      : null,
  ].filter(isNotNullish);

  registerInstrumentations({ instrumentations, tracerProvider: provider });

  const traceExporter = traceExporterOptions.url
    ? new OTLPTraceExporter(traceExporterOptions)
    : new ConsoleSpanExporter();
  const spanProcessor = new BatchSpanProcessor(traceExporter);
  provider.addSpanProcessor(spanProcessor);

  // @TODO
  // const metricExporter = metricExporterOptions.url
  //   ? new OTLPMetricExporter(metricExporterOptions)
  //   : new ConsoleMetricExporter();
  // const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter });

  // const consoleExporter = new ConsoleSpanExporter();
  // provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter));

  provider.register();

  // const sdk = new NodeSDK({
  //   resource,
  //   sampler,
  //   spanProcessor,
  //   metricReader,
  //   instrumentations,
  // });
  // sdk.start();
};
