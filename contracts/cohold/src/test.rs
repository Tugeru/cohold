#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, vec, Address, Env, String, Vec,
};

const NAME: &str = "Test Treasury";

fn deploy<'a>(env: &'a Env) -> (Address, CoholdContractClient<'a>) {
    let contract_id = env.register(CoholdContract, ());
    let client = CoholdContractClient::new(env, &contract_id);
    (contract_id, client)
}

fn member_list(
    env: &Env,
    creator: &Address,
    member_a: &Address,
    member_b: &Address,
) -> Vec<Address> {
    vec![env, creator.clone(), member_a.clone(), member_b.clone()]
}

#[test]
fn smoke_initialize_stores_treasury_state() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let member_b = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = member_list(&env, &creator, &member_a, &member_b);

    let (_, client) = deploy(&env);
    client.initialize(
        &creator,
        &token,
        &members,
        &2u32,
        &String::from_str(&env, NAME),
    );

    let config = client.get_config();
    assert_eq!(config.creator, creator);
    assert_eq!(config.token, token);
    assert_eq!(config.threshold, 2);
    assert_eq!(config.member_count, 3);
    assert_eq!(config.name, String::from_str(&env, NAME));

    assert!(client.is_member(&member_a));
    assert!(!client.is_member(&Address::generate(&env)));

    let stored_members = client.get_members();
    assert_eq!(stored_members.len(), 3);
    assert_eq!(stored_members, members);

    assert_eq!(client.get_proposal_count(), 0);
    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_contribution_total(&member_a), 0);
    assert_eq!(client.get_contribution_total(&Address::generate(&env)), 0);
}

#[test]
fn initialize_rejects_invalid_inputs() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let name = String::from_str(&env, NAME);

    let (_, client) = deploy(&env);

    // Duplicate members
    let dup = vec![&env, creator.clone(), member_a.clone(), member_a.clone()];
    assert_eq!(
        client.try_initialize(&creator, &token, &dup, &2u32, &name),
        Err(Ok(CoholdError::DuplicateMember))
    );

    // Empty members
    let empty = Vec::new(&env);
    assert_eq!(
        client.try_initialize(&creator, &token, &empty, &2u32, &name),
        Err(Ok(CoholdError::EmptyMembers))
    );

    // Threshold zero / above member count
    let members = vec![&env, creator.clone(), member_a.clone()];
    assert_eq!(
        client.try_initialize(&creator, &token, &members, &0u32, &name),
        Err(Ok(CoholdError::InvalidThreshold))
    );
    assert_eq!(
        client.try_initialize(&creator, &token, &members, &3u32, &name),
        Err(Ok(CoholdError::InvalidThreshold))
    );

    // Creator not a member
    let outsider = vec![&env, member_a.clone()];
    assert_eq!(
        client.try_initialize(&creator, &token, &outsider, &1u32, &name),
        Err(Ok(CoholdError::NotMember))
    );

    // Re-initialize on an already-initialized treasury
    let members = vec![&env, creator.clone(), member_a.clone()];
    client.initialize(&creator, &token, &members, &1u32, &name);
    assert_eq!(
        client.try_initialize(&creator, &token, &members, &1u32, &name),
        Err(Ok(CoholdError::AlreadyInitialized))
    );
}

#[test]
fn getters_reflect_contributions_and_proposals() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let member_b = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = member_list(&env, &creator, &member_a, &member_b);

    let (_, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &2u32, &String::from_str(&env, NAME));

    let token_client = StellarAssetClient::new(&env, &token);
    token_client.mint(&member_a, &1000i128);
    token_client.mint(&member_b, &500i128);

    // Contribute: member totals and treasury balance move together
    client.contribute(&member_a, &400i128);
    assert_eq!(client.get_balance(), 400);
    assert_eq!(client.get_contribution_total(&member_a), 400);
    client.contribute(&member_a, &100i128);
    client.contribute(&member_b, &500i128);
    assert_eq!(client.get_balance(), 1000);
    assert_eq!(client.get_contribution_total(&member_a), 500);
    assert_eq!(client.get_contribution_total(&member_b), 500);

    // Creator proposal is approval #1 and stays Pending under threshold 2
    let proposal_id = client.create_proposal(
        &creator,
        &recipient,
        &300i128,
        &String::from_str(&env, "Pay the plumber"),
    );
    assert_eq!(proposal_id, 1);
    assert_eq!(client.get_proposal_count(), 1);

    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.recipient, recipient);
    assert_eq!(proposal.amount, 300);
    assert_eq!(proposal.approval_count, 1);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert!(client.has_approved(&proposal_id, &creator));
    assert!(!client.has_approved(&proposal_id, &member_b));
    assert_eq!(client.get_members().len(), 3);

    // Creator's own duplicate approval rejected while still Pending
    assert_eq!(
        client.try_approve(&creator, &proposal_id),
        Err(Ok(CoholdError::AlreadyApproved))
    );

    // Second approval crosses the threshold
    client.approve(&member_b, &proposal_id);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.status, ProposalStatus::Approved);
    assert_eq!(proposal.approval_count, 2);

    // Approving an already-approved proposal is rejected; non-member cannot approve
    assert_eq!(
        client.try_approve(&member_b, &proposal_id),
        Err(Ok(CoholdError::ProposalNotPending))
    );
    assert_eq!(
        client.try_approve(&Address::generate(&env), &proposal_id),
        Err(Ok(CoholdError::NotMember))
    );

    // Execute pays the recipient and is one-shot
    client.execute(&Address::generate(&env), &proposal_id);
    assert_eq!(client.get_balance(), 700);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.status, ProposalStatus::Executed);
    assert_eq!(
        client.try_execute(&member_a, &proposal_id),
        Err(Ok(CoholdError::AlreadyExecuted))
    );

    // Proposal count only counts creations
    assert_eq!(client.get_proposal_count(), 1);
}

#[test]
fn execute_rejects_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone()];

    let (_, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &1u32, &String::from_str(&env, NAME));

    // Threshold 1: the proposal is Approved at creation, but the treasury is empty.
    let proposal_id = client.create_proposal(
        &creator,
        &recipient,
        &500i128,
        &String::from_str(&env, "Overdraft"),
    );
    assert_eq!(proposal_id, 1);
    assert_eq!(
        client.try_execute(&creator, &proposal_id),
        Err(Ok(CoholdError::InsufficientBalance))
    );

    // The failed execution changes nothing: balance stays zero and the
    // proposal remains Approved so it can still run once funded.
    assert_eq!(client.get_balance(), 0);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.status, ProposalStatus::Approved);
}

#[test]
fn treasuries_do_not_share_balances() {
    let env = Env::default();
    env.mock_all_auths();
    let creator_a = Address::generate(&env);
    let member_a = Address::generate(&env);
    let creator_b = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator_a.clone()).address();
    let token_client = StellarAssetClient::new(&env, &token);
    token_client.mint(&member_a, &1000i128);

    let (_, client_a) = deploy(&env);
    client_a.initialize(
        &creator_a,
        &token,
        &vec![&env, creator_a.clone(), member_a.clone()],
        &1u32,
        &String::from_str(&env, "Treasury A"),
    );
    let (_, client_b) = deploy(&env);
    client_b.initialize(
        &creator_b,
        &token,
        &vec![&env, creator_b.clone()],
        &1u32,
        &String::from_str(&env, "Treasury B"),
    );

    // Contribution to A never appears in B's balance.
    client_a.contribute(&member_a, &400i128);
    assert_eq!(client_a.get_balance(), 400);
    assert_eq!(client_b.get_balance(), 0);

    // Proposal counters are per-treasury as well.
    let pid_a = client_a.create_proposal(
        &creator_a,
        &Address::generate(&env),
        &100i128,
        &String::from_str(&env, "A spends"),
    );
    let pid_b = client_b.create_proposal(
        &creator_b,
        &Address::generate(&env),
        &100i128,
        &String::from_str(&env, "B spends"),
    );
    assert_eq!(pid_a, 1);
    assert_eq!(pid_b, 1);
    assert_eq!(client_a.get_proposal_count(), 1);
    assert_eq!(client_b.get_proposal_count(), 1);
    assert_eq!(client_a.get_proposal(&pid_a).amount, 100);
    assert_eq!(client_b.get_proposal(&pid_b).amount, 100);
}