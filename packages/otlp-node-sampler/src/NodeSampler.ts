/* eslint-disable testing-library/no-debugging-utils */
import { SpanKind, TraceFlags, type Attributes, type Context } from "@opentelemetry/api";
import { getSpan } from "@opentelemetry/api/build/src/trace/context-utils";
import { SamplingDecision, type Sampler, type SamplingResult } from "@opentelemetry/sdk-trace-base";
import { debug } from "./debug";

export type NodeSamplerOptions = {
  ipAllowList?: string[];
  userAgentDenylist?: string[];
  sampleByDefault?: boolean;
};

export class NodeSampler implements Sampler {
  private ipAllowList: Set<string>;
  private userAgentDenylist: Set<string>;
  private sampleByDefault: boolean;

  static RECORD_AND_SAMPLED: SamplingResult = {
    decision: SamplingDecision.RECORD_AND_SAMPLED,
    attributes: { ip_sampled: "yes" },
  };
  static NOT_RECORD: SamplingResult = {
    decision: SamplingDecision.NOT_RECORD,
  };

  constructor({ ipAllowList, userAgentDenylist, sampleByDefault }: NodeSamplerOptions = {}) {
    this.ipAllowList = new Set(ipAllowList);
    this.userAgentDenylist = new Set(userAgentDenylist);
    this.sampleByDefault = Boolean(sampleByDefault);
  }

  shouldSample(
    context: Context,
    _traceId: string,
    spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes
  ): SamplingResult {
    const parentSpan = getSpan(context);

    // Inherit sampling decision from parent span
    if (parentSpan) {
      const parentIsSampled = parentSpan.spanContext().traceFlags === TraceFlags.SAMPLED;
      return parentIsSampled ? NodeSampler.RECORD_AND_SAMPLED : NodeSampler.NOT_RECORD;
    }

    // Filter by user agent
    if (this.userAgentDenylist.size > 0) {
      const userAgent = attributes["http.user_agent"]?.toString();
      const isDeniedUserAgent = userAgent && this.userAgentDenylist.has(userAgent);
      if (isDeniedUserAgent) {
        debug(`Ignored span ${spanName} with client ip ${userAgent}}`);
        return NodeSampler.NOT_RECORD;
      }
    }

    // Filter by ip address
    if (this.ipAllowList.size > 0) {
      const clientIp = attributes["http.client_ip"]?.toString();
      const isAllowedIp = clientIp && this.ipAllowList.has(clientIp);
      if (!isAllowedIp) {
        debug(`Ignored span ${spanName} with client ip ${clientIp}}`);
        return NodeSampler.NOT_RECORD;
      }
    }

    if (this.sampleByDefault) {
      return NodeSampler.RECORD_AND_SAMPLED;
    }
    debug(`Ignored span ${spanName} with attribute ${JSON.stringify(attributes)}`);
    return NodeSampler.NOT_RECORD;
  }

  toString(): string {
    return "NodeSampler";
  }
}
