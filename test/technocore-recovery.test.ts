import test from "node:test";
import assert from "node:assert/strict";
import {
  preferLocalSnapshot,
  recoverTechnocoreRecord,
  type BoundedRecoveryPage,
  type RecoveryAdapter,
} from "../src/technocore-recovery.js";

const target = { room: "d-flop-infra", generation: 3, seq: 42 };
const record = { ...target, text: "signed evidence" };

function adapter(options: {
  direct?: boolean;
  pages?: BoundedRecoveryPage[];
}): RecoveryAdapter {
  let index = 0;
  return {
    async readPage() {
      return options.direct ? record : null;
    },
    async readRetained() {
      const page = options.pages?.[index++];
      return page ?? { records: [], truncated: false };
    },
  };
}

test("live page hit wins without retained-ring recovery", async () => {
  const result = await recoverTechnocoreRecord(adapter({ direct: true }), target);
  assert.equal(result.availability, "LIVE_PAGE");
  assert.equal(result.record?.seq, 42);
});

test("page miss followed by retained-ring hit is recovered, not expired", async () => {
  const result = await recoverTechnocoreRecord(
    adapter({ pages: [{ records: [record], truncated: false }] }),
    target,
  );
  assert.equal(result.availability, "RETAINED_RING");
  assert.equal(result.record?.text, "signed evidence");
});

test("page miss and retained-ring miss becomes unavailable", async () => {
  const result = await recoverTechnocoreRecord(
    adapter({ pages: [{ records: [], truncated: false }] }),
    target,
  );
  assert.equal(result.availability, "UNAVAILABLE");
});

test("bounded recovery follows explicit continuation", async () => {
  const result = await recoverTechnocoreRecord(
    adapter({
      pages: [
        { records: [{ room: target.room, generation: 3, seq: 1, text: "old" }], truncated: true, continuation: "c2" },
        { records: [record], truncated: false },
      ],
    }),
    target,
    { limit: 2, maxPages: 3 },
  );
  assert.equal(result.availability, "RETAINED_RING");
});

test("unbounded recovery pages fail closed", async () => {
  const tooMany = Array.from({ length: 3 }, (_, i) => ({ room: target.room, generation: 3, seq: i + 1, text: "x" }));
  await assert.rejects(
    () => recoverTechnocoreRecord(adapter({ pages: [{ records: tooMany, truncated: false }] }), target, { limit: 2 }),
    /UNBOUNDED_RECOVERY_PAGE/,
  );
});

test("local durable snapshot remains usable after transport unavailability", () => {
  assert.equal(preferLocalSnapshot({ availability: "UNAVAILABLE" }, true).availability, "LOCAL_SNAPSHOT");
  assert.equal(preferLocalSnapshot({ availability: "UNAVAILABLE" }, false).availability, "UNAVAILABLE");
});
