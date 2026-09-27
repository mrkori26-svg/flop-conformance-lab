import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicAddress } from "../src/evidence-network-policy.js";

test("evidence network policy rejects private and loopback addresses",()=>{
  for(const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) assert.throws(()=>assertPublicAddress(address),/PRIVATE_ADDRESS_DENIED/);
});

test("evidence network policy accepts public addresses",()=>{
  assert.doesNotThrow(()=>assertPublicAddress("1.1.1.1"));
  assert.doesNotThrow(()=>assertPublicAddress("2606:4700:4700::1111"));
});
