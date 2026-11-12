import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { TESTNET_RPC, view, domainFor, deriveSepoliaAddress, dryQuote, validateRequest, verifyAuthorization } from '@tong/sdk';
const config=JSON.parse(await readFile(new URL('../../../deployments/testnet.json',import.meta.url),'utf8'));
const contractId=config.contract_id;
const server=new McpServer({name:'tong',version:'0.1.0'});
const result=data=>({content:[{type:'text',text:JSON.stringify(data,null,2)}]});
server.tool('tong_identity','Read a foreign wallet’s controlled NEAR account and nonce.',{wallet:z.string()},async({wallet})=>result(await view(contractId,'get_identity',{wallet})));
server.tool('tong_prepare','Prepare an expiring request for the human wallet to sign. Does not sign or spend.',{wallet:z.string(),action:z.enum(['link','set_note','sign_sepolia']),data:z.string()},async({wallet,action,data})=>{
  const identity=await view(contractId,'get_identity',{wallet});
  return result(validateRequest({domain:domainFor(contractId),wallet,action,data,nonce:identity?.nonce??'0',deadline:String(Math.floor(Date.now()/1000)+240)},contractId));
});
server.tool('tong_verify','Verify a supplied wallet authorization locally; no transaction is sent.',{request:z.object({domain:z.string(),wallet:z.string(),action:z.string(),data:z.string(),nonce:z.string(),deadline:z.string()}),signature:z.string()},async({request,signature})=>{
  validateRequest(request,contractId);return result({valid:verifyAuthorization(request,signature)});
});
server.tool('tong_derived_address','Derive the Sepolia address controlled by a Tong child account.',{accountId:z.string()},async({accountId})=>{
  if(!accountId.endsWith(`.${contractId}`))throw new Error('Account must belong to this Tong factory');
  return result({accountId,address:await deriveSepoliaAddress(accountId,TESTNET_RPC),chainId:11155111});
});
server.tool('tong_dry_quote','Fetch a live mainnet 1Click dry quote for 10 USDC Ethereum → NEAR. No transfer.',{},async()=>result(await dryQuote()));
await server.connect(new StdioServerTransport());
