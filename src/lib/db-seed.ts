import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  proposals,
  proposalApprovals,
  contributions,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateContractAddress, generateStellarTxHash } from "./utils";
import { DEFAULT_PERSONAS } from "./personas";

export async function ensureDatabaseSeeded() {
  try {
    const existing = await db.select().from(treasuries).limit(1);
    if (existing.length > 0) {
      return; // Already seeded
    }

    const maria = DEFAULT_PERSONAS[0]; // President
    const juan = DEFAULT_PERSONAS[1]; // Treasurer
    const chloe = DEFAULT_PERSONAS[2]; // Secretary
    const daniel = DEFAULT_PERSONAS[3]; // Auditor
    const alex = DEFAULT_PERSONAS[4]; // Lead Partner
    const samira = DEFAULT_PERSONAS[5]; // CFO

    // 1. IT Society Event Fund (PRD Section 26 Demo Treasury)
    const itSocietyId = "tr-it-society-event-fund";
    const itSocietyContract = generateContractAddress();

    await db.insert(treasuries).values({
      id: itSocietyId,
      name: "IT Society Event Fund",
      description:
        "Official student organization fund for annual tech symposium, venue deposits, and workshop equipment.",
      category: "student_org",
      creatorAddress: maria.address,
      tokenSymbol: "DEMO_UNITS",
      tokenAddress: "CDEMO_XLM_SAC_CONTRACT_TESTNET",
      tokenDecimals: 7,
      threshold: 3,
      memberCount: 4,
      balance: "10000",
      status: "active",
      contractAddress: itSocietyContract,
      network: "testnet",
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date(),
    });

    // Members for IT Society
    await db.insert(treasuryMembers).values([
      {
        id: "mem-it-1",
        treasuryId: itSocietyId,
        address: maria.address,
        label: "Maria Santos (President)",
        role: "President",
        avatar: "👩‍💼",
        joinedAt: new Date(Date.now() - 7 * 86400000),
      },
      {
        id: "mem-it-2",
        treasuryId: itSocietyId,
        address: juan.address,
        label: "Juan Dela Cruz (Treasurer)",
        role: "Treasurer",
        avatar: "👨‍💻",
        joinedAt: new Date(Date.now() - 7 * 86400000),
      },
      {
        id: "mem-it-3",
        treasuryId: itSocietyId,
        address: chloe.address,
        label: "Chloe Lim (Secretary)",
        role: "Secretary",
        avatar: "👩‍🔬",
        joinedAt: new Date(Date.now() - 7 * 86400000),
      },
      {
        id: "mem-it-4",
        treasuryId: itSocietyId,
        address: daniel.address,
        label: "Daniel Tan (Auditor)",
        role: "Auditor",
        avatar: "🧑‍⚖️",
        joinedAt: new Date(Date.now() - 7 * 86400000),
      },
    ]);

    // Initial contributions
    await db.insert(contributions).values([
      {
        id: "con-it-1",
        treasuryId: itSocietyId,
        memberAddress: juan.address,
        memberLabel: "Juan Dela Cruz (Treasurer)",
        amount: "5000",
        note: "Q1 Organization Semester Dues Collection",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 6 * 86400000),
      },
      {
        id: "con-it-2",
        treasuryId: itSocietyId,
        memberAddress: maria.address,
        memberLabel: "Maria Santos (President)",
        amount: "5000",
        note: "Sponsorship Grant Contribution",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 5 * 86400000),
      },
    ]);

    // Proposal 1: Section 26 Demo Proposal (Venue Reservation 4,500 units, 2/3 approvals)
    const venuePropId = "prop-venue-deposit-4500";
    await db.insert(proposals).values({
      id: venuePropId,
      treasuryId: itSocietyId,
      title: "Grand Hall Venue Deposit",
      description:
        "50% downpayment for University Convention Center auditorium for the annual Hackathon and Tech Summit 2026.",
      category: "Venue & Logistics",
      amount: "4500",
      proposerAddress: juan.address,
      proposerLabel: "Juan Dela Cruz (Treasurer)",
      recipientAddress: "GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1",
      recipientLabel: "University Convention Center",
      approvalCount: 2,
      threshold: 3,
      status: "pending",
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(),
    });

    // Approvals for Venue Deposit (Juan & Maria have approved, waiting for Chloe or Daniel!)
    await db.insert(proposalApprovals).values([
      {
        id: "app-venue-1",
        proposalId: venuePropId,
        treasuryId: itSocietyId,
        approverAddress: juan.address,
        approverLabel: "Juan Dela Cruz (Treasurer)",
        signature: "sig_ed25519_juan_soroban_auth_pass",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        id: "app-venue-2",
        proposalId: venuePropId,
        treasuryId: itSocietyId,
        approverAddress: maria.address,
        approverLabel: "Maria Santos (President)",
        signature: "sig_ed25519_maria_soroban_auth_pass",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 1 * 86400000),
      },
    ]);

    // Proposal 2: Sound System & Lighting (Pending, 1 approval)
    const soundPropId = "prop-sound-lighting-2800";
    await db.insert(proposals).values({
      id: soundPropId,
      treasuryId: itSocietyId,
      title: "Audio & Stage Lighting Rental",
      description:
        "High-fidelity wireless microphones, sound stage mixer, and LED lighting setup for keynote sessions.",
      category: "Equipment",
      amount: "2800",
      proposerAddress: chloe.address,
      proposerLabel: "Chloe Lim (Secretary)",
      recipientAddress: "GAUDIO888RENTALSSUPPLIERTESTNETRECIPIENT2",
      recipientLabel: "ProSound Studio Rentals",
      approvalCount: 1,
      threshold: 3,
      status: "pending",
      createdAt: new Date(Date.now() - 12 * 3600000),
      updatedAt: new Date(),
    });

    await db.insert(proposalApprovals).values([
      {
        id: "app-sound-1",
        proposalId: soundPropId,
        treasuryId: itSocietyId,
        approverAddress: chloe.address,
        approverLabel: "Chloe Lim (Secretary)",
        signature: "sig_ed25519_chloe_soroban_auth_pass",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 12 * 3600000),
      },
    ]);

    // Proposal 3: Guest Speaker Honorarium (Already Executed)
    const speakerPropId = "prop-speaker-honorarium-1200";
    const execTx = generateStellarTxHash();
    await db.insert(proposals).values({
      id: speakerPropId,
      treasuryId: itSocietyId,
      title: "AI Keynote Speaker Honorarium",
      description:
        "Honorarium and transport reimbursement for Visiting Professor Keynote address.",
      category: "Honorarium",
      amount: "1200",
      proposerAddress: maria.address,
      proposerLabel: "Maria Santos (President)",
      recipientAddress: "GSPEAKER333KEYNOTETESTNETRECIPIENTADDRESS3",
      recipientLabel: "Dr. Elena Rostova",
      approvalCount: 3,
      threshold: 3,
      status: "executed",
      executedAt: new Date(Date.now() - 3 * 86400000),
      executedBy: juan.address,
      executionTxHash: execTx,
      createdAt: new Date(Date.now() - 4 * 86400000),
      updatedAt: new Date(Date.now() - 3 * 86400000),
    });

    await db.insert(proposalApprovals).values([
      {
        id: "app-spk-1",
        proposalId: speakerPropId,
        treasuryId: itSocietyId,
        approverAddress: maria.address,
        approverLabel: "Maria Santos (President)",
        signature: "sig_maria_1",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 4 * 86400000),
      },
      {
        id: "app-spk-2",
        proposalId: speakerPropId,
        treasuryId: itSocietyId,
        approverAddress: juan.address,
        approverLabel: "Juan Dela Cruz (Treasurer)",
        signature: "sig_juan_1",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 4 * 86400000),
      },
      {
        id: "app-spk-3",
        proposalId: speakerPropId,
        treasuryId: itSocietyId,
        approverAddress: daniel.address,
        approverLabel: "Daniel Tan (Auditor)",
        signature: "sig_daniel_1",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 3 * 86400000),
      },
    ]);

    // Audit logs for IT Society
    await db.insert(auditLogs).values([
      {
        id: "log-it-1",
        treasuryId: itSocietyId,
        action: "TREASURY_CREATED",
        actorAddress: maria.address,
        actorLabel: "Maria Santos (President)",
        details: JSON.stringify({
          threshold: 3,
          members: 4,
          contract: itSocietyContract,
        }),
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 7 * 86400000),
      },
      {
        id: "log-it-2",
        treasuryId: itSocietyId,
        action: "FUNDS_CONTRIBUTED",
        actorAddress: juan.address,
        actorLabel: "Juan Dela Cruz (Treasurer)",
        details: JSON.stringify({ amount: "5000", newBalance: "5000" }),
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 6 * 86400000),
      },
      {
        id: "log-it-3",
        treasuryId: itSocietyId,
        action: "FUNDS_CONTRIBUTED",
        actorAddress: maria.address,
        actorLabel: "Maria Santos (President)",
        details: JSON.stringify({ amount: "5000", newBalance: "10000" }),
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 5 * 86400000),
      },
      {
        id: "log-it-4",
        treasuryId: itSocietyId,
        action: "PROPOSAL_CREATED",
        actorAddress: juan.address,
        actorLabel: "Juan Dela Cruz (Treasurer)",
        details: JSON.stringify({
          proposalId: venuePropId,
          title: "Grand Hall Venue Deposit",
          amount: "4500",
        }),
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        id: "log-it-5",
        treasuryId: itSocietyId,
        action: "PROPOSAL_APPROVED",
        actorAddress: maria.address,
        actorLabel: "Maria Santos (President)",
        details: JSON.stringify({
          proposalId: venuePropId,
          approvalCount: 2,
          threshold: 3,
        }),
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 1 * 86400000),
      },
    ]);

    // 2. Nexus Studio Hardware & Cloud Treasury (Small Business / Partnership)
    const nexusId = "tr-nexus-studio-partnership";
    const nexusContract = generateContractAddress();
    await db.insert(treasuries).values({
      id: nexusId,
      name: "Nexus Studio Operating Fund",
      description:
        "Joint venture treasury for digital design studio operations, SaaS tool subscriptions, and hardware purchases.",
      category: "small_business",
      creatorAddress: alex.address,
      tokenSymbol: "DEMO_UNITS",
      tokenAddress: "CDEMO_XLM_SAC_CONTRACT_TESTNET",
      tokenDecimals: 7,
      threshold: 2,
      memberCount: 3,
      balance: "24500",
      status: "active",
      contractAddress: nexusContract,
      network: "testnet",
      createdAt: new Date(Date.now() - 14 * 86400000),
      updatedAt: new Date(),
    });

    await db.insert(treasuryMembers).values([
      {
        id: "mem-nx-1",
        treasuryId: nexusId,
        address: alex.address,
        label: "Alex Rivera (Lead Partner)",
        role: "Lead Partner",
        avatar: "👨‍💼",
        joinedAt: new Date(Date.now() - 14 * 86400000),
      },
      {
        id: "mem-nx-2",
        treasuryId: nexusId,
        address: samira.address,
        label: "Samira Patel (CFO Partner)",
        role: "CFO Partner",
        avatar: "👩‍💻",
        joinedAt: new Date(Date.now() - 14 * 86400000),
      },
      {
        id: "mem-nx-3",
        treasuryId: nexusId,
        address: "GAKJ9R1T3V5X7Z9B1D3F5H7J9L1N3P5R7T9V1X3Z5B7D9F1H3J5L7N9P",
        label: "Kenji Sato (Tech Lead Partner)",
        role: "Tech Lead",
        avatar: "🧑‍💻",
        joinedAt: new Date(Date.now() - 14 * 86400000),
      },
    ]);

    await db.insert(contributions).values([
      {
        id: "con-nx-1",
        treasuryId: nexusId,
        memberAddress: alex.address,
        memberLabel: "Alex Rivera (Lead Partner)",
        amount: "15000",
        note: "Partner Capital Contribution A",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 13 * 86400000),
      },
      {
        id: "con-nx-2",
        treasuryId: nexusId,
        memberAddress: samira.address,
        memberLabel: "Samira Patel (CFO Partner)",
        amount: "9500",
        note: "Partner Capital Contribution B",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 12 * 86400000),
      },
    ]);

    // Proposal for Nexus: High-Performance Workstation Upgrade (18,000, 2-of-3 threshold)
    const nexusPropId = "prop-workstation-18000";
    await db.insert(proposals).values({
      id: nexusPropId,
      treasuryId: nexusId,
      title: "3D GPU Render Nodes & Workstations",
      description:
        "Purchase 2x RTX 5090 render workstations from authorized distributor for client animation pipeline.",
      category: "Hardware",
      amount: "18000",
      proposerAddress: alex.address,
      proposerLabel: "Alex Rivera (Lead Partner)",
      recipientAddress: "GHARDWARE999SUPPLIERSTELLARTESTNETRECIPIENT1",
      recipientLabel: "Apex Hardware Systems Ltd.",
      approvalCount: 1,
      threshold: 2,
      status: "pending",
      createdAt: new Date(Date.now() - 1 * 86400000),
      updatedAt: new Date(),
    });

    await db.insert(proposalApprovals).values([
      {
        id: "app-nx-1",
        proposalId: nexusPropId,
        treasuryId: nexusId,
        approverAddress: alex.address,
        approverLabel: "Alex Rivera (Lead Partner)",
        signature: "sig_alex_1",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 1 * 86400000),
      },
    ]);

    // 3. Barangay Greenwoods Solar Project (Community Fund, 7 members, 5 required)
    const commId = "tr-greenwoods-solar-project";
    const commContract = generateContractAddress();
    await db.insert(treasuries).values({
      id: commId,
      name: "Greenwoods Community Solar Fund",
      description:
        "Neighborhood committee fund for installing solar perimeter streetlights and backup battery inverters.",
      category: "community_fund",
      creatorAddress: maria.address,
      tokenSymbol: "DEMO_UNITS",
      tokenAddress: "CDEMO_XLM_SAC_CONTRACT_TESTNET",
      tokenDecimals: 7,
      threshold: 5,
      memberCount: 7,
      balance: "85000",
      status: "active",
      contractAddress: commContract,
      network: "testnet",
      createdAt: new Date(Date.now() - 20 * 86400000),
      updatedAt: new Date(),
    });

    // 7 members for community fund
    const commMembers = [
      { addr: maria.address, label: "Maria Santos", role: "Committee Chair" },
      { addr: juan.address, label: "Juan Dela Cruz", role: "Treasurer" },
      { addr: chloe.address, label: "Chloe Lim", role: "Secretary" },
      { addr: daniel.address, label: "Daniel Tan", role: "Auditor" },
      { addr: alex.address, label: "Alex Rivera", role: "Resident Representative" },
      { addr: samira.address, label: "Samira Patel", role: "Procurement Lead" },
      {
        addr: "GAKJ9R1T3V5X7Z9B1D3F5H7J9L1N3P5R7T9V1X3Z5B7D9F1H3J5L7N9P",
        label: "Kenji Sato",
        role: "Technical Advisor",
      },
    ];

    for (let i = 0; i < commMembers.length; i++) {
      const m = commMembers[i];
      await db.insert(treasuryMembers).values({
        id: `mem-comm-${i + 1}`,
        treasuryId: commId,
        address: m.addr,
        label: `${m.label} (${m.role})`,
        role: m.role,
        avatar: "🏘️",
        joinedAt: new Date(Date.now() - 20 * 86400000),
      });
    }

    await db.insert(contributions).values([
      {
        id: "con-comm-1",
        treasuryId: commId,
        memberAddress: maria.address,
        memberLabel: "Maria Santos (Chair)",
        amount: "85000",
        note: "Community matching grant & resident collections",
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - 19 * 86400000),
      },
    ]);

    const commPropId = "prop-solar-lighting-45000";
    await db.insert(proposals).values({
      id: commPropId,
      treasuryId: commId,
      title: "Solar Street Lights & Hybrid Inverters (Phase 1)",
      description:
        "Procure and install 35x all-in-one solar streetlights with lithium iron phosphate batteries across Avenue 1-4.",
      category: "Infrastructure",
      amount: "45000",
      proposerAddress: samira.address,
      proposerLabel: "Samira Patel (Procurement Lead)",
      recipientAddress: "GSOLAR777CONTRACTORENERGYTESTNETRECIPIENT1",
      recipientLabel: "SunPower Grid Solutions Inc.",
      approvalCount: 4,
      threshold: 5,
      status: "pending",
      createdAt: new Date(Date.now() - 3 * 86400000),
      updatedAt: new Date(),
    });

    // 4 approvals on Solar project (needs 1 more!)
    const approvers = [samira.address, maria.address, juan.address, alex.address];
    for (let i = 0; i < approvers.length; i++) {
      const p = DEFAULT_PERSONAS.find((x) => x.address === approvers[i]);
      await db.insert(proposalApprovals).values({
        id: `app-comm-${i + 1}`,
        proposalId: commPropId,
        treasuryId: commId,
        approverAddress: approvers[i],
        approverLabel: p ? `${p.role} (${p.name})` : "Committee Member",
        signature: `sig_comm_${i + 1}`,
        txHash: generateStellarTxHash(),
        createdAt: new Date(Date.now() - (3 - i * 0.5) * 86400000),
      });
    }
  } catch (err) {
    console.error("Database seeding error:", err);
  }
}
