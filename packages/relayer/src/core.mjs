import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FEES, validateRequest, verifyAuthorization, view, explorer } from '@tong/sdk';
export const GAS=280_000_000_000_000n;
export class Budget {
  constructor(file,{maxCost=4n*10n**24n,maxCalls=40}={}){Object.assign(this,{file,maxCost,maxCalls});}
  async reserve(deposit){
    const day=new Date().toISOString().slice(0,10);
    let state;
    try {state=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Budget ledger unreadable; refusing to spend');}
    if(!state || state.day!==day)state={day,calls:0,reserved:'0'};
    // 0.01 NEAR conservative gas allowance per request; reservations survive failed transactions.
    const cost=BigInt(deposit)+10n**22n;
    if(state.calls>=this.maxCalls || BigInt(state.reserved)+cost>this.maxCost)throw new Error('Daily sponsorship budget exhausted');
    state.calls++;state.reserved=String(BigInt(state.reserved)+cost);
    await mkdir(dirname(this.file),{recursive:true});await writeFile(`${this.file}.tmp`,JSON.stringify(state),{mode:0o600});await rename(`${this.file}.tmp`,this.file);return state;
  }
}
export function decodeOutcome(outcome){
  const txHash=outcome.transaction?.hash??outcome.transaction_outcome?.id;
  const failure=outcome.status?.Failure??outcome.receipts_outcome?.find(r=>r.outcome.status.Failure)?.outcome.status.Failure;
  let result=null;
  if(outcome.status?.SuccessValue) {const text=Buffer.from(outcome.status.SuccessValue,'base64').toString();try{result=JSON.parse(text);}catch{result=text;}}
  return {txHash,explorer:explorer(txHash),ok:!failure && result?.ok!==false,result,failure:failure??(result?.ok===false?result.error:null)};
}
export async function relay({authorization,contractId,account,rpcUrl,budget,record}){
  const {request,signature}=authorization??{};
  validateRequest(request,contractId);
  if(typeof signature!=='string'||signature.length>132||!verifyAuthorization(request,signature))throw new Error('Invalid wallet signature');
  const identity=await view(contractId,'get_identity',{wallet:request.wallet},rpcUrl);
  if(request.nonce!==(identity?.nonce??'0'))throw new Error('Wrong nonce or replay');
  if(request.action==='link' ? identity!==null : !identity?.ready)throw new Error(request.action==='link'?'Already linked':'Link the wallet first');
  await budget.reserve(FEES[request.action]);
  let outcome;
  try {outcome=await account.callFunctionRaw({contractId,methodName:'execute',args:{request,signature},gas:GAS,deposit:BigInt(FEES[request.action]),waitUntil:'FINAL'});}
  catch(error){
    if(error.transaction_outcome)outcome=error;
    else {await record({at:new Date().toISOString(),action:request.action,wallet:request.wallet,error:String(error.message).slice(0,600),txHash:error.context?.transactionHash??null,ok:false});throw new Error('Transaction did not return final success; inspect relayer ledger before retrying.');}
  }
  const result=decodeOutcome(outcome);
  await record({at:new Date().toISOString(),action:request.action,wallet:request.wallet,...result,outcome});
  if(!result.ok)throw new Error(`Transaction failed: ${result.txHash}. ${JSON.stringify(result.failure).slice(0,240)}`);
  return result;
}
