import fs from "node:fs";
import { adaptEvmReceipt, adaptBtcObservation } from "../dist/src/htlc-replay.js";
const H="11".repeat(32), TX="22".repeat(32), BLOCK="33".repeat(32), binding="payer->payee";
const evmInput={chainId:11155111,assetId:"ETH",event:"CLAIMED",transactionHash:`0x${TX}`,blockHash:`0x${BLOCK}`,blockNumber:123,timestamp:1700000000,hashLockHex:H,participantBinding:binding,amount:"42",finalityTag:"finalized",rawRpc:{jsonrpc:"2.0",result:{status:"0x1",blockNumber:"0x7b"}}};
const btcInput={network:"testnet",assetId:"BTC",event:"CLAIMED",txid:TX,blockHash:BLOCK,blockHeight:456,confirmations:6,requiredConfirmations:6,timestamp:1700000100,hashLockHex:H,participantBinding:binding,amountSats:"4200",rawRpc:{txid:TX,status:{confirmed:true,block_height:456,block_hash:BLOCK}}};
const vector={schema:"flop.htlc-replay-cross-language-v1",classification:"LOCAL_TEST_VECTOR",canonicalization:"@flop-labs/tclk canonicalJson for rawEvidenceSha256",vectors:[{id:"evm-finalized",input:evmInput,expected:adaptEvmReceipt(evmInput)},{id:"btc-confirmed",input:btcInput,expected:adaptBtcObservation(btcInput)}]};
fs.writeFileSync(new URL("../conformance/fixtures/htlc-replay-cross-language-v1.json",import.meta.url),JSON.stringify(vector,null,2)+"\n");
