//! CoholdFactory — deploys and registers Cohold treasury instances.
//!
//! The app creates treasuries through this factory instead of deploying from
//! the wallet directly: the factory's instance list (`get_treasuries`) is
//! readable by every device, so a treasury created from one browser is
//! visible to the same wallet and other members on any other device. The
//! factory also makes creation atomic — instance deploy and member setup
//! happen in one contract call, so a failed creation leaves nothing behind.
//!
//! Instances are deployed from a caller-supplied Wasm hash with no
//! constructor (Cohold initializes via `initialize`), with a salt derived
//! from a per-factory counter, so addresses are deterministic but unique.

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN,
    ConversionError, Env, IntoVal, InvokeError, String, Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    EmptyMembers = 1,
    InvalidThreshold = 2,
    CreatorNotMember = 3,
    DuplicateMember = 4,
    InitializeFailed = 5,
}

#[contracttype]
enum DataKey {
    Treasuries,
    Count,
}

const TOPIC_CREATED: Symbol = symbol_short!("created");

#[contract]
pub struct CoholdFactory;

#[contractimpl]
impl CoholdFactory {
    /// Deploy a Cohold treasury instance from `wasm_hash`, initialize it with
    /// `creator`/`token`/`members`/`threshold`/`name`, and record it so every
    /// device can discover it. The creator must authorize and must be a
    /// member (the Cohold contract enforces the latter too).
    pub fn create(
        env: Env,
        wasm_hash: BytesN<32>,
        creator: Address,
        token: Address,
        members: Vec<Address>,
        threshold: u32,
        name: String,
    ) -> Result<Address, FactoryError> {
        creator.require_auth();

        if members.len() == 0 {
            return Err(FactoryError::EmptyMembers);
        }
        if threshold == 0 || threshold > members.len() {
            return Err(FactoryError::InvalidThreshold);
        }
        let mut has_creator = false;
        for i in 0..members.len() {
            if members.get(i).unwrap() == creator {
                has_creator = true;
            }
            for j in (i + 1)..members.len() {
                if members.get(i).unwrap() == members.get(j).unwrap() {
                    return Err(FactoryError::DuplicateMember);
                }
            }
        }
        if !has_creator {
            return Err(FactoryError::CreatorNotMember);
        }

        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let salt = env
            .crypto()
            .sha256(&Bytes::from_slice(&env, &count.to_le_bytes()));

        let instance = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        // Initialize the instance; if setup fails the whole call errors and
        // the deployed instance dies with it (atomic creation).
        let init_result: Result<
            Result<(), ConversionError>,
            Result<InvokeError, InvokeError>,
        > = env.try_invoke_contract::<(), InvokeError>(
            &instance,
            &Symbol::new(&env, "initialize"),
            (creator.clone(), token.clone(), members.clone(), threshold, name).into_val(&env),
        );
        match init_result {
            Ok(Ok(())) => {}
            _ => return Err(FactoryError::InitializeFailed),
        }

        let mut treasuries: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Treasuries)
            .unwrap_or(Vec::new(&env));
        treasuries.push_back(instance.clone());
        env.storage().instance().set(&DataKey::Treasuries, &treasuries);
        env.storage().instance().set(&DataKey::Count, &(count + 1));

        env.events().publish(
            (TOPIC_CREATED, symbol_short!("create")),
            (creator, instance.clone()),
        );

        Ok(instance)
    }

    /// Every treasury instance this factory has created, oldest first.
    pub fn get_treasuries(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Treasuries)
            .unwrap_or(Vec::new(&env))
    }

    pub fn treasury_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;