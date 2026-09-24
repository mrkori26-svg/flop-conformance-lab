import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist/conformance", { recursive: true, force: true });
mkdirSync("dist/conformance", { recursive: true });
cpSync("conformance/fixtures", "dist/conformance/fixtures", { recursive: true });
cpSync("conformance/sources", "dist/conformance/sources", { recursive: true });
cpSync("conformance/observatory", "dist/conformance/observatory", { recursive: true });

cpSync("conformance/interactions", "dist/conformance/interactions", { recursive: true });
