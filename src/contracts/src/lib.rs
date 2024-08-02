use constants::{KEY_VERSION, MPC_CONTRACT_ACCOUNT_ID, MPC_PATH, ONE_DAY};
use near_sdk::{env, ext_contract, near, store::LookupMap, Gas, Promise, require};
use near_sdk::store::LookupSet;

mod constants;

// TODO supported CHAINS should be gated on the frontend
const CHAINS: [&str; 4] = ["ETHEREUM", "BITCOIN", "DOGECOIN", "RIPPLE"];

#[ext_contract(mpc)]
trait MPC {
    fn sign(&self, payload: [u8; 32], path: String, key_version: u32) -> Promise;
}

#[near(contract_state)]
pub struct Contract {
    requests: LookupMap<String, LookupMap<String, u64>>,
    supported_chains: LookupSet<String>,
    limit: u64,
}

#[near]
impl Contract {
    #[init]
    #[private] // only callable by the contract's account
    pub fn init() -> Self {
        let mut supported_chains = LookupSet::new(b"supported_chains".to_vec());
        for chain in CHAINS {
            supported_chains.insert(String::from(chain));
        }

        Self {
            requests: LookupMap::new(b"chains".to_vec()),
            supported_chains,
            limit: ONE_DAY,
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
            self.supported_chains.insert(normalized_chain);
        } else {
            panic!("Chain {} already included", normalized_chain);
        }
    }

    pub fn update_limit(&mut self, limit: u64) {
        let owner = env::predecessor_account_id() == env::current_account_id();
        if !owner {
            panic!("Only the owner can add a new limit");
        }

        self.limit = limit;
    }

    pub fn request_tokens(&mut self, chain: &str) -> bool {
        let requestor = String::from(env::current_account_id().as_str());
        let current_time = env::block_timestamp();

        match self.requests.get_mut(&requestor) {
            None => {
                let mut lookup_map = LookupMap::new(requestor.clone().into_bytes());
                lookup_map.insert(String::from(chain), current_time);
                self.requests.insert(requestor, lookup_map);
                return true;
            }
            Some(requests) => {
                let chain_str = String::from(chain);
                // check if the recipient has requested tokens in the last 24 hours
                match requests.get(chain) {
                    None => {
                        requests.insert(chain_str, current_time);
                        return true;
                    }
                    Some(&last_request) => {
                        if current_time < last_request + self.limit {
                            return false;
                        } else {
                            requests.insert(chain_str, current_time);
                            return true;
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env, AccountId, NearToken};
    use near_sdk::borsh::BorshSerialize;

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
    fn test_request_tokens() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let user_account_id: AccountId = "user.near".parse().unwrap();
        let context = get_context(owner_account_id.clone(), user_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let test_chain = "BITCOIN";
        let test_account = String::from(user_account_id.as_str());

        assert!(contract.request_tokens(test_chain));
        assert!(contract.requests.get(&test_account).is_some());
        assert!(contract.requests.get(&test_account).unwrap().get(test_chain).is_some());
    }

    // test with same chain request - within a day + more than a day
    #[test]
    fn test_request_tokens_rate_limits() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let user_account_id: AccountId = "user.near".parse().unwrap();
        let mut context = get_context(owner_account_id.clone(), user_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let test_chain = "BITCOIN";
        let test_account = String::from(user_account_id.as_str());

        // make first request at timestamp 0
        assert!(contract.request_tokens(test_chain));

        // making request less than a day more doesn't work
        context.block_timestamp(ONE_DAY - 50);
        testing_env!(context.build());
        assert_eq!(contract.request_tokens(test_chain), false);

        // making request more than a day does work
        context.block_timestamp(ONE_DAY + 50);
        testing_env!(context.build());
        assert_eq!(contract.request_tokens(test_chain), true);
    }

    #[test]
    fn test_request_tokens_rate_limits_different_chains() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let user_account_id: AccountId = "user.near".parse().unwrap();
        let mut context = get_context(owner_account_id.clone(), user_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let test_chain = "BITCOIN";
        let test_chain_2 = "ETHEREUM";
        let test_account = String::from(user_account_id.as_str());

        // make first request at timestamp 0
        assert!(contract.request_tokens(test_chain));
        assert!(contract.request_tokens(test_chain_2));

        // making request more than a day does work
        context.block_timestamp(ONE_DAY + 50);
        testing_env!(context.build());
        assert_eq!(contract.request_tokens(test_chain), true);
        assert_eq!(contract.request_tokens(test_chain_2), true);
    }

    #[test]
    fn test_add_chain_as_owner() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner_account_id.clone(), owner_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let test_new_chain = "BITCOIN2";

        contract.add_chain(test_new_chain);

        // Call the request_tokens method as the owner
        assert!(contract.supported_chains.contains(test_new_chain));
    }

    #[test]
    #[should_panic(expected = "Only the owner can add a new chain")]
    fn test_add_chain_not_as_owner() {
        let owner_account_id: AccountId = "owner.near".parse().unwrap();
        let not_owner_account_id: AccountId = "not_owner.near".parse().unwrap();
        let context = get_context(owner_account_id.clone(), not_owner_account_id.clone(), 0);
        testing_env!(context.build());

        let mut contract = Contract::default();
        let test_new_chain = "BITCOIN2";

        contract.add_chain(test_new_chain);
    }

    // #[test]
    // #[should_panic(expected = "Only the owner can request tokens")]
    // fn test_request_tokens_not_as_owner() {
    //     let owner_account_id: AccountId = "owner.near".parse().unwrap();
    //     let not_owner_account_id: AccountId = "not_owner.near".parse().unwrap();
    //     let context = get_context(not_owner_account_id, owner_account_id, 0);
    //     testing_env!(context.build());
    //
    //     let mut contract = Contract::default();
    //     let rlp_payload = [0u8; 32];
    //
    //     // Call the request_tokens method as a non-owner
    //     contract.request_tokens(rlp_payload);
    // }

    // #[test]
    // #[should_panic(
    //     expected = "Signature for this payload already requested within the last 24 hours"
    // )]
    // fn test_request_tokens_within_24_hours() {
    //     let owner_account_id: AccountId = "owner.near".parse().unwrap();
    //     let context = get_context(owner_account_id.clone(), owner_account_id.clone(), 0);
    //     testing_env!(context.build());
    //
    //     let mut contract = Contract::default();
    //     let rlp_payload = [0u8; 32];
    //
    //     // First request
    //     contract.request_tokens(rlp_payload);
    //     assert!(contract.requests.get(&rlp_payload).is_some());
    //
    //     // Advance time by less than 24 hours and try to request again
    //     let context = get_context(
    //         owner_account_id.clone(),
    //         owner_account_id.clone(),
    //         ONE_DAY - 1,
    //     );
    //     testing_env!(context.build());
    //
    //     // Second request should fail
    //     contract.request_tokens(rlp_payload);
    // }
}