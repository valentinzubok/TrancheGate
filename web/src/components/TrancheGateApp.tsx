"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_REPO,
  DEMO_CRITERION,
  DEMO_PAGE,
  DEMO_TITLE,
  EXPLORER,
  GITHUB,
  txUrl,
} from "@/lib/config";
import {
  getBooks,
  getCredit,
  getEvents,
  getGrant,
  getSchedule,
  getStats,
  listGrants,
  openGrant,
  reclaim,
  renounce,
  review,
  withdrawCredit,
  type Books,
  type EventRow,
  type GrantRow,
  type Schedule,
  type Stats,
} from "@/lib/contracts";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const utc = (seconds: number) =>
  seconds ? `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC` : "—";
const span = (seconds: number) =>
  seconds >= 86400
    ? `${Math.round(seconds / 8640) / 10} d`
    : seconds >= 3600
      ? `${Math.round(seconds / 360) / 10} h`
      : `${Math.round(seconds / 6) / 10} min`;

/** Wei as GEN, trimmed: 1500000000000000000 -> "1.5". */
const fmtGen = (wei: string | number | undefined) => {
  let v: bigint;
  try {
    v = BigInt(wei || 0);
  } catch {
    return "0";
  }
  const whole = v / BigInt(10 ** 18);
  const frac = (v % BigInt(10 ** 18)).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
};

/** GEN typed by a person as wei, or "" when it is not a number. */
const toWei = (text: string) => {
  const m = /^(\d+)(?:\.(\d{1,18}))?$/.exec(text.trim());
  if (!m) return "";
  return (BigInt(m[1]) * BigInt(10 ** 18) + BigInt((m[2] || "").padEnd(18, "0") || "0")).toString();
};

const RESULT: Record<string, { text: string; tone: string }> = {
  met: { text: "met · tranche paid", tone: "yes" },
  not_met: { text: "not met · a miss", tone: "no" },
  unchanged: { text: "page unchanged · a miss, no model asked", tone: "no" },
  unreachable: { text: "page unreachable", tone: "no" },
};

const STATUS: Record<string, string> = {
  active: "active",
  completed: "completed · every tranche paid",
  halted: "halted · the funder may reclaim",
  reclaimed: "closed · remainder reclaimed",
  renounced: "closed · remainder handed back",
};

/** Hero illustration: a tranche opens for new, finished work and for nothing else. */
function Gate() {
  return (
    <div className="roundsbox" aria-hidden="true">
      <p className="q">Does the page show finished work for this tranche?</p>
      <div className="lane">
        <span>review 1</span>
        <span className="bar yes">“v0.1.0 released” → tranche 1 paid</span>
      </div>
      <p className="gap">⋮ a full review interval</p>
      <div className="lane">
        <span>review 2</span>
        <span className="bar no">same page again → a miss, no model asked</span>
      </div>
      <div className="lane">
        <span>review 3</span>
        <span className="bar no">“coming soon” → a miss</span>
      </div>
      <div className="lane">
        <span>result</span>
        <span className="bar final">halted · the rest returns to the funder</span>
      </div>
    </div>
  );
}

function Tranches({ paid, total }: { paid: number; total: number }) {
  return (
    <span className="confirm" title={`${paid} of ${total} tranches paid`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < paid ? "on" : ""} />
      ))}
    </span>
  );
}

export function TrancheGateApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [books, setBooks] = useState<Books | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [credit, setCredit] = useState("0");
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [grantId, setGrantId] = useState("docs/my-grant");
  const [grantee, setGrantee] = useState("");
  const [title, setTitle] = useState(DEMO_TITLE);
  const [progressUrl, setProgressUrl] = useState(DEMO_PAGE);
  const [criterion, setCriterion] = useState(DEMO_CRITERION);
  const [tranches, setTranches] = useState("2");
  const [interval, setIntervalSeconds] = useState("120");
  const [misses, setMisses] = useState("2");
  const [totalGen, setTotalGen] = useState("2");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ids, s, ev, b] = await Promise.all([
        listGrants(),
        getStats(),
        getEvents(),
        getBooks(),
      ]);
      setStats(s);
      setBooks(b);
      setEvents(ev.slice(-10).reverse());
      const loaded = await Promise.all(ids.map((id) => getGrant(id)));
      setRows((loaded.filter(Boolean) as GrantRow[]).reverse());
      const sched = await Promise.all(ids.map((id) => getSchedule(id)));
      setSchedules(
        Object.fromEntries(
          sched.filter(Boolean).map((x) => [(x as Schedule).grant_id, x as Schedule]),
        ),
      );
      if (address) {
        setGen(await getNativeBalance(address));
        setCredit(await getCredit(address));
      } else {
        setCredit("0");
      }
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** ACCEPTED and FINALIZED are different guarantees, so the UI shows both. */
  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  const run = async (name: string, fn: () => Promise<string | void>) => {
    if (!address || !provider) {
      setMsg("Connect MetaMask for writes");
      setOk(false);
      return;
    }
    setBusy(name);
    setMsg("");
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      await refresh();
      setMsg(`${name}: accepted by consensus`);
      setOk(true);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setOk(false);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;
  const totalWei = toWei(totalGen);
  const count = Number(tranches) || 0;
  const divides = totalWei !== "" && count > 0 && BigInt(totalWei) % BigInt(count) === BigInt(0);
  const same = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase();

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            Tranche<span className="accent">Gate</span>
          </h1>
          <p className="lede">
            A grant paid up front is a gift. A grant paid on the funder&apos;s say-so is a leash.
            Here the funder escrows the whole grant and fixes one progress page, one criterion and
            a schedule. Each period anyone can ask the network to read that page, and a tranche is
            paid only when <strong>validators agree it shows new, finished work</strong>. The
            funder cannot stop a grant that is being delivered. The grantee cannot be paid twice
            for the same page.
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            {stats && (
              <>
                <span className="chip">
                  grants <b>{stats.grants}</b>
                </span>
                <span className="chip hot">
                  paid to grantees <b>{fmtGen(stats.paid_out)} GEN</b>
                </span>
                <span className="chip">
                  returned to funders <b>{fmtGen(stats.returned)} GEN</b>
                </span>
              </>
            )}
            {books && (
              <span className="chip">
                held now <b>{fmtGen(books.balance)} GEN</b>
              </span>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · nobody is privileged ·{" "}
            <a href={CONTRACT_REPO}>contract source</a> · <a href={GITHUB}>this console</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {address && credit !== "0" && (
            <p className="verdictbox">
              The contract holds <strong>{fmtGen(credit)} GEN</strong> for you from a grant it
              refused to open.{" "}
              <button
                className="ghost tiny"
                disabled={!!busy}
                onClick={() =>
                  void run("withdraw_credit", () => withdrawCredit(acct, provider, onStage))
                }
              >
                take it back
              </button>
            </p>
          )}
          {walletError && <p className="msg">{walletError}</p>}
          {msg && <p className={ok ? "okmsg" : "msg"}>{msg}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized · payouts have landed</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Gate />
      </section>

      <div className="row">
        <section className="card">
          <h2>1 · Open a grant</h2>
          <p className="muted">
            The whole grant is sent with this transaction and held by the contract. Everything a
            review depends on is fixed here and has no setter. <code>review</code> later takes a
            grant id and nothing else.
          </p>
          <label htmlFor="grantId">Grant id</label>
          <input id="grantId" value={grantId} onChange={(e) => setGrantId(e.target.value)} />
          <label htmlFor="grantee">Grantee address (not your own)</label>
          <input
            id="grantee"
            placeholder="0x…"
            value={grantee}
            onChange={(e) => setGrantee(e.target.value)}
          />
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label htmlFor="progressUrl">Progress page (https)</label>
          <input
            id="progressUrl"
            value={progressUrl}
            onChange={(e) => setProgressUrl(e.target.value)}
          />
          <label htmlFor="criterion">Criterion for a tranche</label>
          <textarea
            id="criterion"
            rows={3}
            value={criterion}
            onChange={(e) => setCriterion(e.target.value)}
          />
          <div className="grid2">
            <div>
              <label htmlFor="totalGen">Grant (GEN)</label>
              <input id="totalGen" value={totalGen} onChange={(e) => setTotalGen(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tranches">Tranches (1–24)</label>
              <input id="tranches" value={tranches} onChange={(e) => setTranches(e.target.value)} />
            </div>
            <div>
              <label htmlFor="interval">Interval between reviews (s)</label>
              <input
                id="interval"
                value={interval}
                onChange={(e) => setIntervalSeconds(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="misses">Misses in a row that halt it (1–6)</label>
              <input id="misses" value={misses} onChange={(e) => setMisses(e.target.value)} />
            </div>
          </div>
          <p className="muted">
            {divides
              ? `${count} tranche(s) of ${fmtGen((BigInt(totalWei) / BigInt(count)).toString())} GEN. `
              : "The grant must divide evenly into the tranches. "}
            The fastest this grant can be fully paid is {span(count * (Number(interval) || 0))}{" "}
            from now, whoever calls and however often. The demo values are minutes so the flow is
            reproducible; a real grant would use weeks.
          </p>
          <button
            disabled={disabled || !grantId || !grantee || !title || !criterion || !divides}
            onClick={() =>
              void run("open_grant", () =>
                openGrant(
                  acct,
                  provider,
                  {
                    grantId,
                    grantee,
                    title,
                    progressUrl,
                    criterion,
                    tranches,
                    reviewInterval: interval,
                    missesAllowed: misses,
                    total: totalWei,
                  },
                  onStage,
                ),
              )
            }
          >
            {busy === "open_grant" ? (
              <span className="working">
                <span className="spinner" /> opening…
              </span>
            ) : (
              `escrow ${totalGen || "0"} GEN and open the grant`
            )}
          </button>
        </section>

        <section className="card">
          <h2>2 · What a review decides</h2>
          <ul className="decide">
            <li>
              <span className="tag">refused</span> before a full interval has elapsed since the
              last accepted review. Elapsed time, not a calendar window. The page is not even
              fetched.
            </li>
            <li>
              <span className="tag">met</span> validators agree the page states finished work for
              this tranche. One tranche goes to the grantee&apos;s wallet and the misses reset.
            </li>
            <li>
              <span className="tag">unchanged</span> the page is byte-for-byte the one that already
              earned a tranche. A miss, and no model is asked.
            </li>
            <li>
              <span className="tag">not met</span> plans, promises and “coming soon” are not work.
              A miss.
            </li>
            <li>
              <span className="tag">unreachable</span> the first outage is only noted; a second in
              a row is a miss.
            </li>
            <li>
              <span className="tag">reverts</span> a malformed model answer or a consensus failure
              records nothing and pays nobody.
            </li>
          </ul>
          <p className="muted">
            Enough misses in a row halt the grant, and only then can the funder take the unpaid
            remainder back. The grantee can hand the remainder back at any time.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <div className="head">
          <h2>Grants on chain</h2>
          <button className="ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "reading…" : "refresh"}
          </button>
        </div>
        {rows.length === 0 && !loading && <p className="muted">No grants yet.</p>}
        {rows.map((g) => {
          const s = schedules[g.grant_id];
          const last = RESULT[g.last_result];
          const remaining = s ? s.remaining : "0";
          return (
            <article className="card" key={g.grant_id} style={{ marginTop: "1rem" }}>
              <div className="head">
                <span className="id">{g.grant_id}</span>
                <span className="muted">
                  {STATUS[g.status] || g.status}
                  <Tranches paid={g.tranches_paid} total={g.tranches} />
                </span>
              </div>
              <p className="claimtext">{g.title}</p>
              <p className="hashline">
                page <a href={g.progress_url}>{g.progress_url}</a>
              </p>
              <p className="hashline">criterion: {g.criterion}</p>
              <p className="hashline">
                <strong>{fmtGen(g.total)} GEN</strong> in {g.tranches} tranche(s) of{" "}
                {fmtGen(g.tranche_amount)} · paid {fmtGen(g.paid_out)} · returned{" "}
                {fmtGen(g.returned)} · <strong>{fmtGen(remaining)} GEN</strong> still held
              </p>
              <p className="hashline">
                funder {short(g.funder)} · grantee {short(g.grantee)} · reviews ≥{" "}
                {span(g.review_interval)} apart · misses {g.misses}/{g.misses_allowed}
                {g.status === "active" && <> · next review from {utc(g.next_review_at)}</>}
              </p>
              {last && (
                <p className="hashline">
                  last review: <strong>{last.text}</strong>
                </p>
              )}
              {g.history.length > 0 && (
                <div className="outcomes">
                  {g.history.map((h, i) => (
                    <span key={i} className={`outcome ${h.result === "met" ? "final" : ""}`}>
                      {h.result.replace("_", " ")}
                      <small>
                        {utc(h.at)}
                        {h.content_hash ? ` · sha-256 ${h.content_hash.slice(0, 10)}…` : ""}
                      </small>
                    </span>
                  ))}
                </div>
              )}
              {g.injection_flags.length > 0 && (
                <p className="hashline">
                  instruction-like text flagged to the validators: {g.injection_flags.join(", ")}
                </p>
              )}
              {g.status === "active" && (
                <button
                  className="ghost"
                  disabled={disabled || (s ? !s.can_review : false)}
                  onClick={() => void run("review", () => review(acct, provider, g.grant_id, onStage))}
                >
                  {s && !s.can_review ? "review not accepted yet" : "run a review"}
                </button>
              )}
              {s?.can_reclaim && same(g.funder, address) && (
                <button
                  className="ghost"
                  style={{ marginLeft: "0.5rem" }}
                  disabled={disabled}
                  onClick={() =>
                    void run("reclaim", () => reclaim(acct, provider, g.grant_id, onStage))
                  }
                >
                  reclaim {fmtGen(remaining)} GEN
                </button>
              )}
              {s?.can_renounce && same(g.grantee, address) && (
                <button
                  className="ghost"
                  style={{ marginLeft: "0.5rem" }}
                  disabled={disabled}
                  onClick={() =>
                    void run("renounce", () => renounce(acct, provider, g.grant_id, onStage))
                  }
                >
                  hand the remainder back
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i} className={e.event === "Reviewed" && e.result !== "met" ? "broken" : ""}>
                <strong>{String(e.event)}</strong>{" "}
                <span className="muted">
                  {[
                    e.id,
                    e.result,
                    e.paid && e.paid !== "0" ? `paid ${fmtGen(String(e.paid))} GEN` : null,
                    e.amount ? `${fmtGen(String(e.amount))} GEN` : null,
                    e.total ? `${fmtGen(String(e.total))} GEN` : null,
                    e.status,
                    typeof e.at === "number" ? utc(e.at) : null,
                  ]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        TrancheGate on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes
        need MetaMask and test GEN. The demo progress pages are files in this repository, so every
        change to them is a public commit. Contract source:{" "}
        <a href={CONTRACT_REPO}>TrancheGateCore</a>.
      </footer>
    </main>
  );
}
