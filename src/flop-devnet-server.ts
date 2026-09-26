import { createServer } from "node:http";
import { computeDirectRailF1, type DirectRailF1Input } from "./direct-rail-f1.js";

export interface DevnetState {
  block: number;
  tasks: Map<string, unknown>;
  events: unknown[];
}

export function createFlopDevnetState(): DevnetState {
  return { block: 0, tasks: new Map(), events: [] };
}

function reply(res: any, id: unknown, result?: unknown, error?: unknown) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result }));
}

export function createFlopDevnetServer(state = createFlopDevnetState()) {
  return createServer(async (req, res) => {
    if (req.method !== "POST") return reply(res, null, undefined, { code: -32600, message: "POST required" });
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body: any;
    try { body = JSON.parse(raw); } catch { return reply(res, null, undefined, { code: -32700, message: "parse error" }); }
    const id = body.id ?? null;
    const method = body.method;
    const params = Array.isArray(body.params) ? body.params : [];
    if (method === "system_chain") return reply(res, id, "FLOP Experimental Devnet");
    if (method === "flop_getRuntimeVersion") return reply(res, id, {
      implementation: "flop-tools/experimental-devnet",
      specVersion: 1,
      implVersion: 1,
      classification: "EXPERIMENTAL_LOCAL_POLICY",
      officialRuntime: false,
    });
    if (method === "flop_getCapabilities") return reply(res, id, [
      "direct-rail-f1",
      "producer",
      "validator",
      "rpc-dispatch",
      "storage-readback",
      "event-readback",
    ]);
    if (method === "flop_getTask") return reply(res, id, state.tasks.get(String(params[0] ?? "")) ?? null);
    if (method === "flop_getEvents") return reply(res, id, state.events);
    if (method !== "flop_submitF1") return reply(res, id, undefined, { code: -32601, message: "method not found" });
    const input = params[0] as DirectRailF1Input;
    let computed;
    try { computed = computeDirectRailF1(input); }
    catch (error) { return reply(res, id, undefined, { code: -32001, message: error instanceof Error ? error.message : "invalid F1" }); }
    state.block += 1;
    const record = {
      block: state.block,
      taskHashHex: computed.taskHashHex,
      reportDataHex: computed.reportDataHex,
      input,
    };
    state.tasks.set(computed.taskHashHex, record);
    state.events.push({
      block: state.block,
      section: "flop_poui",
      method: "F1Executed",
      taskHashHex: computed.taskHashHex,
      reportDataHex: computed.reportDataHex,
    });
    return reply(res, id, {
      accepted: true,
      block: state.block,
      taskHashHex: computed.taskHashHex,
      reportDataHex: computed.reportDataHex,
    });
  });
}

if (process.argv[1]?.endsWith("flop-devnet-server.js")) {
  const port = Number(process.env.FLOP_DEVNET_PORT ?? "9944");
  const server = createFlopDevnetServer();
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`FLOP_DEVNET_READY http://127.0.0.1:${port}\n`);
  });
}
