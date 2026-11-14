use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, collections::LookupMap, json_types::{U64, U128}, serde_json::{self, json}};

const ACCOUNT_WASM: &[u8] = include_bytes!("../res/tong_account.wasm");
const MILLI: u128 = 1_000_000_000_000_000_000_000;
const NEAR: u128 = 1_000 * MILLI;
const LINK_DEPOSIT: u128 = 1_900 * MILLI;
const ACCOUNT_FUNDING: u128 = 1_850 * MILLI;
const MPC_FEE: u128 = 10 * MILLI;
const DAY_NS: u64 = 86_400_000_000_000;
const ACTIONS: [&str; 7] = ["link", "set_note", "call", "send_near", "grant", "revoke", "sign_sepolia"];
// Defaults written into every new account's policy. The wallet can change grants later by signing
// a separate `grant` or `revoke` request; caps on grants are bounded below.
const DEFAULT_SEND_CAP: u128 = 100 * MILLI;
const DEFAULT_DAILY_CAP: u128 = 300 * MILLI;
const MAX_GRANT_DEPOSIT: u128 = NEAR;
const MAX_GRANTS: usize = 8;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Tong { identities: LookupMap<String, Identity>, owners: LookupMap<AccountId, String> }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Grant { pub contract: AccountId, pub methods: Vec<String>, pub max_deposit: U128, pub expires_at: U64 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Policy { pub grants: Vec<Grant>, pub send_cap: U128, pub daily_cap: U128, pub spent_today: U128, pub day: U64 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Identity { pub account_id: AccountId, pub name: String, pub nonce: U64, pub ready: bool, pub policy: Policy }

#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Request { pub domain: String, pub wallet: String, pub action: String, pub data: String, pub nonce: U64, pub deadline: U64 }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Link { name: String }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Note { note: String }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Call { contract: AccountId, method: String, args: String, deposit: U128 }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Send { to: AccountId, amount: U128 }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct GrantRequest { contract: AccountId, methods: Vec<String>, max_deposit: U128, days: u32 }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Revoke { contract: AccountId }
#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Transfer { to: String, value_wei: U64, nonce: U64, gas_price_wei: U64 }

#[near]
impl Tong {
    #[init]
    pub fn new() -> Self {
        require!(env::current_account_id().as_str().len() <= 30, "factory name too long");
        require!(env::predecessor_account_id() == env::current_account_id(), "self initialization only");
        Self { identities: LookupMap::new(b"i"), owners: LookupMap::new(b"o") }
    }
    pub fn get_config(&self) -> serde_json::Value {
        json!({"version":"2","network":"testnet","domain":self.domain(),"mpc_contract":"v1.signer-prod.testnet","path":"tong:sepolia:11155111",
            "allowed_actions":ACTIONS,"max_expiry_seconds":300,"link_deposit":U128(LINK_DEPOSIT),"account_funding":U128(ACCOUNT_FUNDING),"mpc_deposit":U128(MPC_FEE),
            "defaults":default_policy(0),"max_grant_deposit":U128(MAX_GRANT_DEPOSIT),"max_grants":MAX_GRANTS,"sepolia_max_wei":"1000000000000000"})
    }
    pub fn get_identity(&self, wallet: String) -> Option<Identity> { self.identities.get(&wallet) }
    pub fn owner_of(&self, account_id: AccountId) -> Option<String> { self.owners.get(&account_id) }
    pub fn account_for(&self, name: String) -> AccountId { validate_name(&name); self.child(&name) }
    pub fn name_available(&self, name: String) -> bool { validate_name(&name); self.owners.get(&self.child(&name)).is_none() }

    #[payable]
    pub fn execute(&mut self, request: Request, signature: String) -> Promise {
        require!(request.domain == self.domain(), "wrong domain");
        let now = env::block_timestamp_ms() / 1000;
        require!(request.deadline.0 >= now && request.deadline.0 <= now + 300, "expired or excessive deadline");
        require!(request.data.len() <= 1024, "data too large");
        require!(ACTIONS.contains(&request.action.as_str()), "disallowed action");
        validate_wallet(&request.wallet);
        self.verify(&request, &signature);
        let existing = self.identities.get(&request.wallet);
        let expected = existing.as_ref().map(|x| x.nonce.0).unwrap_or(0);
        require!(request.nonce.0 == expected, "wrong nonce or replay");
        let next = expected.checked_add(1).expect("nonce exhausted");
        let deposit = env::attached_deposit().as_yoctonear();
        let mut detail = json!({});
        let (account_id, promise) = if request.action == "link" {
            require!(existing.is_none(), "already linked");
            let link: Link = serde_json::from_str(&request.data).expect("link data must be {\"name\":...}");
            validate_name(&link.name);
            let account_id = self.child(&link.name);
            require!(self.owners.get(&account_id).is_none(), "name taken");
            require!(deposit == LINK_DEPOSIT, "link requires 1.9 NEAR");
            self.owners.insert(&account_id, &request.wallet);
            self.identities.insert(&request.wallet, &Identity { account_id: account_id.clone(), name: link.name.clone(), nonce: U64(next), ready: false, policy: default_policy(now) });
            detail = json!({"name": link.name});
            let p = Promise::new(account_id.clone()).create_account()
                .transfer(NearToken::from_yoctonear(ACCOUNT_FUNDING)).deploy_contract(ACCOUNT_WASM.to_vec())
                .function_call("new", json!({"controller": env::current_account_id()}).to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(10))
                .then(self.callback("on_link", json!({"wallet": request.wallet})));
            (account_id, p)
        } else {
            let mut id = existing.expect("link wallet first");
            require!(id.ready, "account not ready");
            let child = id.account_id.clone();
            roll_day(&mut id.policy);
            let p = match request.action.as_str() {
                "set_note" => {
                    require!(deposit == 0, "note takes no deposit");
                    let note: Note = serde_json::from_str(&request.data).expect("invalid note data");
                    require!(note.note.len() <= 256, "note too long");
                    Promise::new(child.clone()).function_call("set_note", json!({"note": note.note}).to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(15))
                }
                "call" => {
                    require!(deposit == 0, "app deposits come from your account, not the relayer");
                    let c: Call = serde_json::from_str(&request.data).expect("invalid call data");
                    require!(c.args.len() <= 512, "args too large");
                    require!(c.contract != env::current_account_id() && c.contract != child, "cannot call Tong itself");
                    let grant = id.policy.grants.iter().find(|g| g.contract == c.contract)
                        .unwrap_or_else(|| env::panic_str(&format!("policy: no permission for {}", c.contract)));
                    require!(grant.expires_at.0 > now, &format!("policy: permission for {} expired", c.contract));
                    require!(grant.methods.iter().any(|m| *m == c.method), &format!("policy: {} is not an allowed method on {}", c.method, c.contract));
                    require!(c.deposit.0 <= grant.max_deposit.0, &format!("policy: {} is over the {} per-call limit for {}", near(c.deposit.0), near(grant.max_deposit.0), c.contract));
                    spend(&mut id.policy, c.deposit.0);
                    detail = json!({"contract": c.contract, "method": c.method, "deposit": c.deposit});
                    let p = Promise::new(child.clone()).function_call("call_app", json!({"receiver": c.contract, "method": c.method, "args": c.args, "deposit": c.deposit}).to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(90));
                    p.then(self.callback("on_spend", json!({"wallet": request.wallet, "amount": c.deposit, "day": id.policy.day})))
                }
                "send_near" => {
                    require!(deposit == 0, "transfers come from your account, not the relayer");
                    let s: Send = serde_json::from_str(&request.data).expect("invalid send data");
                    require!(s.amount.0 > 0, "amount must be positive");
                    require!(s.amount.0 <= id.policy.send_cap.0, &format!("policy: {} is over the {} per-transfer limit", near(s.amount.0), near(id.policy.send_cap.0)));
                    spend(&mut id.policy, s.amount.0);
                    detail = json!({"to": s.to, "amount": s.amount});
                    let p = Promise::new(child.clone()).function_call("send_near", json!({"to": s.to, "amount": s.amount}).to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(20));
                    p.then(self.callback("on_spend", json!({"wallet": request.wallet, "amount": s.amount, "day": id.policy.day})))
                }
                "grant" => {
                    require!(deposit == 0, "grant takes no deposit");
                    let g: GrantRequest = serde_json::from_str(&request.data).expect("invalid grant data");
                    require!(g.contract != env::current_account_id() && g.contract != child && !g.contract.as_str().ends_with(&format!(".{}", env::current_account_id())), "cannot grant Tong accounts");
                    require!(!g.methods.is_empty() && g.methods.len() <= 4, "1 to 4 methods");
                    require!(g.methods.iter().all(|m| valid_method(m)), "invalid method name");
                    require!(g.max_deposit.0 <= MAX_GRANT_DEPOSIT, "grant deposit cap is at most 1 NEAR");
                    require!(g.days >= 1 && g.days <= 30, "grants last 1 to 30 days");
                    id.policy.grants.retain(|x| x.contract != g.contract);
                    require!(id.policy.grants.len() < MAX_GRANTS, "too many grants");
                    let grant = Grant { contract: g.contract.clone(), methods: g.methods.clone(), max_deposit: g.max_deposit, expires_at: U64(now + g.days as u64 * 86_400) };
                    detail = json!({"grant": grant});
                    id.policy.grants.push(grant);
                    Promise::new(child.clone()).function_call("get_state", vec![], NearToken::from_yoctonear(0), Gas::from_tgas(5))
                }
                "revoke" => {
                    require!(deposit == 0, "revoke takes no deposit");
                    let r: Revoke = serde_json::from_str(&request.data).expect("invalid revoke data");
                    let before = id.policy.grants.len();
                    id.policy.grants.retain(|x| x.contract != r.contract);
                    require!(id.policy.grants.len() < before, "no such permission");
                    detail = json!({"revoked": r.contract});
                    Promise::new(child.clone()).function_call("get_state", vec![], NearToken::from_yoctonear(0), Gas::from_tgas(5))
                }
                _ => {
                    require!(deposit == MPC_FEE, "MPC fee must be 0.01 NEAR");
                    let t: Transfer = serde_json::from_str(&request.data).expect("invalid transfer data");
                    require!(t.to.len() == 42 && t.to.starts_with("0x") && hex::decode(&t.to[2..]).is_ok(), "invalid recipient");
                    require!(t.value_wei.0 <= 1_000_000_000_000_000, "policy: transfer exceeds 0.001 ETH");
                    require!(t.gas_price_wei.0 > 0 && t.gas_price_wei.0 <= 100_000_000_000, "policy: gas price exceeds 100 gwei");
                    Promise::new(child.clone()).function_call("sign_sepolia", json!({"transfer": t}).to_string().into_bytes(), NearToken::from_yoctonear(MPC_FEE), Gas::from_tgas(220))
                }
            };
            id.nonce = U64(next);
            self.identities.insert(&request.wallet, &id);
            (child, p)
        };
        env::log_str(&json!({"standard":"tong","version":"2.0.0","event":"authorized","data":[{"wallet":request.wallet,"account_id":account_id,"nonce":request.nonce,"action":request.action,"detail":detail}]}).to_string());
        promise
    }
    #[private]
    pub fn on_link(&mut self, wallet: String) -> serde_json::Value {
        let mut identity = self.identities.get(&wallet).expect("missing pending identity");
        if env::promise_result_checked(0, 1024).is_ok() {
            identity.ready = true;
            self.identities.insert(&wallet, &identity);
            json!({"ok":true,"account_id":identity.account_id,"name":identity.name,"nonce":identity.nonce})
        } else {
            // Free the name and the wallet so a new signed link can retry; the old signature's
            // deadline still bounds any replay to the same wallet and name.
            self.owners.remove(&identity.account_id);
            self.identities.remove(&wallet);
            json!({"ok":false,"account_id":identity.account_id,"error":"account creation failed; inspect receipts"})
        }
    }
    #[private]
    pub fn on_spend(&mut self, wallet: String, amount: U128, day: U64) -> serde_json::Value {
        let ok = env::promise_result_checked(0, 4096).is_ok();
        if !ok {
            // The app call or transfer failed downstream: give the amount back to today's allowance.
            if let Some(mut id) = self.identities.get(&wallet) {
                if id.policy.day == day { id.policy.spent_today = U128(id.policy.spent_today.0.saturating_sub(amount.0)); self.identities.insert(&wallet, &id); }
            }
        }
        json!({"ok": ok})
    }
}
impl Tong {
    fn domain(&self) -> String { format!("near:testnet:{}", env::current_account_id()) }
    fn child(&self, name: &str) -> AccountId { format!("{}.{}", name, env::current_account_id()).parse().unwrap() }
    fn callback(&self, method: &str, args: serde_json::Value) -> Promise {
        Promise::new(env::current_account_id()).function_call(method, args.to_string().into_bytes(), NearToken::from_yoctonear(0), Gas::from_tgas(15))
    }
    fn verify(&self, r: &Request, signature: &str) {
        let sig = hex::decode(signature.strip_prefix("0x").unwrap_or(signature)).expect("invalid signature hex");
        if r.wallet.starts_with("evm:") {
            require!(sig.len() == 65, "EVM signature length");
            let v = match sig[64] { 0 | 1 => sig[64], 27 | 28 => sig[64] - 27, _ => env::panic_str("invalid recovery id") };
            let recovered = env::ecrecover(&typed_hash(r), &sig[..64], v, true).expect("invalid EVM signature");
            let h = env::keccak256(&recovered);
            require!(hex::encode(&h[12..]) == r.wallet[6..], "wrong EVM signer");
        } else {
            let pk: [u8; 32] = hex::decode(&r.wallet[7..]).unwrap().try_into().unwrap();
            let signature: [u8; 64] = sig.try_into().expect("ed25519 signature length");
            let message = format!("Tong request v1\n{}\n{}\n{}\n{}\n{}\n{}", r.domain, r.wallet, r.action, hex::encode(env::keccak256(r.data.as_bytes())), r.nonce.0, r.deadline.0);
            require!(env::ed25519_verify(&signature, message.as_bytes(), &pk), "wrong ed25519 signer");
        }
    }
}
fn default_policy(now: u64) -> Policy {
    Policy {
        grants: vec![Grant { contract: "wrap.testnet".parse().unwrap(), methods: vec!["near_deposit".into(), "near_withdraw".into()], max_deposit: U128(200 * MILLI), expires_at: U64(now + 30 * 86_400) }],
        send_cap: U128(DEFAULT_SEND_CAP), daily_cap: U128(DEFAULT_DAILY_CAP), spent_today: U128(0), day: U64(env::block_timestamp() / DAY_NS),
    }
}
fn roll_day(p: &mut Policy) {
    let today = env::block_timestamp() / DAY_NS;
    if p.day.0 != today { p.day = U64(today); p.spent_today = U128(0); }
}
fn spend(p: &mut Policy, amount: u128) {
    let total = p.spent_today.0.checked_add(amount).expect("overflow");
    require!(total <= p.daily_cap.0, &format!("policy: {} would pass today's {} limit ({} used)", near(amount), near(p.daily_cap.0), near(p.spent_today.0)));
    p.spent_today = U128(total);
}
fn near(yocto: u128) -> String {
    let whole = yocto / NEAR;
    let frac = format!("{:024}", yocto % NEAR);
    let frac = frac[..4].trim_end_matches('0');
    if frac.is_empty() { format!("{} NEAR", whole) } else { format!("{}.{} NEAR", whole, frac) }
}
fn valid_method(m: &str) -> bool { !m.is_empty() && m.len() <= 64 && m.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_') }
fn validate_name(name: &str) {
    require!(name.len() >= 2 && name.len() <= 32, "name must be 2 to 32 characters");
    let b = name.as_bytes();
    require!(b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-' || *c == b'_'), "name: lowercase letters, digits, - and _ only");
    require!(b[0].is_ascii_alphanumeric() && b[b.len() - 1].is_ascii_alphanumeric(), "name must start and end with a letter or digit");
    require!(!name.contains("--") && !name.contains("__") && !name.contains("-_") && !name.contains("_-"), "name: no repeated separators");
}
fn validate_wallet(wallet: &str) {
    let body = if wallet.starts_with("evm:0x") && wallet.len() == 46 { &wallet[6..] }
        else if wallet.starts_with("solana:") && wallet.len() == 71 { &wallet[7..] }
        else { env::panic_str("invalid wallet") };
    require!(body.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)), "wallet must be canonical lowercase hex");
}
fn word(n: u64) -> Vec<u8> { let mut w = vec![0; 24]; w.extend(n.to_be_bytes()); w }
fn typed_hash(r: &Request) -> Vec<u8> {
    let mut d = env::keccak256(b"EIP712Domain(string name,string version,bytes32 salt)");
    d.extend(env::keccak256(b"Tong")); d.extend(env::keccak256(b"1")); d.extend(env::keccak256(r.domain.as_bytes()));
    let mut m = env::keccak256(b"TongRequest(string domain,string wallet,string action,string data,uint64 nonce,uint64 deadline)");
    for s in [&r.domain, &r.wallet, &r.action, &r.data] { m.extend(env::keccak256(s.as_bytes())); }
    m.extend(word(r.nonce.0)); m.extend(word(r.deadline.0));
    let mut h = vec![0x19, 0x01]; h.extend(env::keccak256(&d)); h.extend(env::keccak256(&m)); env::keccak256(&h)
}
