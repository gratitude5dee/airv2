-- Wallet lane ERC-20 USDC support: a transfer can now carry a token
-- contract (null = the chain's native token). token_symbol rides along so
-- the ledger renders without a chain lookup; existing rows are native ETH.
alter table wallet_transfers
  add column token_address text,
  add column token_symbol text not null default 'ETH';
