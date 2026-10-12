/** Live TrancheGate deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_TRANCHEGATE_ADDRESS ||
  "0x67aede124648dEb4749f0F96173F44df6F6d09D1") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/TrancheGate";
export const CONTRACT_REPO = "https://github.com/valentinzubok/TrancheGateCore";

/** The demo progress pages live in this repository, so every change is a public commit. */
export const DEMO_PAGE = "https://valentinzubok.github.io/TrancheGate/fixtures/grant-b.html";
export const DEMO_TITLE = "Lantern Docs translation";
export const DEMO_CRITERION =
  "Each period the page must state documentation work that is finished and published in that period. Plans and work in progress do not count.";
