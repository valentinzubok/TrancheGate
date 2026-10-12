import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type Review = {
  at: number;
  result: "met" | "not_met" | "unchanged" | "unreachable";
  content_hash: string;
  tranche: number;
  by: string;
};

export type GrantRow = {
  grant_id: string;
  funder: string;
  grantee: string;
  title: string;
  progress_url: string;
  criterion: string;
  tranches: number;
  tranche_amount: string;
  review_interval: number;
  misses_allowed: number;
  total: string;
  paid_out: string;
  returned: string;
  tranches_paid: number;
  misses: number;
  reviews: number;
  status: string;
  opened_at: number;
  next_review_at: number;
  last_result: string;
  history: Review[];
  injection_flags: string[];
};

export type Schedule = {
  grant_id: string;
  status: string;
  now: number;
  next_review_at: number;
  can_review: boolean;
  can_reclaim: boolean;
  can_renounce: boolean;
  remaining: string;
};

export type Books = { balance: string; escrowed: string; credits: string };
export type Stats = {
  grants: number;
  by_status: Record<string, number>;
  paid_out: string;
  returned: string;
};
export type EventRow = { event: string; [key: string]: unknown };

type OnStage = (stage: TxStage, hash: string) => void;
const read = (fn: string, args: string[] = []) => readContract<string>(CONTRACT_ADDRESS, fn, args);

export async function listGrants(): Promise<string[]> {
  return parseJson<string[]>(await read("list_grants"), []);
}

export async function getGrant(id: string): Promise<GrantRow | null> {
  const parsed = parseJson<GrantRow>(await read("get_grant", [id]), {} as GrantRow);
  return parsed.grant_id ? parsed : null;
}

/** What is accepted right now — read it before paying a fee for a call that would revert. */
export async function getSchedule(id: string): Promise<Schedule | null> {
  const parsed = parseJson<Schedule>(await read("get_schedule", [id]), {} as Schedule);
  return parsed.grant_id ? parsed : null;
}

export async function getBooks(): Promise<Books | null> {
  return parseJson<Books | null>(await read("get_balance"), null);
}

export async function getStats(): Promise<Stats | null> {
  return parseJson<Stats | null>(await read("get_stats"), null);
}

export async function getEvents(): Promise<EventRow[]> {
  return parseJson<EventRow[]>(await read("get_events"), []);
}

/** Wei the contract owes this address from a grant it refused to open. */
export async function getCredit(address: string): Promise<string> {
  return (await read("get_credit", [address])) || "0";
}

export type NewGrant = {
  grantId: string;
  grantee: string;
  title: string;
  progressUrl: string;
  criterion: string;
  tranches: string;
  reviewInterval: string;
  missesAllowed: string;
  /** The whole grant in wei; it travels as the transaction's value. */
  total: string;
};

export async function openGrant(account: Address, provider: unknown, g: NewGrant, on?: OnStage) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "open_grant",
    [
      g.grantId,
      g.grantee,
      g.title,
      g.progressUrl,
      g.criterion,
      g.tranches,
      g.reviewInterval,
      g.missesAllowed,
    ],
    on,
    BigInt(g.total || "0"),
  );
}

const simple = (fn: string) => (account: Address, provider: unknown, id: string, on?: OnStage) =>
  writeAndWait(account, provider, CONTRACT_ADDRESS, fn, [id], on);

export const review = simple("review");
export const reclaim = simple("reclaim");
export const renounce = simple("renounce");

export async function withdrawCredit(account: Address, provider: unknown, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "withdraw_credit", [], on);
}
