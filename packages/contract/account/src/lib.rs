use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, serde_json::json, json_types::U64};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TongAccount { controller: AccountId, note: String }

#[near(serializers = [json])]
#[serde(deny_unknown_fields)]
pub struct Transfer { pub to: String, pub value_wei: U64, pub nonce: U64, pub gas_price_wei: U64 }

#[near]
impl TongAccount {
    #[init]
    pub fn new(controller: AccountId) -> Self {
        require!(env::predecessor_account_id() == controller, "controller must initialize");
        Self { controller, note: String::new() }
    }
    pub fn get_state(&self) -> near_sdk::serde_json::Value {
        json!({"controller":self.controller,"note":self.note,"chain_id":11155111,"path":"tong:sepolia:11155111"})
    }
    pub fn set_note(&mut self, note: String) -> near_sdk::serde_json::Value {
        self.authorize();
        require!(note.len() <= 256, "note too long");
        self.note = note;
        json!({"ok":true,"account_id":env::current_account_id(),"note":self.note})
    }
    #[payable]
    pub fn sign_sepolia(&mut self, transfer: Transfer) -> Promise {
        self.authorize();
        require!(env::attached_deposit() == NearToken::from_millinear(10), "MPC fee must be 0.01 NEAR");
        let hash = payload(&transfer);
        // The child, not the factory/relayer, is the MPC predecessor and owns this derived key.
        Promise::new("v1.signer-prod.testnet".parse().unwrap()).function_call(
            "sign",
            json!({"request":{"payload":hash,"path":"tong:sepolia:11155111","domain_id":0}}).to_string().into_bytes(),
            env::attached_deposit(), Gas::from_tgas(180))
    }
}
impl TongAccount {
    fn authorize(&self) { require!(env::predecessor_account_id() == self.controller, "controller only"); }
}
fn rlp_bytes(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() == 1 && bytes[0] < 128 { return bytes.to_vec(); }
    let mut r = vec![128 + bytes.len() as u8]; r.extend(bytes); r
}
fn number(n: u64) -> Vec<u8> {
    let b = n.to_be_bytes(); let i = b.iter().position(|x| *x != 0).unwrap_or(8); rlp_bytes(&b[i..])
}
fn payload(t: &Transfer) -> Vec<u8> {
    require!(t.to.len() == 42 && t.to.starts_with("0x"), "invalid recipient");
    let to = hex::decode(&t.to[2..]).expect("invalid recipient hex");
    require!(to.len() == 20, "invalid recipient length");
    require!(t.value_wei.0 <= 1_000_000_000_000_000, "transfer exceeds 0.001 ETH");
    require!(t.gas_price_wei.0 > 0 && t.gas_price_wei.0 <= 100_000_000_000, "gas price exceeds 100 gwei");
    let mut fields = Vec::new();
    for item in [number(t.nonce.0), number(t.gas_price_wei.0), number(21_000), rlp_bytes(&to), number(t.value_wei.0), number(0), number(11_155_111), number(0), number(0)] { fields.extend(item); }
    let mut rlp = if fields.len() <= 55 { vec![192 + fields.len() as u8] } else { vec![248, fields.len() as u8] };
    rlp.extend(fields); env::keccak256(&rlp)
}
