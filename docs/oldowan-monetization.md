## Oldowan Monetization Protocol

**Version:** 0.1 (Draft)
**Date:** 2025-04-23

## 1. Introduction

This document outlines the Oldowan monetization features built on top of the Model Context Protocol (MCP). The goal is to provide a standardized, flexible, and secure mechanism for tool providers (MCP Servers) to charge for the usage of their AI tools and services accessed by agents (MCP Clients).

**Definition: Oldowan Server**

An **Oldowan Server** is an MCP Server with added monetization capabilities. In other words, it is a Model Context Protocol (MCP) Server that implements payment gating, subscription, credit-based access, or other monetization features as described in this document.

The protocol is designed to be extensible, allowing for the future addition of new payment models.

## 2. Core Concepts

### 2.1 Agent Authentication and Request Signing

Every request made by an agent (MCP Client) to a monetized MCP tool (Server) MUST be authenticated to verify the caller's identity.

- **Identity:** The calling agent is identified by its Solana wallet address.
- **Signing:** The agent signs the request payload.
- **Verification:** The signature is transmitted as part of the request (e.g., in an HTTP header). The MCP Server uses this signature to verify the request originated from the claimed Solana wallet address.

This signature verification step is crucial for access gating and ensuring that payment checks are associated with the correct agent identity.

### 2.2 Payment Verification Workflow

Once the agent's identity is successfully verified via signature checking, the MCP Server proceeds to check if the agent meets the payment requirements for accessing the tool. The protocol currently supports three primary payment models:

1.  **Token-Gated Access**
2.  **Subscription Access**
3.  **Credit-Based Access**

The specific checks depend on the payment model configured for the tool.

## 3. Payment Models

### 3.1 Token-Gated Access

- **Concept:** Access is granted if the agent's verified Solana wallet address holds a minimum amount of a specific token.
- **Implementation:**
  1.  After verifying the agent's signature and identifying their Solana wallet address, the Oldowan Server queries the Solana blockchain.
  2.  The server checks the agent's wallet for the presence and/or required quantity of the specified gating token.
  3.  Access is granted if the on-chain check confirms the token requirement is met.
- **Use Case:** Simple access control based on token ownership, often used for community access or basic tier features.

### 3.2 Subscription Access

- **Concept:** Access is granted if the agent holds proof of an active subscription, potentially represented by a revocable Non-Fungible Token (NFT).
- **Implementation:**
  1.  The subscription could be represented by an NFT associated with the agent's Solana wallet.
  2.  This NFT would have associated metadata, including a field indicating subscription status (e.g., `subscription_status: active`).
  3.  The entity managing the subscription (e.g., the Elite Agents program) is responsible for keeping the NFT's metadata updated based on payment status. If payments lapse, the metadata is updated (e.g., `subscription_status: inactive`) or the NFT might be revoked.
  4.  After verifying the agent's signature, the MCP Server checks the agent's wallet for the specific subscription NFT and verifies its `subscription_status` metadata field on-chain.
  5.  Access is granted if an NFT with an `active` status is found.
- **Use Case:** Recurring access to tools or services (e.g., monthly or annual plans).

### 3.3 Credit-Based Access

- **Concept:** Agents pre-purchase credits, which are then consumed atomically as they use the MCP tool. Access is granted as long as the agent has a sufficient credit balance.
- **Implementation:**
  1.  **Credit Purchase:** Agents purchase credits, likely via an on-chain transaction. This transaction updates a credit balance associated with the agent's Solana wallet address in an off-chain database or ledger managed by the tool provider or a trusted third party.
  2.  **Credit Check & Deduction:** When a request is received and the agent's identity verified, the MCP Server queries the off-chain credit database for the agent's balance.
  3.  If the balance is sufficient for the requested operation, the server atomically deducts the required credits and processes the request.
  4.  If the balance is insufficient, the server denies the request (potentially responding with information on how to purchase more credits.
- **Use Case:** Pay-per-use models, metered billing, API call quotas, or fine-grained resource consumption.

## 4. Optimization: Caching and Authorization Servers (Optional)

Performing on-chain checks for every request can introduce latency. To optimize performance, MCP Servers can optionally leverage trusted off-chain mechanisms:

### 4.1 Trusted Cache Server

- **Concept:** An MCP Server can be configured to trust a specific cache server that maintains a near real-time state of agent payment statuses (token holdings, subscription validity, credit balances).
- **Implementation:**
  1.  During initialization, the MCP Server is configured with the public key or endpoint of the trusted cache server.
  2.  Instead of querying the blockchain directly for token/NFT status, the MCP Server queries the cache server.
  3.  The cache server is responsible for monitoring the blockchain and keeping its state updated.
- **Trust:** The security of this model relies on the MCP Server's trust in the integrity and availability of the cache server.

### 4.2 Trusted Authorization Server (OpenID Connect JWT)

- **Concept:** A more advanced, stateless optimization involves a dedicated authorization server. Agents authenticate with this server, which performs the necessary payment checks (on-chain or via its own cache/database) and issues a short-lived JSON Web Token (JWT) containing claims about the agent's access rights.
- **Implementation:**
  1.  **Token Exchange:** The agent initiates an authentication flow with the authorization server. This typically involves the agent signing a payload (e.g., containing their wallet address and a timestamp) with their Solana wallet.
  2.  **Verification & Issuance:** The authorization server verifies the signature, performs the necessary payment/status checks (token, subscription, credits), and, if successful, issues an OIDC-compliant JWT. This JWT contains claims asserting the agent's identity and authorized access level/duration/credits, signed by the authorization server's private key.
  3.  **MCP Request:** The agent includes this JWT (e.g., as a Bearer token in the `Authorization` header) in its requests to the MCP Server.
  4.  **Server Verification:** The MCP Server, configured to trust the authorization server's public key, verifies the JWT's signature and checks its claims (e.g., expiry, audience, specific access rights) without needing to perform its own on-chain or database lookups for each request.
- **Configuration:** When initializing an Oldowan Server, administrators can specify the public keys of the authorization servers they trust.
- **Fallback:** If no trusted authorization server is configured or available, the Oldowan Server SHOULD default to performing direct on-chain checks as described in Section 4.

## 5. Extensibility

The Oldowan monetization protocol is designed with extensibility in mind. New payment models beyond the initial three (Token-Gated, Subscription, Credit) can be added in future versions of the specification without requiring fundamental changes to the core authentication and verification flow.

## 6. Security Considerations

- **Signature Verification:** Robust implementation of cryptographic signature verification is paramount.
- **Replay Attacks:** Mechanisms like timestamps or nonces should be included in signed payloads to prevent replay attacks, especially in the JWT exchange flow.
- **Transport Security:** Communication between agents, MCP servers, and any authorization/cache servers MUST use secure transport protocols like TLS.
- **Trust Management:** Careful configuration and management of trusted cache/authorization server keys are essential when using optimization mechanisms.
- **Off-Chain Ledgers:** When using credit-based systems, the integrity, security, and atomicity of the off-chain ledger are critical.
