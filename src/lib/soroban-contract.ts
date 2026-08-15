export const RUST_SOROBAN_CONTRACT_CODE = `//! Cohold — Shared funds. Shared control.
//! Soroban Smart Contract for Multi-Approval Shared Treasuries.
//! Target: Stellar Testnet / Soroban SDK v21+

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short,
    token, Address, Env, IntoVal, String, Symbol, TryFromVal, Val, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CoholdError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotMember = 3,
    InvalidThreshold = 4,
    EmptyMembers = 5,
    DuplicateMember = 6,
    ThresholdNotReached = 7,
    AlreadyApproved = 8,
    ProposalNotFound = 9,
    ProposalNotPending = 10,
    AlreadyExecuted = 11,
    InsufficientBalance = 12,
    ZeroAmount = 13,
    Unauthorized = 14,
    InvalidRecipient = 15,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Pending = 0,
    Approved = 1,
    Executed = 2,
    Cancelled = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryConfig {
    pub creator: Address,
    pub token: Address,
    pub threshold: u32,
    pub member_count: u32,
    pub name: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub recipient: Address,
    pub amount: i128,
    pub description: String,
    pub approval_count: u32,
    pub status: ProposalStatus,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    Member(Address),
    MemberList,
    Proposal(u64),
    ProposalCount,
    Approval(u64, Address),
    TotalContributed(Address),
    ContractBalance,
}

const TOPIC_TREASURY: Symbol = symbol_short!("treasury");
const TOPIC_PROPOSAL: Symbol = symbol_short!("proposal");
const TOPIC_APPROVAL: Symbol = symbol_short!("approval");
const TOPIC_EXECUTE: Symbol = symbol_short!("execute");

#[contract]
pub struct CoholdContract;

#[contractimpl]
impl CoholdContract {
    /// Initialize a shared treasury with immutable members and threshold.
    pub fn initialize(
        env: Env,
        creator: Address,
        token: Address,
        members: Vec<Address>,
        threshold: u32,
        name: String,
    ) -> Result<(), CoholdError> {
        creator.require_auth();

        if env.storage().instance().has(&DataKey::Config) {
            return Err(CoholdError::AlreadyInitialized);
        }

        let member_count = members.len();
        if member_count == 0 {
            return Err(CoholdError::EmptyMembers);
        }
        if threshold == 0 || threshold > member_count {
            return Err(CoholdError::InvalidThreshold);
        }

        let mut has_creator = false;
        // Verify unique members and store membership
        for i in 0..member_count {
            let member = members.get(i).unwrap();
            if env.storage().persistent().has(&DataKey::Member(member.clone())) {
                return Err(CoholdError::DuplicateMember);
            }
            if member == creator {
                has_creator = true;
            }
            env.storage().persistent().set(&DataKey::Member(member), &true);
        }

        // Creator must be in member list
        if !has_creator {
            return Err(CoholdError::NotMember);
        }

        let config = TreasuryConfig {
            creator: creator.clone(),
            token: token.clone(),
            threshold,
            member_count,
            name,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().persistent().set(&DataKey::MemberList, &members);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
        env.storage().instance().set(&DataKey::ContractBalance, &0i128);

        env.events().publish(
            (TOPIC_TREASURY, symbol_short!("created")),
            (creator, threshold, member_count),
        );

        Ok(())
    }

    /// Contribute funds to the shared treasury (Member only).
    pub fn contribute(
        env: Env,
        member: Address,
        amount: i128,
    ) -> Result<(), CoholdError> {
        member.require_auth();

        if !Self::is_member(env.clone(), member.clone()) {
            return Err(CoholdError::NotMember);
        }
        if amount <= 0 {
            return Err(CoholdError::ZeroAmount);
        }

        let config: TreasuryConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(CoholdError::NotInitialized)?;

        // Transfer tokens from member into this Soroban contract
        let client = token::Client::new(&env, &config.token);
        client.transfer(&member, &env.current_contract_address(), &amount);

        // Update balances
        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContractBalance)
            .unwrap_or(0);
        balance += amount;
        env.storage().instance().set(&DataKey::ContractBalance, &balance);

        let mut member_total: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalContributed(member.clone()))
            .unwrap_or(0);
        member_total += amount;
        env.storage().persistent().set(&DataKey::TotalContributed(member.clone()), &member_total);

        env.events().publish(
            (TOPIC_TREASURY, symbol_short!("deposit")),
            (member, amount, balance),
        );

        Ok(())
    }

    /// Create a spending proposal. Proposer automatically approves.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        recipient: Address,
        amount: i128,
        description: String,
    ) -> Result<u64, CoholdError> {
        proposer.require_auth();

        if !Self::is_member(env.clone(), proposer.clone()) {
            return Err(CoholdError::NotMember);
        }
        if amount <= 0 {
            return Err(CoholdError::ZeroAmount);
        }

        let config: TreasuryConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(CoholdError::NotInitialized)?;

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);
        count += 1;
        let proposal_id = count;

        let status = if config.threshold == 1 {
            ProposalStatus::Approved
        } else {
            ProposalStatus::Pending
        };

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            recipient: recipient.clone(),
            amount,
            description,
            approval_count: 1,
            status,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::ProposalCount, &proposal_id);
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&DataKey::Approval(proposal_id, proposer.clone()), &true);

        env.events().publish(
            (TOPIC_PROPOSAL, symbol_short!("created")),
            (proposal_id, proposer, amount),
        );

        Ok(proposal_id)
    }

    /// Approve a pending proposal.
    pub fn approve(
        env: Env,
        member: Address,
        proposal_id: u64,
    ) -> Result<(), CoholdError> {
        member.require_auth();

        if !Self::is_member(env.clone(), member.clone()) {
            return Err(CoholdError::NotMember);
        }

        let config: TreasuryConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(CoholdError::NotInitialized)?;

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(CoholdError::ProposalNotFound)?;

        if proposal.status != ProposalStatus::Pending {
            return Err(CoholdError::ProposalNotPending);
        }

        if env.storage().persistent().has(&DataKey::Approval(proposal_id, member.clone())) {
            return Err(CoholdError::AlreadyApproved);
        }

        // Record member approval
        env.storage().persistent().set(&DataKey::Approval(proposal_id, member.clone()), &true);
        proposal.approval_count += 1;

        if proposal.approval_count >= config.threshold {
            proposal.status = ProposalStatus::Approved;
            env.events().publish(
                (TOPIC_PROPOSAL, symbol_short!("approved")),
                (proposal_id, proposal.approval_count),
            );
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (TOPIC_APPROVAL, symbol_short!("signed")),
            (proposal_id, member),
        );

        Ok(())
    }

    /// Execute an approved proposal.
    pub fn execute(
        env: Env,
        caller: Address,
        proposal_id: u64,
    ) -> Result<(), CoholdError> {
        caller.require_auth();

        let config: TreasuryConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(CoholdError::NotInitialized)?;

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(CoholdError::ProposalNotFound)?;

        if proposal.status == ProposalStatus::Executed {
            return Err(CoholdError::AlreadyExecuted);
        }

        if proposal.approval_count < config.threshold || proposal.status != ProposalStatus::Approved {
            return Err(CoholdError::ThresholdNotReached);
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContractBalance)
            .unwrap_or(0);

        if balance < proposal.amount {
            return Err(CoholdError::InsufficientBalance);
        }

        // Transfer funds from contract to recipient
        let client = token::Client::new(&env, &config.token);
        client.transfer(&env.current_contract_address(), &proposal.recipient, &proposal.amount);

        // Deduct treasury balance & mark executed
        balance -= proposal.amount;
        proposal.status = ProposalStatus::Executed;

        env.storage().instance().set(&DataKey::ContractBalance, &balance);
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (TOPIC_EXECUTE, symbol_short!("paid")),
            (proposal_id, proposal.recipient, proposal.amount),
        );

        Ok(())
    }

    /// Check if address is a member.
    pub fn is_member(env: Env, address: Address) -> bool {
        env.storage().persistent().get(&DataKey::Member(address)).unwrap_or(false)
    }

    /// Check if member approved proposal.
    pub fn has_approved(env: Env, proposal_id: u64, member: Address) -> bool {
        env.storage().persistent().get(&DataKey::Approval(proposal_id, member)).unwrap_or(false)
    }

    /// Get treasury config.
    pub fn get_config(env: Env) -> Result<TreasuryConfig, CoholdError> {
        env.storage().instance().get(&DataKey::Config).ok_or(CoholdError::NotInitialized)
    }

    /// Get proposal by id.
    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, CoholdError> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id)).ok_or(CoholdError::ProposalNotFound)
    }

    /// Get current treasury contract balance.
    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::ContractBalance).unwrap_or(0)
    }
}
`;

export const CONTRACT_SECURITY_INVARIANTS = [
  {
    id: "INV-1",
    name: "Zero Unilateral Withdrawals",
    rule: "Funds can leave the treasury ONLY through a valid approved proposal with cryptographic threshold consensus.",
    status: "Enforced",
  },
  {
    id: "INV-2",
    name: "Strict One-Member One-Vote",
    rule: "One member can count as only one approval per proposal. Duplicate approvals are strictly rejected.",
    status: "Enforced",
  },
  {
    id: "INV-3",
    name: "Threshold Precondition",
    rule: "A proposal cannot execute before the required threshold of approvals is satisfied.",
    status: "Enforced",
  },
  {
    id: "INV-4",
    name: "Immutable Proposal Terms",
    rule: "Proposal amount, recipient, and parameters cannot change after creation.",
    status: "Enforced",
  },
  {
    id: "INV-5",
    name: "Double-Execution Prevention",
    rule: "An executed proposal can NEVER be executed again (prevent double-spend attacks).",
    status: "Enforced",
  },
  {
    id: "INV-6",
    name: "Solvency & Asset Conservation",
    rule: "A proposal cannot transfer more than the available treasury balance.",
    status: "Enforced",
  },
  {
    id: "INV-7",
    name: "Member Authorization Boundary",
    rule: "Only verified members may create proposals, contribute, or approve.",
    status: "Enforced",
  },
  {
    id: "INV-8",
    name: "Immutable Creator Constraints",
    rule: "The creator receives no unilateral backdoors and cannot bypass group consensus rules.",
    status: "Enforced",
  },
];
