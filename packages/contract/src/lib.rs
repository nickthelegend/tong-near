use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, collections::LookupMap, json_types::U64, serde_json::{self, json}};

const ACCOUNT_WASM: &[u8] = include_bytes!("../res/tong_account.wasm");
const LINK_DEPOSIT: NearToken = NearToken::from_millinear(1650);

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Tong { identities: LookupMap<String, Identity> }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Identity { pub account_id: AccountId, pub nonce: U64, pub ready: bool }

#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Request { pub domain: String, pub wallet: String, pub action: String, pub data: String, pub nonce: U64, pub deadline: U64 }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Note { note: String }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Transfer { to: String, value_wei: U64, nonce: U64, gas_price_wei: U64 }

#[near]
impl Tong {
    #[init]
    pub fn new() -> Self {
        require!(env::current_account_id().as_str().len() <= 23, "factory name too long");
        require!(env::predecessor_account_id() == env::current_account_id(), "self initialization only");
        Self { identities: LookupMap::new(b"i") }
    }
    pub fn get_config(&self) -> serde_json::Value {
        json!({"version":"1","network":"testnet","domain":self.domain(),"mpc_contract":"v1.signer-prod.testnet","path":"tong:sepolia:11155111","allowed_actions":["link","set_note","sign_sepolia"],"max_expiry_seconds":300,"link_deposit":"1650000000000000000000000","mpc_deposit":"10000000000000000000000"})
    }
    pub fn get_identity(&self, wallet: String) -> Option<Identity> { self.identities.get(&wallet) }
    pub fn derive_account(&self, wallet: String) -> AccountId {
        validate_wallet(&wallet);
        format!("{}.{}", &hex::encode(env::sha256(wallet.as_bytes()))[..40], env::current_account_id()).parse().unwrap()
    }
    #[payable]
    pub fn execute(&mut self, request: Request, signature: String) -> Promise {
        require!(request.domain == self.domain(), "wrong domain");
        let now = env::block_timestamp_ms() / 1000;
        require!(request.deadline.0 >= now && request.deadline.0 <= now + 300, "expired or excessive deadline");
        require!(request.data.len() <= 1024, "data too large");
        require!(["link", "set_note", "sign_sepolia"].contains(&request.action.as_str()), "disallowed action");
        validate_wallet(&request.wallet);
        self.verify(&request, &signature);
        let existing = self.identities.get(&request.wallet);
        let expected = existing.as_ref().map(|x|x.nonce.0).unwrap_or(0);
        require!(request.nonce.0 == expected, "wrong nonce or replay");
        let next = expected.checked_add(1).expect("nonce exhausted");
        let account_id = self.derive_account(request.wallet.clone());
        let promise = match request.action.as_str() {
            "link" => {
                require!(existing.is_none(), "already linked");
                require!(request.data == "{}", "link data must be empty");
                require!(env::attached_deposit() == LINK_DEPOSIT, "link requires 1.65 NEAR");
                self.identities.insert(&request.wallet, &Identity {account_id:account_id.clone(),nonce:U64(next),ready:false});
                Promise::new(account_id.clone()).create_account()
                    .transfer(NearToken::from_millinear(1600)).deploy_contract(ACCOUNT_WASM.to_vec())
                    .function_call("new",json!({"controller":env::current_account_id()}).to_string().into_bytes(),NearToken::from_yoctonear(0),Gas::from_tgas(10))
                    .then(Promise::new(env::current_account_id()).function_call("on_link",json!({"wallet":request.wallet}).to_string().into_bytes(),NearToken::from_yoctonear(0),Gas::from_tgas(10)))
            },
            action => {
                let mut identity = existing.expect("link wallet first"); require!(identity.ready,"account not ready");
                let (args,gas) = if action == "set_note" {
                    require!(env::attached_deposit().is_zero(),"note takes no deposit");
                    let note: Note = serde_json::from_str(&request.data).expect("invalid note data");
                    require!(note.note.len() <= 256,"note too long");
                    (json!({"note":note.note}),Gas::from_tgas(15))
                } else {
                    require!(env::attached_deposit() == NearToken::from_millinear(10), "MPC fee must be 0.01 NEAR");
                    let t: Transfer = serde_json::from_str(&request.data).expect("invalid transfer data");
                    require!(t.to.len()==42 && t.to.starts_with("0x") && hex::decode(&t.to[2..]).is_ok(),"invalid recipient");
                    require!(t.value_wei.0 <= 1_000_000_000_000_000,"transfer exceeds 0.001 ETH");
                    require!(t.gas_price_wei.0>0 && t.gas_price_wei.0<=100_000_000_000,"gas price exceeds 100 gwei");
                    (json!({"transfer":t}),Gas::from_tgas(220))
                };
                identity.nonce=U64(next); self.identities.insert(&request.wallet,&identity);
                Promise::new(account_id.clone()).function_call(action,args.to_string().into_bytes(),env::attached_deposit(),gas)
            }
        };
        env::log_str(&json!({"standard":"tong","version":"1.0.0","event":"authorized","data":[{"wallet":request.wallet,"account_id":account_id,"nonce":request.nonce,"action":request.action}]}).to_string());
        promise
    }
    #[private]
    pub fn on_link(&mut self, wallet: String) -> serde_json::Value {
        let mut identity = self.identities.get(&wallet).expect("missing pending identity");
        if env::promise_result_checked(0, 1024).is_ok() {
            identity.ready=true;self.identities.insert(&wallet,&identity);
            json!({"ok":true,"account_id":identity.account_id,"nonce":identity.nonce})
        } else {
            // Keep the consumed nonce and pending identity: no replay, no false ready state.
            json!({"ok":false,"account_id":identity.account_id,"error":"account creation failed; inspect receipts"})
        }
    }
}
impl Tong {
    fn domain(&self) -> String { format!("near:testnet:{}",env::current_account_id()) }
    fn verify(&self, r: &Request, signature: &str) {
        let sig=hex::decode(signature.strip_prefix("0x").unwrap_or(signature)).expect("invalid signature hex");
        if r.wallet.starts_with("evm:") {
            require!(sig.len()==65,"EVM signature length");
            let v=match sig[64] {0|1=>sig[64],27|28=>sig[64]-27,_=>env::panic_str("invalid recovery id")};
            let recovered=env::ecrecover(&typed_hash(r),&sig[..64],v,true).expect("invalid EVM signature");
            let h=env::keccak256(&recovered);
            require!(hex::encode(&h[12..])==r.wallet[6..],"wrong EVM signer");
        } else {
            let pk: [u8;32]=hex::decode(&r.wallet[7..]).unwrap().try_into().unwrap();
            let signature: [u8;64]=sig.try_into().expect("ed25519 signature length");
            let message=format!("Tong request v1\n{}\n{}\n{}\n{}\n{}\n{}",r.domain,r.wallet,r.action,hex::encode(env::keccak256(r.data.as_bytes())),r.nonce.0,r.deadline.0);
            require!(env::ed25519_verify(&signature,message.as_bytes(),&pk),"wrong ed25519 signer");
        }
    }
}
fn validate_wallet(wallet: &str) {
    let body=if wallet.starts_with("evm:0x") && wallet.len()==46 { &wallet[6..] }
        else if wallet.starts_with("solana:") && wallet.len()==71 { &wallet[7..] }
        else {env::panic_str("invalid wallet")};
    require!(body.bytes().all(|b|b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),"wallet must be canonical lowercase hex");
}
fn word(n: u64) -> Vec<u8> { let mut w=vec![0;24];w.extend(n.to_be_bytes());w }
fn typed_hash(r:&Request)->Vec<u8> {
    let mut d=env::keccak256(b"EIP712Domain(string name,string version,bytes32 salt)");
    d.extend(env::keccak256(b"Tong"));d.extend(env::keccak256(b"1"));d.extend(env::keccak256(r.domain.as_bytes()));
    let mut m=env::keccak256(b"TongRequest(string domain,string wallet,string action,string data,uint64 nonce,uint64 deadline)");
    for s in [&r.domain,&r.wallet,&r.action,&r.data] {m.extend(env::keccak256(s.as_bytes()));}
    m.extend(word(r.nonce.0));m.extend(word(r.deadline.0));
    let mut h=vec![0x19,0x01];h.extend(env::keccak256(&d));h.extend(env::keccak256(&m));env::keccak256(&h)
}
