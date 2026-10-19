# TrancheGate — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997` |
| **Contract** | [`0x0B8853256eCD33984f007Dd869afEed1aDeE8e33`](https://explorer-studio-dev.genlayer.com/address/0x0B8853256eCD33984f007Dd869afEed1aDeE8e33) |
| **Deploy tx** | [`0xc355c982…539231`](https://explorer-studio-dev.genlayer.com/tx/0xc355c982f6abb0d934ea0a3e949998b8152525d4bf32918fedd4675001539231) from `0x73064D61A55Fdc895a87fA0432637CdBfc80B7a3`, which has no role in the contract |
| **Source** | [`contracts/TrancheGate.py`](contracts/TrancheGate.py) — runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| **Source sha256** | `8b6849b33ad780dcff9048cdc09c40a4228c1d373aaf2de153bacae1c5c4d279` |
| **Previous deployment** | `0x67aede124648dEb4749f0F96173F44df6F6d09D1` — [its run](docs/STUDIO_DEV_V1_RUN.md); superseded because its source failed the GenVM linter |

## What changed from the first deployment

The review of the first submission ran the current GenVM linter and found two problems. Both are fixed
in this source and nothing else changed:

- **E022.** `_remaining` was a `@staticmethod` inside the contract class. It is now the module-level
  function `remaining_of(grant)`; every method of `TrancheGate` takes `self`.
- **Bare `Exception`.** All 28 deliberate refusals now raise `gl.vm.UserError`. On chain the
  refusal text is returned as the error payload (rows 3, 4 and 7 below).

## Lint

```bash
pip install genvm-linter
sh scripts/lint_current_sdk.sh
```

The script runs `genvm-lint lint` on the deployed file, then `genvm-lint check` and
`genvm-lint typecheck` on a copy whose header and imports are switched to the public runner
`1jb45aa8…` from GenVM v0.3.0-rc7. That copy step exists because Studio Dev accepts only runner
`5jycge4q…`, which is in no public GenVM release, so the linter cannot download its SDK; the public
runners `1jb45aa8…` and `1zr6nqk5…` are both refused by Studio Dev with `invalid_contract runner
malformed`. Result: `Lint passed (3 checks)`, `Validation passed`, `No type errors found`. CI runs
the same script on every push.

## Verify the source yourself

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0x0B8853256eCD33984f007Dd869afEed1aDeE8e33"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/TrancheGate.py
# both print 8b6849b33ad780dcff9048cdc09c40a4228c1d373aaf2de153bacae1c5c4d279
```

## The run

| Role | Address |
|---|---|
| funder | `0xf4B860c3F4ce6017e48aDC30FE71266B1aDbB093` |
| grantee | `0x763a07fec6a7AbCc694B79aBec11bd72E5Ff4434` |
| stranger (triggers every review) | `0xE623d14C4D5615AbE3bF7fa5a685Ba9b26F8E705` |

| # | Call | Sender | Result | What happened | Tx |
|---|------|--------|--------|---------------|----|
| 1 | `open_grant(docs-1)` value 2 GEN | funder | SUCCESS | `docs-1`: 2 GEN in 2 tranches, reviews 60 s apart, 1 miss halts it. Page pinned at commit `143c456` | [`0x1aa3868d…456911`](https://explorer-studio-dev.genlayer.com/tx/0x1aa3868d32c8c9853a85dda7d6c6f35f8d59ef41f7db6746bfe14e41e0456911) |
| 2 | `open_grant(uneven)` value 1 GEN | **stranger** | SUCCESS | value 1 GEN + 1 wei for 2 tranches: refused in the return value (does not divide evenly), the whole amount booked as the stranger's credit | [`0x334d9deb…6474d6`](https://explorer-studio-dev.genlayer.com/tx/0x334d9deb3754cb9fcdfb57559b8c62bbf742ced967bd3bd733d71324d16474d6) |
| 3 | `review(docs-1)` | stranger | **ERROR** | **UserError** `too early: the next review opens at …` — the page is not fetched | [`0x1da19369…2608d3`](https://explorer-studio-dev.genlayer.com/tx/0x1da193691090145a6bbae36bdcef75406b986d186d02e8bd0e3f37bf342608d3) |
| 4 | `reclaim(docs-1)` | **funder** | **ERROR** | **UserError** `only a halted grant can be reclaimed` — the funder cannot cancel an active grant | [`0x52306fee…5cc015`](https://explorer-studio-dev.genlayer.com/tx/0x52306fee32a9481abcaa45233f76420deaeb0852fa7b9333220b12a6f25cc015) |
| 5 | `review(docs-1)` | stranger | SUCCESS | FINALIZED. Validators: **met**. Tranche 1 paid: grantee wallet 100 → 101 | [`0x27f4e855…351dab`](https://explorer-studio-dev.genlayer.com/tx/0x27f4e855c94d64bfafc1a0d97ea004fe25ba35d7ada99ddd806534395a351dab) |
| 6 | `review(docs-1)` | stranger | SUCCESS | FINALIZED. Same page, same hash `7d47cf9f0994…` → **unchanged**, decided in code, no model asked. 1 miss → **halted** | [`0xf8e71614…8a307e`](https://explorer-studio-dev.genlayer.com/tx/0xf8e716140f629248c15cd68d8be1294e09fc80781668c7738ff8017a838a307e) |
| 7 | `reclaim(docs-1)` | **stranger** | **ERROR** | **UserError** `only the funder may reclaim` | [`0xaa0d62b5…62a79c`](https://explorer-studio-dev.genlayer.com/tx/0xaa0d62b5c6d477456ea9ee5cd97a59ef1aa7cbdfed9111857b8cd8ee6e62a79c) |
| 8 | `reclaim(docs-1)` | funder | SUCCESS | FINALIZED. The unpaid tranche returns to the funder | [`0x69469ab1…739cd0`](https://explorer-studio-dev.genlayer.com/tx/0x69469ab184bb85a96c695762b7a3b9f75fa4f5029ed88a233b34483fd9739cd0) |
| 9 | `withdraw_credit()` | stranger | SUCCESS | FINALIZED. The refused 1 GEN + 1 wei returns; credits 0 | [`0x01daea0a…c6d4a0`](https://explorer-studio-dev.genlayer.com/tx/0x01daea0a44796eefa4b8e7e4d618b21c8b46bcecfafdcdf8746b516fabc6d4a0) |

End state, read from chain:

```
get_stats     {"grants":1,"by_status":{"reclaimed":1},"paid_out":"1000000000000000000","returned":"1000000000000000000"}
get_balance   {"balance":"0","credits":"0","escrowed":"0"}
funder        100 → 98.9997   (2 GEN escrowed, 1 GEN returned)
grantee       100 → 101.0000  (+1 GEN)
stranger      100 → 99.9994   (the refused 1 GEN came back; the rest is fees)
```

The longer story of one page changing over four reviews (met, met, unchanged, "coming soon" not
met) is in the [first run](docs/STUDIO_DEV_V1_RUN.md); the review logic is unchanged.

## Notes on Studio Dev

- The header must be `# v0.3.0` followed by the pinned `Depends` line.
- Every transaction carries a fee deposit (`genlayer-js@2.0.0-rc.1`, `studioDevnet`, `estimateTransactionFees`).
- A payout reaches the wallet when the transaction is finalized, not when it is accepted.
