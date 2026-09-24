#!/usr/bin/env node
import { writeRuntimePublicStatus } from "./runtime-status.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};

const root = flag("--root") ?? ".runtime";
const jsonPath = flag("--json") ?? "runtime-public/runtime-index.json";
const markdownPath = flag("--markdown") ?? "runtime-public/STATUS.md";

const index = writeRuntimePublicStatus(root, jsonPath, markdownPath);
process.stdout.write(JSON.stringify({ targets: index.targets.length, json: jsonPath, markdown: markdownPath }, null, 2) + "\n");
