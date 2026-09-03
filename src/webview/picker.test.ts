import { describe, expect, it } from "vitest";
import type { ModelMeta } from "../shared/messages";
import {
  effortLabel,
  fallbackEffort,
  groupModels,
  isFastThinking,
  modelHint,
  providerLabel,
  triggerLabel,
} from "./picker";

const models: ModelMeta[] = [
  {
    provider: "openai-codex",
    id: "gpt-5.4",
    name: "GPT-5.4",
    authenticated: true,
  },
  {
    provider: "anthropic",
    id: "claude-opus-4-5",
    name: "Claude Opus",
    authenticated: false,
  },
];

describe("picker labels", () => {
  it("names providers and thinking levels", () => {
    expect(providerLabel("openai-codex")).toBe("OpenAI Codex");
    expect(providerLabel("custom-lab")).toBe("Custom Lab");
    expect(effortLabel("xhigh")).toBe("Extra high");
    expect(triggerLabel("off")).toBe("Fast");
    expect(triggerLabel("high")).toBe("High");
    expect(isFastThinking("off")).toBe(true);
    expect(fallbackEffort(["off", "high"])).toBe("high");
  });

  it("groups models and marks missing keys", () => {
    expect(groupModels(models, "opus")).toEqual([
      {
        provider: "anthropic",
        label: "Anthropic",
        models: [models[1]],
      },
    ]);
    expect(modelHint(models[0])).toBeUndefined();
    expect(modelHint(models[1])).toBe("no key");
  });

  it("lists authenticated providers first", () => {
    expect(groupModels(models, "").map((group) => group.provider)).toEqual([
      "openai-codex",
      "anthropic",
    ]);
  });
});
