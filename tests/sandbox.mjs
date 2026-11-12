import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { Account,KeyPair,KeyPairSigner,JsonRpcProvider } from 'near-api-js';
import { Wallet,hexlify } from 'ethers';
import { ed25519 } from '@noble/curves/ed25519';
import { TYPES,typedDomain,edMessage,evmWallet,solanaWallet,view,FEES } from '../packages/sdk/src/index.mjs';
import { decodeOutcome } from '../packages/relayer/src/core.mjs';
const url=process.env.TONG_SANDBOX_RPC;const provider=new JsonRpcProvider({url});
const k=JSON.parse(await readFile(process.env.TONG_SANDBOX_KEY_FILE,'utf8'));
const root=new Account('test.near',provider,new KeyPairSigner(KeyPair.fromString(k.secret_key)));
const contract='tong.test.near';const key=KeyPair.fromRandom('ed25519');
const wallet=Wallet.createRandom(), wrong=Wallet.createRandom(), edKey=ed25519.utils.randomPrivateKey();
const evmId=evmWallet(wallet.address),edId=solanaWallet(ed25519.getPublicKey(edKey));
let passed=[];
async function run(label,fn){await fn();passed.push(label);}
const sign=async(r,signer=wallet)=>signer.signTypedData(typedDomain(r.domain),TYPES,r);
const req=(id,action,nonce,data='{}',extra={})=>({domain:`near:testnet:${contract}`,wallet:id,action,data,nonce:String(nonce),deadline:String(Math.floor(Date.now()/1000)+240),...extra});
async function call(r,signature,deposit=FEES[r.action]??'0') {
 try{return decodeOutcome(await root.callFunctionRaw({contractId:contract,methodName:'execute',args:{request:r,signature},gas:280_000_000_000_000n,deposit:BigInt(deposit),waitUntil:'FINAL'}));}
 catch(e){return {ok:false,failure:e.message};}
}
async function reject(r,signature,pattern,deposit){const out=await call(r,signature,deposit);assert.equal(out.ok,false);assert.match(JSON.stringify(out.failure),pattern);}
test('NEAR WASM sandbox: cryptographic authorization and account isolation', {timeout:180000},async()=>{
 await root.createAccount({newAccountId:contract,publicKey:key.getPublicKey(),nearToTransfer:10n*10n**24n});
 const factory=new Account(contract,provider,new KeyPairSigner(key));
 await factory.deployContract(await readFile('packages/contract/target/near/tong.wasm'));
 await factory.callFunction({contractId:contract,methodName:'new',args:{},gas:30_000_000_000_000n});
 let r=req(evmId,'link',0),sig=await sign(r);
 await run('valid EVM EIP-712 signature creates keyless controlled account',async()=>{const out=await call(r,sig);assert.equal(out.ok,true,JSON.stringify(out));assert.equal((await view(contract,'get_identity',{wallet:evmId},url)).ready,true);});
 await run('replay rejected on chain',()=>reject(r,sig,/nonce|replay/));
 r=req(evmId,'set_note',1,'{"note":"Connected through Tong"}');
 await run('wrong EVM signer rejected',async()=>reject(r,await sign(r,wrong),/wrong EVM signer/));
 await run('expired request rejected',async()=>{const x={...r,deadline:'1'};await reject(x,await sign(x),/expired/);});
 await run('wrong domain rejected',async()=>{const x={...r,domain:'near:testnet:evil.testnet'};await reject(x,await sign(x),/wrong domain/);});
 await run('disallowed action rejected',async()=>{const x={...r,action:'delete_account'};await reject(x,await sign(x),/disallowed action/,'0');});
 await run('tampered action data rejected',async()=>{await reject({...r,data:'{"note":"changed"}'},await sign(r),/wrong EVM signer/);});
 await run('valid signed NEAR note action executes on child',async()=>{const out=await call(r,await sign(r));assert.equal(out.ok,true,JSON.stringify(out));const id=await view(contract,'get_identity',{wallet:evmId},url);assert.equal((await view(id.account_id,'get_state',{},url)).note,'Connected through Tong');});
 await run('child refuses direct relayer call',async()=>{const id=await view(contract,'get_identity',{wallet:evmId},url);await assert.rejects(()=>root.callFunction({contractId:id.account_id,methodName:'set_note',args:{note:'bypass'},gas:30_000_000_000_000n}),/controller only/);});
 r=req(edId,'link',0);sig=hexlify(ed25519.sign(edMessage(r),edKey));
 await run('valid ed25519 signature creates distinct controlled account',async()=>{const out=await call(r,sig);assert.equal(out.ok,true,JSON.stringify(out));const a=await view(contract,'get_identity',{wallet:evmId},url),b=await view(contract,'get_identity',{wallet:edId},url);assert.notEqual(a.account_id,b.account_id);const keys=await provider.query({request_type:'view_access_key_list',finality:'final',account_id:b.account_id});assert.equal(keys.keys.length,0);});
 await run('wrong ed25519 signer rejected',async()=>{const x=req(edId,'set_note',1,'{"note":"hello"}');await reject(x,hexlify(ed25519.sign(edMessage(x),ed25519.utils.randomPrivateKey())),/wrong ed25519 signer/);});
 await run('unbounded Sepolia value rejected on chain',async()=>{const x=req(evmId,'sign_sepolia',2,JSON.stringify({to:wallet.address,value_wei:'1000000000000001',nonce:'0',gas_price_wei:'1000000000'}));await reject(x,await sign(x),/exceeds 0.001 ETH/);});
 await writeFile('deployments/sandbox-tests.json',JSON.stringify({at:new Date().toISOString(),network:'local sandbox',passed:passed.length,checks:passed},null,2)+'\n');
 console.log(`${passed.length} on-chain sandbox checks passed`);
});
