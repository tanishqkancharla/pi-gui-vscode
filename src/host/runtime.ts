import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PiClient } from "@earendil-works/pi-client";
import { createUnixTransportFactory } from "@earendil-works/pi-client/unix";
import { createUnixServer } from "@earendil-works/pi-server/unix";
import type { PiServer } from "@earendil-works/pi-server";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { CodingAgentServerService } from "./adapter";
import { isSocketListening, removeStaleSocket, resolveSocketPath } from "./discovery";

export interface PiRuntime {
  client: PiClient;
  socketPath: string;
  startedServer: boolean;
  service?: CodingAgentServerService;
  dispose(): Promise<void>;
}

export interface CreatePiRuntimeOptions {
  cwd: string;
  configuredSocket?: string;
  agentDir?: string;
}

export async function createPiRuntime(options: CreatePiRuntimeOptions): Promise<PiRuntime> {
  const socketPath = resolveSocketPath(options.configuredSocket);
  if (await isSocketListening(socketPath)) {
    return connectClient(socketPath, { startedServer: false });
  }

  await mkdir(dirname(socketPath), { recursive: true });
  await removeStaleSocket(socketPath);

  const service = await CodingAgentServerService.create({
    cwd: options.cwd,
    agentDir: options.agentDir ?? getAgentDir(),
  });
  const server = createUnixServer(service, { path: socketPath });
  await server.start();
  return connectClient(socketPath, { startedServer: true, server, service });
}

async function connectClient(
  socketPath: string,
  extras: {
    startedServer: boolean;
    server?: PiServer;
    service?: CodingAgentServerService;
  },
): Promise<PiRuntime> {
  const client = new PiClient({
    transportFactory: createUnixTransportFactory({ path: socketPath }),
  });
  await client.connect();
  return {
    client,
    socketPath,
    startedServer: extras.startedServer,
    service: extras.service,
    async dispose() {
      await client.dispose();
      if (extras.server && extras.startedServer) {
        await extras.server.close();
      }
    },
  };
}
