#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::StellarAssetClient, vec, Address, Env, IntoVal, String, Vec,
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

// ---- Actor authorization (real auth, not mock_all_auths) ----

#[test]
fn mutating_functions_require_actor_authorization() {
    // Deliberately NO mock_all_auths: every mutation below only succeeds when
    // the exact caller/invocation was authorized via mock_auths.
    let env = Env::default();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone(), member_a.clone()];
    let name = String::from_str(&env, NAME);
    let desc = String::from_str(&env, "Auth-gated spend");

    let (contract_id, client) = deploy(&env);

    // Only creator's initialize and create_proposal invocations are authorized.
    env.mock_auths(&[
        MockAuth {
            address: &creator,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (&creator, &token, &members, &2u32, &name).into_val(&env),
                sub_invokes: &[],
            },
        },
        MockAuth {
            address: &creator,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_proposal",
                args: (&creator, &recipient, &100i128, &desc).into_val(&env),
                sub_invokes: &[],
            },
        },
    ]);

    // Authorized calls succeed and record the auth entry.
    client.initialize(&creator, &token, &members, &2u32, &name);
    assert!(!env.auths().is_empty());
    let proposal_id = client.create_proposal(&creator, &recipient, &100i128, &desc);
    assert!(!env.auths().is_empty());

    // Same member, same arguments — but invocation not authorized: rejected.
    assert!(client.try_contribute(&member_a, &100i128).is_err());
    assert!(
        client
            .try_create_proposal(
                &member_a,
                &recipient,
                &100i128,
                &String::from_str(&env, "Not authorized"),
            )
            .is_err()
    );
    assert!(client.try_approve(&member_a, &proposal_id).is_err());

    // Nothing was written by the rejected calls.
    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_contribution_total(&member_a), 0);
    assert_eq!(client.get_proposal_count(), 1);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert_eq!(proposal.approval_count, 1);
}

// ---- Contribute: membership, amounts, and atomicity ----

#[test]
fn contribute_and_proposal_creation_reject_non_members_and_zero_amounts() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let outsider = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone(), member_a.clone()];

    let (_, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &2u32, &String::from_str(&env, NAME));

    // Non-member cannot contribute or propose, even with valid auth.
    assert_eq!(
        client.try_contribute(&outsider, &100i128),
        Err(Ok(CoholdError::NotMember))
    );
    assert_eq!(
        client.try_create_proposal(
            &outsider,
            &recipient,
            &100i128,
            &String::from_str(&env, "Sneaky"),
        ),
        Err(Ok(CoholdError::NotMember))
    );

    // Zero and negative contribute amounts are rejected before any transfer.
    assert_eq!(
        client.try_contribute(&creator, &0i128),
        Err(Ok(CoholdError::ZeroAmount))
    );
    assert_eq!(
        client.try_contribute(&creator, &-1i128),
        Err(Ok(CoholdError::ZeroAmount))
    );

    // Zero proposal amounts are rejected too.
    assert_eq!(
        client.try_create_proposal(
            &creator,
            &recipient,
            &0i128,
            &String::from_str(&env, "Free money"),
        ),
        Err(Ok(CoholdError::ZeroAmount))
    );

    // Non-member cannot approve.
    let proposal_id = client.create_proposal(
        &creator,
        &recipient,
        &100i128,
        &String::from_str(&env, "Legit"),
    );
    assert_eq!(
        client.try_approve(&outsider, &proposal_id),
        Err(Ok(CoholdError::NotMember))
    );

    // Nothing was written by any rejected call.
    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_proposal_count(), 1);
}

#[test]
fn failed_contribute_transfer_leaves_state_unchanged() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone(), member_a.clone()];
    let token_client = StellarAssetClient::new(&env, &token);

    let (contract_id, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &2u32, &String::from_str(&env, NAME));

    // First failure: member has no tokens at all. The SAC transfer traps and
    // the whole call fails without touching treasury bookkeeping.
    let contract = contract_id;
    assert!(client.try_contribute(&member_a, &100i128).is_err());
    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_contribution_total(&member_a), 0);
    assert_eq!(token_client.balance(&contract), 0);

    // Second failure: overdraft after a real contribution. Prior state stands.
    token_client.mint(&member_a, &100i128);
    client.contribute(&member_a, &100i128);
    assert_eq!(client.get_balance(), 100);
    assert_eq!(client.get_contribution_total(&member_a), 100);
    assert_eq!(token_client.balance(&contract), 100);

    assert!(client.try_contribute(&member_a, &1000i128).is_err());
    assert_eq!(client.get_balance(), 100);
    assert_eq!(client.get_contribution_total(&member_a), 100);
    assert_eq!(token_client.balance(&contract), 100);
    assert_eq!(token_client.balance(&member_a), 0);
}

// ---- Proposals: immutability and threshold-one instant approval ----

#[test]
fn proposal_terms_immutable_and_threshold_one_is_approved_at_creation() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone()];
    let token_client = StellarAssetClient::new(&env, &token);

    let (_, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &1u32, &String::from_str(&env, NAME));

    let amount: i128 = 123;
    let desc = String::from_str(&env, "Fixed terms");
    let proposal_id = client.create_proposal(&creator, &recipient, &amount, &desc);

    // Proposer's approval is automatic at 1 / N.
    assert_eq!(proposal_id, 1);
    assert!(client.has_approved(&proposal_id, &creator));
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.approval_count, 1);
    // Threshold 1 means the proposal is Approved the moment it exists.
    assert_eq!(proposal.status, ProposalStatus::Approved);
    assert_eq!(proposal.amount, amount);
    assert_eq!(proposal.recipient, recipient);
    assert_eq!(proposal.description, desc);

    // No further approval is possible on an already-approved proposal.
    assert_eq!(
        client.try_approve(&creator, &proposal_id),
        Err(Ok(CoholdError::ProposalNotPending))
    );

    // Fund, execute, and re-read: terms never change across the lifecycle.
    token_client.mint(&creator, &amount);
    client.contribute(&creator, &amount);
    client.execute(&creator, &proposal_id);
    let executed = client.get_proposal(&proposal_id);
    assert_eq!(executed.status, ProposalStatus::Executed);
    assert_eq!(executed.amount, amount);
    assert_eq!(executed.recipient, recipient);
    assert_eq!(executed.description, desc);
    assert_eq!(executed.proposer, creator);
}

// ---- Execute: threshold gating and exact payment ----

#[test]
fn execute_rejected_until_threshold_and_creator_cannot_bypass() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = vec![&env, creator.clone(), member_a.clone()];
    let token_client = StellarAssetClient::new(&env, &token);

    let (_, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &2u32, &String::from_str(&env, NAME));

    // Fund the treasury so balance is never the reason for rejection.
    token_client.mint(&creator, &500i128);
    client.contribute(&creator, &500i128);

    let proposal_id = client.create_proposal(
        &creator,
        &recipient,
        &200i128,
        &String::from_str(&env, "Needs two signatures"),
    );
    assert_eq!(client.get_proposal(&proposal_id).status, ProposalStatus::Pending);

    // Creator with a single self-approval cannot execute below threshold.
    assert_eq!(
        client.try_execute(&creator, &proposal_id),
        Err(Ok(CoholdError::ThresholdNotReached))
    );
    // Any other caller is equally rejected while Pending.
    assert_eq!(
        client.try_execute(&member_a, &proposal_id),
        Err(Ok(CoholdError::ThresholdNotReached))
    );

    // Failed attempts changed nothing.
    assert_eq!(client.get_balance(), 500);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert_eq!(proposal.approval_count, 1);
    assert_eq!(token_client.balance(&recipient), 0);

    // Second approval unlocks the exact same proposal.
    client.approve(&member_a, &proposal_id);
    assert_eq!(client.get_proposal(&proposal_id).status, ProposalStatus::Approved);
    client.execute(&member_a, &proposal_id);
    assert_eq!(client.get_proposal(&proposal_id).status, ProposalStatus::Executed);
}

#[test]
fn execute_pays_exact_amount_and_accounted_balance_matches_tokens() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member_a = Address::generate(&env);
    let member_b = Address::generate(&env);
    let stranger = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(creator.clone()).address();
    let members = member_list(&env, &creator, &member_a, &member_b);
    let token_client = StellarAssetClient::new(&env, &token);

    let (contract_id, client) = deploy(&env);
    client.initialize(&creator, &token, &members, &2u32, &String::from_str(&env, NAME));

    token_client.mint(&member_a, &1000i128);
    client.contribute(&member_a, &1000i128);
    assert_eq!(client.get_balance(), 1000);
    // Accounted treasury balance matches actual SAC balance exactly.
    assert_eq!(token_client.balance(&contract_id), 1000);

    let proposal_id = client.create_proposal(
        &creator,
        &recipient,
        &400i128,
        &String::from_str(&env, "Pay the plumber"),
    );
    client.approve(&member_b, &proposal_id);
    assert_eq!(client.get_proposal(&proposal_id).status, ProposalStatus::Approved);

    // Execute is permissionless: a non-member stranger runs it.
    client.execute(&stranger, &proposal_id);

    // Recipient received exactly the proposal amount; treasury lost exactly it.
    assert_eq!(token_client.balance(&recipient), 400);
    assert_eq!(token_client.balance(&contract_id), 600);
    assert_eq!(client.get_balance(), 600);
    assert_eq!(client.get_proposal(&proposal_id).status, ProposalStatus::Executed);

    // Books and tokens still agree after the payment; nothing above the
    // accounted balance left the treasury.
    assert_eq!(client.get_contribution_total(&member_a), 1000);
    assert_eq!(client.get_contribution_total(&member_b), 0);
}