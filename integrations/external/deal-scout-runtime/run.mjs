import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.env.DEAL_SCOUT_ROOT;
if (!root) throw new Error("DEAL_SCOUT_ROOT_MISSING");

const core = await import(pathToFileURL(join(root, "src", "core.mjs")).href);
const fixtures = await import(pathToFileURL(join(root, "tests", "fixtures.mjs")).href);

const fixture = fixtures.signedDealFixture();
const boardRaw = fixture.board.join("\n");
const parsedBoard = core.parseRoomExport(core.OFFER_ROOM, boardRaw, { generation: 0 });
if (parsedBoard.rejected.length) throw new Error("DEAL_SCOUT_BOARD_REJECTED");
const board = core.analyzeBoard(parsedBoard.records, parsedBoard.rejected, { nowMs: fixtures.FIXED_NOW });

const candidate = board.candidates[0];
if (!candidate) throw new Error("DEAL_SCOUT_NO_CANDIDATE");

const detailsRaw = fixture.details.join("\n");
const parsedDetails = core.parseRoomExport(fixture.room, detailsRaw, { generation: 0 });
if (parsedDetails.rejected.length) throw new Error("DEAL_SCOUT_DETAIL_REJECTED");

const inspection = core.inspectCandidate(candidate, parsedDetails.records, {
  detailLoaded: true,
  sourceMode: "file",
});

const report = await core.createReport({
  board,
  source: { ...parsedBoard.source, mode: "file" },
  candidate,
  inspection,
  evidence: null,
});

process.stdout.write(JSON.stringify({
  summary: board.summary,
  inspection: {
    status: inspection.status,
    terminal: inspection.terminal,
    rail: inspection.rail,
    eventCount: inspection.events.length,
    acceptedEvents: inspection.events.filter((x) => x.ok).length,
    findings: inspection.findings.length,
  },
  report: {
    schema: report.schema,
    reportId: report.reportId,
    limitations: report.limitations,
  },
}) + "\n");
