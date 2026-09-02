import { z } from "zod";

export const ThinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

export const ConnectionStatusSchema = z.enum([
  "connecting",
  "connected",
  "disconnected",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const ModelRefSchema = z.object({
  provider: z.string(),
  id: z.string(),
});

export const SessionMetaSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  sessionName: z.string().optional(),
  cwd: z.string().optional(),
});
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const ModelMetaSchema = z.object({
  provider: z.string(),
  id: z.string(),
  name: z.string(),
  authenticated: z.boolean(),
  reasoning: z.boolean().optional(),
  supportedThinkingLevels: z.array(ThinkingLevelSchema).optional(),
});
export type ModelMeta = z.infer<typeof ModelMetaSchema>;

export const WebviewMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("prompt"), text: z.string() }),
  z.object({ type: z.literal("steer"), text: z.string() }),
  z.object({ type: z.literal("abort") }),
  z.object({ type: z.literal("new-session") }),
  z.object({ type: z.literal("open-session"), sessionId: z.string() }),
  z.object({
    type: z.literal("set-model"),
    provider: z.string(),
    id: z.string(),
  }),
  z.object({ type: z.literal("set-thinking"), level: ThinkingLevelSchema }),
  z.object({ type: z.literal("search-files"), query: z.string() }),
  z.object({ type: z.literal("open-file"), path: z.string() }),
]);
export type WebviewMessage = z.infer<typeof WebviewMessageSchema>;

export const HostMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    status: ConnectionStatusSchema,
    startedServer: z.boolean().optional(),
    socketPath: z.string().optional(),
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(["missing-key", "runtime", "session"]).optional(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("server-snapshot"),
    sessions: z.array(SessionMetaSchema),
    models: z.array(ModelMetaSchema),
  }),
  z.object({
    type: z.literal("session-snapshot"),
    snapshot: z.unknown(),
  }),
  z.object({
    type: z.literal("session-progress"),
    progress: z.unknown(),
  }),
  z.object({
    type: z.literal("search-files-result"),
    files: z.array(z.string()),
  }),
  z.object({
    type: z.literal("editor-selection"),
    filePath: z.string(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
  }),
]);
export type HostMessage = z.infer<typeof HostMessageSchema>;

export function parseWebviewMessage(data: unknown): WebviewMessage | null {
  const result = WebviewMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseHostMessage(data: unknown): HostMessage | null {
  const result = HostMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}
