#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    vec,
    Address, Bytes, ConversionError, Env, IntoVal, InvokeError, String, Symbol, Vec,
};

const COHOLD_WASM: &[u8] = include_bytes!("../../../public/cohold.wasm");

fn deploy_factory(env: &Env) -> (Address, crate::CoholdFactoryClient) {
    let id = env.register(CoholdFactory, ());
    let client = crate::CoholdFactoryClient::new(env, &id);
    (id, client)
}

fn cohold_wasm_hash(env: &Env) -> BytesN<32> {
    env.deployer()
        .upload_contract_wasm(Bytes::from_slice(env, COHOLD_WASM))
}

// The generated client unwraps contract Results, so error paths must be
// exercised through the raw env call. Contract errors surface as
// `InvokeError::Contract(code)` in the outer arm's Ok position.
fn try_create(
    env: &Env,
    factory_id: &Address,
    wasm_hash: &BytesN<32>,
    creator: &Address,
    token: &Address,
    members: Vec<Address>,
    threshold: u32,
    name: &String,
) -> Result<Result<Address, ConversionError>, Result<InvokeError, InvokeError>> {
    env.try_invoke_contract::<Address, InvokeError>(
        factory_id,
        &Symbol::new(env, "create"),
        (
            wasm_hash.clone(),
            creator.clone(),
            token.clone(),
            members,
            threshold,
            name.clone(),
        )
            .into_val(env),
    )
}

fn expect_error_code(
    result: Result<Result<Address, ConversionError>, Result<InvokeError, InvokeError>>,
    expected: FactoryError,
) {
    match result {
        Err(Ok(InvokeError::Contract(code))) => {
            assert_eq!(code, expected as u32)
        }
        other => panic!("expected {expected:?}, got {other:?}"),
    }
}

#[test]
fn create_deploys_initializes_and_registers_the_instance() {
    let env = Env::default();
    env.mock_all_auths();
    let wasm_hash = cohold_wasm_hash(&env);
    let creator = Address::generate(&env);
    let member_b = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(creator.clone())
        .address();
    let members = vec![&env, creator.clone(), member_b.clone()];

    let (_, factory) = deploy_factory(&env);

    let instance = factory.create(
        &wasm_hash,
        &creator,
        &token,
        &members,
        &2u32,
        &String::from_str(&env, "Trip Fund"),
    );

    assert_eq!(factory.get_treasuries(), vec![&env, instance.clone()]);
    assert_eq!(factory.treasury_count(), 1);

    // The deployed instance is a fully initialized Cohold treasury.
    let treasury = cohold::CoholdContractClient::new(&env, &instance);
    let config = treasury.get_config();
    assert_eq!(config.creator, creator);
    assert_eq!(config.token, token);
    assert_eq!(config.threshold, 2);
    assert_eq!(config.member_count, 2);
    assert_eq!(config.name, String::from_str(&env, "Trip Fund"));
    assert!(treasury.is_member(&member_b));
    assert_eq!(treasury.get_proposal_count(), 0);
}

#[test]
fn create_keeps_a_unique_instance_per_call() {
    let env = Env::default();
    env.mock_all_auths();
    let wasm_hash = cohold_wasm_hash(&env);
    let creator = Address::generate(&env);
    let member_b = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(creator.clone())
        .address();
    let members = vec![&env, creator.clone(), member_b.clone()];

    let (_, factory) = deploy_factory(&env);
    let first = factory.create(
        &wasm_hash,
        &creator,
        &token,
        &members,
        &2u32,
        &String::from_str(&env, "Fund One"),
    );
    let second = factory.create(
        &wasm_hash,
        &creator,
        &token,
        &members,
        &2u32,
        &String::from_str(&env, "Fund Two"),
    );

    assert_ne!(first, second);
    assert_eq!(factory.get_treasuries(), vec![&env, first, second]);
    assert_eq!(factory.treasury_count(), 2);
}

#[test]
fn create_rejects_bad_inputs_before_deploying() {
    let env = Env::default();
    env.mock_all_auths();
    let wasm_hash = cohold_wasm_hash(&env);
    let creator = Address::generate(&env);
    let member_b = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(creator.clone())
        .address();
    let name = String::from_str(&env, "X");

    let (factory_id, factory) = deploy_factory(&env);

    // Empty member list.
    expect_error_code(
        try_create(
            &env,
            &factory_id,
            &wasm_hash,
            &creator,
            &token,
            Vec::new(&env),
            1,
            &name,
        ),
        FactoryError::EmptyMembers,
    );
    // Threshold out of range.
    expect_error_code(
        try_create(
            &env,
            &factory_id,
            &wasm_hash,
            &creator,
            &token,
            vec![&env, creator.clone()],
            0,
            &name,
        ),
        FactoryError::InvalidThreshold,
    );
    expect_error_code(
        try_create(
            &env,
            &factory_id,
            &wasm_hash,
            &creator,
            &token,
            vec![&env, creator.clone()],
            2,
            &name,
        ),
        FactoryError::InvalidThreshold,
    );
    // Creator absent from the member list.
    expect_error_code(
        try_create(
            &env,
            &factory_id,
            &wasm_hash,
            &creator,
            &token,
            vec![&env, member_b.clone()],
            1,
            &name,
        ),
        FactoryError::CreatorNotMember,
    );
    // Duplicate members.
    expect_error_code(
        try_create(
            &env,
            &factory_id,
            &wasm_hash,
            &creator,
            &token,
            vec![&env, creator.clone(), creator.clone()],
            1,
            &name,
        ),
        FactoryError::DuplicateMember,
    );

    assert_eq!(factory.treasury_count(), 0);
}

#[test]
fn create_requires_creator_authorization() {
    let env = Env::default();
    // No mock_all_auths: the caller has no authorization at all.
    let wasm_hash = cohold_wasm_hash(&env);
    let creator = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(creator.clone())
        .address();
    let name = String::from_str(&env, "X");

    let (factory_id, _) = deploy_factory(&env);

    // Missing auth surfaces as a call-level failure (not a FactoryError).
    let result = try_create(
        &env,
        &factory_id,
        &wasm_hash,
        &creator,
        &token,
        vec![&env, creator.clone()],
        1,
        &name,
    );
    assert!(result.is_err());
}