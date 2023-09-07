import assert from "node:assert";

export const NODE_ENV = process.env["NODE_ENV"];

export const TRACING_ENABLED =
  process.env["TRACING_ENABLED"] && process.env["TRACING_ENABLED"] !== "0";

export const TRACING_SERVICE_NAME = process.env["TRACING_SERVICE_NAME"];
assert(
  !TRACING_ENABLED || TRACING_SERVICE_NAME,
  "TRACING_SERVICE_NAME is required is TRACING_ENABLED is set",
);

export const TRACING_SERVICE_VERSION = process.env["TRACING_SERVICE_VERSION"];
assert(
  !TRACING_ENABLED || TRACING_SERVICE_VERSION,
  "TRACING_SERVICE_VERSION is required is TRACING_ENABLED is set",
);

export const TRACING_OTLP_URL = process.env["TRACING_OTLP_URL"];
assert(
  !TRACING_ENABLED || TRACING_OTLP_URL,
  "TRACING_OTLP_URL is required is TRACING_ENABLED is set",
);

export const TRACING_IP_ALLOWLIST = process.env["TRACING_IP_ALLOWLIST"]
  ? process.env["TRACING_IP_ALLOWLIST"].split(",")
  : [];

export const TRACING_USER_AGENT_DENYLIST = process.env["TRACING_USER_AGENT_DENYLIST"]
  ? process.env["TRACING_USER_AGENT_DENYLIST"].split("|")
  : [];
