import type { ModelMeta, ThinkingLevel } from "../shared/messages";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  google: "Google",
  openai: "OpenAI",
  "openai-codex": "OpenAI Codex",
  mistral: "Mistral",
  groq: "Groq",
  openrouter: "OpenRouter",
  xai: "xAI",
  amazon: "Amazon",
};

export function providerLabel(provider: string): string {
  if (PROVIDER_LABELS[provider]) return PROVIDER_LABELS[provider];
  return provider
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function effortLabel(level: ThinkingLevel): string {
  if (level === "off") return "Off";
  if (level === "xhigh") return "Extra high";
  return level.slice(0, 1).toUpperCase() + level.slice(1);
}

export function triggerLabel(level: ThinkingLevel): string {
  return level === "off" ? "Fast" : effortLabel(level);
}

export function isFastThinking(level: ThinkingLevel): boolean {
  return level === "off";
}

export function fallbackEffort(allowed?: ThinkingLevel[]): ThinkingLevel {
  const options = allowed?.length ? allowed : (["medium"] as ThinkingLevel[]);
  return options.find((level) => level !== "off") ?? options[0] ?? "medium";
}

export function modelHint(model: ModelMeta): string | undefined {
  if (!model.authenticated) return "no key";
  return undefined;
}

export type ModelGroup = {
  provider: string;
  label: string;
  models: ModelMeta[];
};

export function groupModels(models: ModelMeta[], query: string): ModelGroup[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? models.filter((model) =>
        `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(needle),
      )
    : models;
  const groups = new Map<string, ModelMeta[]>();
  for (const model of filtered) {
    const list = groups.get(model.provider) ?? [];
    list.push(model);
    groups.set(model.provider, list);
  }
  return [...groups.entries()]
    .map(([provider, grouped]) => ({
      provider,
      label: providerLabel(provider),
      models: [...grouped].sort(
        (a, b) => Number(b.authenticated) - Number(a.authenticated),
      ),
    }))
    .sort((a, b) => {
      const aAuth = a.models.some((model) => model.authenticated) ? 0 : 1;
      const bAuth = b.models.some((model) => model.authenticated) ? 0 : 1;
      if (aAuth !== bAuth) return aAuth - bAuth;
      return a.label.localeCompare(b.label);
    });
}
