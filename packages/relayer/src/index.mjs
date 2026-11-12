import { createServer } from 'node:http';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider } from 'near-api-js';
import { TESTNET_RPC, dryQuote } from '@tong/sdk';
import { Budget, relay } from './core.mjs';
const config=JSON.parse(await readFile(resolve('deployments/testnet.json'),'utf8'));
const rpcUrl=TESTNET_RPC;
const keyFile=process.env.TONG_RELAYER_KEY_FILE??'.near-credentials/relayer.json';
const c=JSON.parse(await readFile(keyFile,'utf8'));
if(!c.account_id.endsWith('.testnet')||!config.contract_id.endsWith('.testnet'))throw new Error('Testnet only');
const account=new Account(c.account_id,new JsonRpcProvider({url:rpcUrl}),new KeyPairSigner(KeyPair.fromString(c.secret_key)));
const port=Number(process.env.PORT??5371);
if(port<5300||port>5999)throw new Error('Use a port in 5300–5999');
const budget=new Budget(process.env.TONG_BUDGET_FILE??'.demo/relayer-budget.json');
const origins=(process.env.TONG_ORIGINS??'http://127.0.0.1:5370,http://localhost:5370').split(',');
await mkdir('deployments',{recursive:true});
const record=entry=>appendFile('deployments/relayer-transactions.jsonl',JSON.stringify(entry)+'\n');
let queue=Promise.resolve();
const limits=new Map();
const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&!origins.includes(origin)){res.writeHead(403);res.end('Origin not allowed');return;}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  const send=(code,data)=>{res.writeHead(code);res.end(JSON.stringify(data));};
  if(req.method==='OPTIONS'){send(204,{});return;}
  if(req.url==='/api/health'&&req.method==='GET'){send(200,{network:'testnet',contractId:config.contract_id,sponsorship:'bounded',dailyMaxCalls:40,dailyMaxNear:'4'});return;}
  const address=req.socket.remoteAddress;
  const now=Date.now();const recent=(limits.get(address)??[]).filter(t=>now-t<60000);limits.set(address,recent);
  if(recent.length>=8){send(429,{error:'Please wait a minute before the next request.'});return;}recent.push(now);
  try {
    if(req.url==='/api/quote'&&req.method==='GET'){send(200,await dryQuote());return;}
    if(req.url!=='/api/relay'||req.method!=='POST'){send(404,{error:'Not found'});return;}
    let chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>8192){send(413,{error:'Request too large'});return;}chunks.push(chunk);}
    const authorization=JSON.parse(Buffer.concat(chunks).toString());
    const task=queue.then(()=>relay({authorization,contractId:config.contract_id,account,rpcUrl,budget,record}));
    queue=task.catch(()=>{});send(200,await task);
  }catch(error){send(400,{error:error.message});}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`Tong testnet relayer http://127.0.0.1:${port} · ${config.contract_id}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
