import test from "node:test";
import assert from "node:assert/strict";
import { receiptMessageV1 } from "../src/flop-quote-boundary.js";

const base = {
  channelIdHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  finalRootHex: "fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0",
  aggregateGn: "0",
  payable: "0",
};

// Literal expectations, independent of the production encoder's shift loop.
const amounts = [
  ["0", "00000000000000000000000000000000"],
  ["1", "01000000000000000000000000000000"],
  ["256", "00010000000000000000000000000000"],
  ["9007199254740993", "01000000000020000000000000000000"],
  ["18446744073709551616", "00000000000000000100000000000000"],
  ["340282366920938463463374607431768211455", "ffffffffffffffffffffffffffffffff"],
] as const;

for (const [value, hex] of amounts) {
  for (const field of ["aggregateGn", "payable"] as const) {
    test(`receipt v1 encodes ${field}=${value} byte-exactly`, () => {
      const message = receiptMessageV1({ ...base, [field]: value });
      const expected = "464c4f502f434f4d505554455f4348414e4e454c2f5245434549505401"
        + base.channelIdHex + base.finalRootHex
        + (field === "aggregateGn" ? hex : amounts[0][1])
        + (field === "payable" ? hex : amounts[0][1]);
      assert.equal(message.length, 125);
      assert.equal(message.toString("hex"), expected);
    });
  }
}

for (const [field, label] of [["aggregateGn", "AGGREGATE_GN"], ["payable", "PAYABLE"]] as const) {
  test(`receipt v1 rejects overflow and invalid decimal strings in ${field}`, () => {
    assert.throws(() => receiptMessageV1({ ...base, [field]: (1n << 128n).toString() }),
      new RegExp(`${label}_U128_OVERFLOW`));
    for (const value of ["-1", "+1", "1.5", "1e3", "0x10", "", " 1", "1 ", "１"]) {
      assert.throws(() => receiptMessageV1({ ...base, [field]: value }),
        new RegExp(`${label}_MUST_BE_UNSIGNED_DECIMAL`), JSON.stringify(value));
    }
  });
}

for (const [field, label] of [["channelIdHex", "CHANNEL_ID"], ["finalRootHex", "FINAL_ROOT"]] as const) {
  test(`receipt v1 checks exact hexadecimal length and alphabet in ${field}`, () => {
    for (const value of ["", "00".repeat(31), "00".repeat(33), "0".repeat(63), "gg".repeat(32), `0x${base[field]}`]) {
      assert.throws(() => receiptMessageV1({ ...base, [field]: value }),
        new RegExp(`${label}_MUST_BE_32_BYTES_HEX`));
    }
    assert.deepEqual(receiptMessageV1({ ...base, [field]: base[field].toUpperCase() }), receiptMessageV1(base));
  });
}
