use constants::{KEY_VERSION, MPC_CONTRACT_ACCOUNT_ID, MPC_PATH, ONE_DAY};
use near_sdk::{env, ext_contract, near, store::LookupMap, Gas, Promise, require};
use near_sdk::store::LookupSet;

mod constants;

const chains: [&str; 4] = ["ETHEREUM", "BITCOIN", "DOGECOIN", "RIPPLE"];
#[ext_contract(mpc)]
trait MPC {
    fn sign(&self, payload: [u8; 32], path: String, key_version: u32) -> Promise;
}

#[near(contract_state)]
pub struct Contract {
    requests: LookupMap<String, LookupMap<String, u64>>,
    supported_chains: LookupSet<String>,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            requests: LookupMap::new(b"chains".to_vec()),
            supported_chains: LookupSet::new(b"supported_chains".to_vec()),
        }
    }
}

#[near]
impl Contract {
    #[init]
    #[private] // only callable by the contract's account
    pub fn init(end_time: u64) -> Self {
        let mut supported_chains = LookupSet::new(b"supported_chains".to_vec());
        for chain in chains {
            supported_chains.insert(chain);
        }

        Self {
            requests: LookupMap::new(b"chains"),
            supported_chains,
        }
    }

    pub fn add_chain(&mut self, chain: &str) {
        let owner = env::predecessor_account_id() == env::current_account_id();
        if !owner {
            panic!("Only the owner can add a new chain");
        }

        let normalized_chain = String::from(chain.to_uppercase());
        let chain_supported = self.supported_chains.contains(&normalized_chain);
        if !chain_supported {
            self.supported_chains.insert(&*normalized_chain);
        } else {
            panic!("Chain {} already included", normalized_chain);
        }
    }

    pub fn request_tokens(&mut self, chain: &str, rlp_payload: [u8; 32]) -> Promise {
        let requestor = String::from(env::current_account_id().as_str());
        let current_time = env::block_timestamp();

        match self.requests.get(&requestor) {
            None => {
                let mut lookup_map = LookupMap::new(requestor.clone().into_bytes());
                lookup_map.insert(String::from(chain), current_time);
                self.requests.insert(requestor, lookup_map);
            }
            Some(&requests) => {
                let chain_str = String::from(chain);
                // check if the recipient has requested tokens in the last 24 hours
                match requests.get(chain) {
                    None => {
                        requests.insert(chain_str, current_time);
                    }
                    Some(&last_request) => {
                        if current_time < last_request + ONE_DAY {
                            panic!("Signature for this payload already requested within the last 24 hours",);
                        } else {
                            requests.insert(chain_str, current_time);
                        }
                    }
                }
            }
        }

        mpc::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
            .with_static_gas(Gas::from_tgas(100))
            .sign(rlp_payload, String::from(MPC_PATH), KEY_VERSION)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env, AccountId, NearToken};

    // Helper function to setup the testing environment
    fn get_context(
        predecessor_account_id: AccountId,
        current_account_id: AccountId,
        block_timestamp: u64,
    ) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor_account_id)
            .current_account_id(current_account_id)
            .block_timestamp(block_timestamp)
            .attached_deposit(NearToken::from_yoctonear(0)); // Simulate a small deposit
        builder
    }

    #[test]
    fn test_request_tokens_as_owner() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner_account_id.clone(), owner_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let rlp_payload = [0u8; 32];

        // Call the request_tokens method as the owner
        contract.request_tokens(rlp_payload);

        assert!(contract.requests.get(&rlp_payload).is_some());
    }

    #[test]
    #[should_panic(expected = "Only the owner can request tokens")]
    fn test_request_tokens_not_as_owner() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let not_owner_account_id: AccountId = "not_owner.near".parse().unwrap();
        let context = get_context(not_owner_account_id, owner_account_id, 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let rlp_payload = [0u8; 32];

        // Call the request_tokens method as a non-owner
        contract.request_tokens(rlp_payload);
    }

    #[test]
    #[should_panic(
        expected = "Signature for this payload already requested within the last 24 hours"
    )]
    fn test_request_tokens_within_24_hours() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner_account_id.clone(), owner_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let rlp_payload = [0u8; 32];

        // First request
        contract.request_tokens(rlp_payload);
        assert!(contract.requests.get(&rlp_payload).is_some());

        // Advance time by less than 24 hours and try to request again
        let context = get_context(
            owner_account_id.clone(),
            owner_account_id.clone(),
            ONE_DAY - 1,
        );
        testing_env!(context.build());

        // Second request should fail
        contract.request_tokens(rlp_payload);
    }
}