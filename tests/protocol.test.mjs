import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, hexlify } from 'ethers';
import { ed25519 } from '@noble/curves/ed25519';
import { Budget } from '../packages/relayer/src/core.mjs';
import { validateRequest, verifyAuthorization, typedDomain, TYPES, edMessage, evmWallet, solanaWallet, unsignedSepolia, TongConnector } from '../packages/sdk/src/index.mjs';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const contract='tong.testnet';
const make=(wallet,extra={})=>({domain:`near:testnet:${contract}`,wallet,action:'link',data:'{}',nonce:'0',deadline:String(Math.floor(Date.now()/1000)+120),...extra});
test('EIP-712 authorization binds wallet, domain, nonce and action',async()=>{
 const key=Wallet.createRandom();const r=make(evmWallet(key.address));validateRequest(r,contract);
 const sig=await key.signTypedData(typedDomain(r.domain),TYPES,r);
 assert.equal(verifyAuthorization(r,sig),true);
 for(const extra of [{nonce:'1'},{domain:'near:testnet:other.testnet'},{action:'set_note'},{wallet:evmWallet(Wallet.createRandom().address)}])assert.equal(verifyAuthorization({...r,...extra},sig),false);
});
test('ed25519 authorization binds every canonical message field',()=>{
 const key=ed25519.utils.randomPrivateKey();const r=make(solanaWallet(ed25519.getPublicKey(key)));const sig=hexlify(ed25519.sign(edMessage(r),key));
 assert.equal(verifyAuthorization(r,sig),true);assert.equal(verifyAuthorization({...r,data:'{"note":"tampered"}'},sig),false);
});
test('policy rejects unbounded transfer, unexpected fields and excessive expiry',()=>{
 const r=make(evmWallet(Wallet.createRandom().address));
 for(const extra of [{action:'delete_account'},{deadline:'99999999999'},{nonce:'01'},{extra:1},{data:'{"x":1}'}])assert.throws(()=>validateRequest({...r,...extra},contract));
 const t={to:Wallet.createRandom().address,value_wei:'1000000000000001',nonce:'0',gas_price_wei:'1000000000'};
 assert.throws(()=>validateRequest({...r,action:'sign_sepolia',data:JSON.stringify(t)},contract));
 t.value_wei='0';const valid={...r,action:'sign_sepolia',data:JSON.stringify(t)};assert.equal(validateRequest(valid,contract),valid);assert.equal(unsignedSepolia(t).chainId,11155111n);
});
test('budget persists reservations and rejects exhaustion across restart',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/tong-budget-`);const file=`${dir}/budget.json`;
 try{const b=new Budget(file,{maxCalls:2,maxCost:10n**24n});await b.reserve('1');await b.reserve('1');await assert.rejects(()=>new Budget(file,{maxCalls:2}).reserve('1'),/exhausted/);assert.equal(JSON.parse(await readFile(file)).calls,2);}finally{await rm(dir,{recursive:true});}
});
test('connector reports missing wallet without faking a connection',async()=>{
 const c=new TongConnector({contractId:contract});await assert.rejects(()=>c.connect('evm'),/Install/);assert.equal(c.wallet,null);
});
