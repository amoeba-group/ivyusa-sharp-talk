# SharpTalk × Go2Joy — Work Request (tasks for Go2Joy)

> Work request listing what Go2Joy needs to do, by owner (2026-10-27 · v1.4). HA developers: read the checklist at the top together with the [HA integration spec v1.4](ha-identify.en.html). For printing or sending: [PDF](work-request.en.pdf)

| Item | |
|---|---|
| To | Go2Joy PM · HA dev team (backend · FE) · Go2Joy dev (Partner API) · Infra · Operations (CS) · Legal |
| From | SharpTalk (Amoeba) |
| Date / version | 2026-10-27 · **v1.4** (replaces v1.3 of 10/24) |
| Based on | ① [HA sign-in integration spec v1.4](GUIDE-261024-Go2Joy-HA-Identify-v1.4.en.md) (doc revision 10/27, wire format unchanged) ② Integration requests & checklist (G numbers, 2026-10-22) ③ Go2Joy Support Assistant API document and public Partner API docs (checked 10/23, re-checked 10/27: no change) ④ Internal review of WR v1.3 + spec v1.4 (10/26) and staging / HA UAT checks (10/26 – 10/27) |
| Reply | Per-task completion report, or the reply table in §8 — daily check-in channel (WR-40) |

## ✅ What HA (Go2Joy) must do — checklist

Spec v1.4 is final (approved 10/24). How to check each item, plus sample code, is in the checklist at the top of the [HA integration spec v1.4](GUIDE-261024-Go2Joy-HA-Identify-v1.4.en.md).

- **Backend (WR-01 · 02, due Tue 10/27)**: ☐ secret only in a server environment variable ☐ endpoint for signed-in sessions only ☐ values from the session and DB ☐ `userId = "ha:" + userSn` ☐ only 4 attributes `hotel_id · hotel_name · province_sn · role` ☐ `province_sn` = Go2Joy provinceSn ☐ role code + **send the code list** ☐ "all hotels" → `role` only ☐ NFC → collapse whitespace → trim → 120 chars ☐ drop empty values and an email that is not a valid address ☐ HMAC-SHA256 ☐ **test vectors T1 – T6 match, results sent back** ☐ never log the package
- **FE (WR-04, due Wed 10/28)**: ☐ remove browser assembly and `hash: "testing"` ☐ pass the server response to `identify` unchanged ☐ re-identify on sign-in, reload, **hotel change**, language change ☐ `logout` on sign-out, session expiry, account switch, sign-out in another tab ☑ keep `locale` (done 10/27) ☑ CSP and CORS on UAT (done 10/27) ☐ one setting for the SharpTalk domain
- **UAT (WR-05, 10/29 – 30)**: ☐ pass the spec's **§8 checklist (the only UAT list)** ☐ north and south test accounts
- **Production (WR-06)**: ☐ production secret ☐ production domain `sharptalk.go2joy.vn` ☐ production CSP, CORS, release schedule shared

## Changes in v1.4 (10/27)

- **Do not trust `ok: true` alone (WR-04, S-06).** While staging accepts unsigned sign-ins for UAT, a wrong signature also returns 200, `consentState: "granted"` and `identified {ok: true}`. Proof of a correct signature is `"authenticated": true` in the identify response and "verified" (not "Unverified") in the console. SharpTalk turns the temporary mode off **as soon as a verified identify is seen on HA UAT, before the joint UAT**, so the 401 checks can pass.
- **No province is in region 3 (Central).** Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai are region 5 (South Center) and Thừa Thiên Huế is region 4 (North Central) in the Province Feed. WR-10 and the UAT now use the 4 regions that exist.
- **One UAT checklist**: spec §8. §6.1 here points to it.
- **The AI provider receives the staff display name** (with hotel name, province, region and role), so it can greet and answer in context. Email, phone and the user id are not sent. Corrected for WR-30.
- **Why the South team still has no active agent (WR-11)**: invited agents who sign in with the temporary password stay "invited" and are not assigned; only setting a password through the invitation link makes them "active". Several Go2Joy agents (South team included) already work in the console this way. SharpTalk fixes this (S-13); until then, use the invitation link.
- Staging figures updated (§2.3): 12 accounts, 3 active, and **all 3 active accounts are Amoeba / test accounts** — no enquiry has been assigned to a Go2Joy agent yet. 11 of 12 accounts are master.
- New SharpTalk work: S-13 (invited → active on first sign-in), S-14 (hyphenated province name stored as a wrong region, e.g. Bà Rịa - Vũng Tàu), S-15 (duplicate sign-in rows in the work log), S-11 now includes the privacy policy URL, S-07 now registers the HA production origin.
- Deadlines of 10/26 have passed: WR-02, WR-23 (filing) and WR-40 are overdue. New WR-40a: confirm the dates (10/31 is a Saturday).
- HA UAT re-checked 10/26 – 10/27: D1 – D6 unchanged; D7 (locale) and CSP / CORS done; D8 partial; D9 (hotel change) not called.

## 0. Summary

- SharpTalk's phase-1 features (signature verification, hotel = business customer, conversation continuity, consult category × region routing, alerts, hotel profile and room types) are **deployed and working on staging**. Spec v1.4 support is on staging since 10/24.
- **HA UAT is still unsigned** (re-checked 10/27): the package is built in the browser with `hash: "testing"`, the login ID as `userId`, 5 unknown keys, and a province name as `region`.
- **No enquiry has reached a Go2Joy agent yet.** The South team has no active agent (WR-11 · S-13), there is no default assignee (WR-13), and the only active accounts belong to Amoeba. Southern and central hotels, skipped categories and "all hotels" enquiries alert everyone.
- **Staging open on 10/31 (Saturday — please confirm, WR-40a)** needs: WR-01 · 02 · 04 · 05 · 10 – 14 · 40.
- **Production open** additionally needs WR-06 · WR-20 – 23 · WR-30 · 31. Earliest **11/10 – 11/11**, counted from the Partner API production credential (WR-23, about one week after filing) plus installation (4 working days) and production UAT (3 working days).

## 1. Integration spec history

Parts of HA were built from the v1.0 PDF, so the differences between versions are in one table. **The v1.4 column is the final spec.** SharpTalk released spec v1.4 and its test vectors on 10/24 (S-01) and accepts v1.4 on staging (S-02).

| Item | v1.0 (10/20 PDF, withdrawn) | v1.3 | **v1.4** |
|---|---|---|---|
| `userId` | Login ID (`go2joysupport`) | `"ha:" + userSn` | Same as v1.3 |
| Signed attribute keys | 5: `hotel_id` · `hotel_name` · `province` · `region` · `role` | 5 (same) | **4**: `hotel_id` · `hotel_name` · `province_sn` · `role` |
| Province | `province` = province name (`Hồ Chí Minh`) | Same | `province_sn` = Go2Joy `provinceSn` (Province Feed `sn`, e.g. Hồ Chí Minh = `"1"`) |
| Region | Derived by HA, 3 values | Derived by HA, 5 codes | **Not sent.** SharpTalk derives it from Province Feed `region` |
| Role | Display name (`Lễ tân`) | Same | **HA role code** (independent of UI language); code list returned in WR-01 |
| Normalisation | trim · 120 chars | + NFC | Fixed order: **NFC → collapse whitespace → trim → 120 chars (`mb_substr`)** |
| "All hotels" selected | Not specified | Re-identify only | Drop the 3 hotel keys, sign `role` only → default assignee (WR-13) |
| Empty values | Empty attributes and email dropped | Same | Empty `name` · `email` · `phone` are dropped as fields too (empty or malformed email → 400, the whole sign-in fails) |
| Test vectors | T1 · T2 (old userId) | T1 – T5 | **T1 – T6** (T6 = decomposed Unicode input). Earlier vectors are not used |

**Transition**: for a while SharpTalk also accepts the v1.3 keys (`province` · `region`); routing prefers v1.4 values. This ends in a separate release after HA passes UAT on v1.4; the date is announced in advance.

How SharpTalk derives the region: Province Feed `region` `1` → `south`, `2` → `north`, `4` → `north_center`, `5` → `south_center`. `3` → `central` exists in the documentation but **no province uses it today**. The undocumented `10` (17 Manila cities) is stored as `region_10` until WR-27 is answered.

## 2. Status (2026-10-27)

### 2.1 Ready on the SharpTalk side (staging)

| Feature | Status |
|---|---|
| Signed identify verification (v1.4 and v1.3), HA terms recorded as widget consent (no consent banner), staff name in the first greeting | Done |
| Hotel = business customer, staff = contact, B2B / B2C split, conversation continuity per hotel account | Done |
| Consult categories: on "talk to an agent" or an AI handoff the widget asks what the enquiry is about (skippable); choice × hotel region → team × job label | Done (10/24) |
| Alarm center: assignee, rule, category, hotel, region; acknowledge vs dismiss; personal settings | Done (10/24) |
| Assignment check (simulator) and rule warnings | Done (10/24) |
| Several sessions of the same customer or hotel merged into one room | Done (10/23) |
| AI notice line under the widget with a terms link; header button visibility | Done (10/23) |
| Satisfaction request and automatic close after an answer; "agent is late" notice and callback request | Done (10/27) |
| Replies and buttons in the selected language (vi / en), live-chat title "staff / hotel", transcript search | Done |
| Partner API: hotel info and room types → company profile and per-hotel products; province index (80 provinces, number → name and region) refreshed daily | Done — staging credential |
| Stopgap for current HA data: province name sent as `region` → region from the index | Done (10/23) — **hyphenated names fail** (S-14) |
| Names in plain text on console lists and masked in logs. **The AI provider receives the staff display name, hotel name, province, region and role** (to greet and answer in context); email, phone and the user id are not sent | Done |

### 2.2 HA UAT findings (10/23, re-checked 10/26 and 10/27)

Read from the embed code on the HA UAT page (`window.sharptalkSignIn`) and SharpTalk staging logs.

| # | Item | HA today | v1.4 | Status |
|---|---|---|---|---|
| D1 | Signature | Package built in the browser, `hash: "testing"` | HA server signs with HMAC-SHA256 | Not started |
| D2 | `userId` | Login ID (`go2joysupport`) | `"ha:" + userSn` | Not started |
| D3 | Attribute keys | 5 + `hotel_code` · `hotel_group_id` · `user_id` · `user_sn` · `district` | Only the 4 | Not started |
| D4 | Region | Province name in `region` | Not sent | Not started (SharpTalk stopgap) |
| D5 | Province / role values | Display names (`Hồ Chí Minh`, `Lễ tân`) | `province_sn` · role code | Not started |
| D6 | Normalisation | Not applicable (built in the FE) | NFC → whitespace → trim → 120 | Not started |
| D7 | `locale` | `localStorage.lang` → `vi` / `en`, `setLocale` on change | Same | **Done** |
| D8 | Sign-out | `logout` on the sign-out button and on token expiry | + account switch, other tab (`storage` event) | Partial |
| D9 | Hotel change | `identify` is called once at start-up | Re-identify on every change, including "all hotels" | Not done |
| — | CSP / CORS | No restriction on UAT, the widget loads | Allow the SharpTalk domain | **Done on UAT** (production is WR-06) |

### 2.3 go2joy staging routing set-up (read 10/27)

Values Go2Joy operations entered in the console. Settings › Agent handoff › **Assignment check** shows the same result for a given category and region.

| Item | Now |
|---|---|
| Consult categories (shown to customers) | `bs` Business Support · `cs` Customer Services — **no Vietnamese names** (Vietnamese screens show English) |
| Teams | North · North Center · South · South Center |
| 12 accounts | **3 active — all Amoeba / test accounts** (North 1, North Center 2) · **9 invited** (North 3, North Center 1, South 4, South Center 1), including all 6 @go2joy.vn accounts |
| Ranks | 11 of 12 accounts are master (full tenant rights) |
| Job labels | `cs` · `sa` (also consult · accounting · operations). The one active North agent holds both `sa` and `cs` |
| Default assignee | **None** |

| Rule | Category | Hotel region | Target | Result now |
|---|---|---|---|---|
| BS_North_SA | bs | north · north_center | North team × sa | Assigned (1 active — an Amoeba account) |
| CS_North_CS | cs | north · north_center | North team × cs | Assigned (same person) |
| CS_South | cs | south · south_center | South team × cs | **Skipped — 0 active** |
| BS_South_SA | bs | south · south_center | South team × sa | **Skipped — 0 active** |

- **The North Center and South Center teams** are not the target of any rule; north-central hotels also go to the North team.
- **No province is in region 3 (Central).** Central-coast hotels (Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai …) follow the South rules (region 5); Thừa Thiên Huế follows the North rules (region 4).
- A customer who **skips** the category, an enquiry no rule matches, Manila (`region_10`) and "all hotels" go to the default assignee — and with none set, to an "everyone — no rule matched" alert.
- Real enquiries #906 and #907 (MAI VILLA HÀ NỘI, 10/26) were assigned to the Amoeba account on the North team.
- 4 of 7 hotel profiles have no province or region yet (1721, 4495, 726, 4162). Unsigned sign-ins do not update company profiles; a signed v1.4 sign-in fills them. Routing is not affected (it uses the session's region).
- Rule region conditions use the region SharpTalk derives, so the rules need no change after the move to v1.4.

## 3. Work items

**P0-S** 10/31 staging open · **P0** production open · **P1** production quality · **P2** phase 2 and later. Due dates are SharpTalk's proposal; if one does not work, write a feasible date in the reply table (§8). **Overdue** = the proposed date has passed.

### 3.1 HA dev team — backend

| WR | Task | Detail | Done when | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|---|
| WR-01 | **Signing endpoint** | An API called with the login session (e.g. `GET /api/v1/staff/sharptalkIdentity`) builds and signs the package on the server.<br>① `userId = "ha:" + userSn`<br>② 4 attributes: `hotel_id` · `hotel_name` · `province_sn` · `role` (role code). No `region`<br>③ "All hotels": drop the 3 hotel keys, sign `role` only<br>④ Normalise in this order: NFC → collapse whitespace → trim → `mb_substr(…, 0, 120)` (PHP `intl`)<br>⑤ Drop empty values, in attributes and in `name` · `email` · `phone`. Also drop an email that is not a valid address — a malformed email, a `userId` over 120 chars, a name over 200 or a phone over 40 returns 400 and the whole sign-in fails<br>⑥ `hash = hex(HMAC-SHA256(embed secret, signing string))`<br>⑦ Read values from the HA session and DB, never from the browser | Spec v1.4 test vectors **T1 – T6** match + **HA role code list** (code · vi/en label) sent back | P0-S | Tue 10/27 | Not started | G10 · D1 – D6 |
| WR-02 | **Signing key decision** | **Option A (recommended)**: the embed secret SharpTalk issues, kept only in an HA server environment variable; SharpTalk sends the staging secret over a secure channel the same day (S-03).<br>**Option B**: reuse the Go2Joy client secret; SharpTalk must add input for a partner-supplied secret (S-04), and a leak would also expose Partner API access.<br>**No decision yet: staging proceeds with option A**; the choice can be revisited before production (same spec and code, only the secret value changes). | Decision + staging secret in place | P0-S | Mon 10/26 | **Overdue** | G12 |
| WR-03 | Signature expiry (`ts`) | Whether to add a signing time to stop package reuse. A 5-minute expiry like the Partner API's means both sides change the spec together | Yes / no | P1 | 11/06 | Open | G16 |

### 3.2 HA dev team — FE and deployment

| WR | Task | Detail | Done when | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|---|
| WR-04 | **Fix the embed** | ① Pass the WR-01 response to `identify` **unchanged** (no assembling or editing in the browser); remove `hash: "testing"`<br>② Call it when sign-in is confirmed · on page reload · **whenever the selected hotel changes (including "all hotels")** — today it is called once at start-up · when the HA language changes<br>③ Call `logout` on the sign-out button and token expiry (done) · just before signing in as another account · when another tab signs out (`storage` event) — missing<br>④ `locale` (done 10/27)<br>⑤ CSP and CORS (done on UAT 10/27)<br>⑥ Put the 3 SharpTalk domain uses (`embed.js` src · `widgetUrl` · `ivy:event` origin check) behind one environment setting | identify **200 with `"authenticated": true`**, and the console shows the session as "verified" (not "Unverified"). `ok: true` alone is not proof while staging still accepts unsigned sign-ins | P0-S | Wed 10/28 | Partial (④ ⑤) | G11 · D1 · D8 · D9 |
| WR-05 | Joint UAT | Run the **spec §8 checklist** (the only UAT list) together with SharpTalk, **after S-06** | Signed-off result table | P0-S | 10/29 – 10/30 | Open | G13 |
| WR-06 | **HA production deploy** | ① Deploy WR-01 · WR-04 to HA production<br>② Production embed secret (different from staging; S-08)<br>③ Production SharpTalk domain: `https://sharptalk.go2joy.vn/widget/embed.js` · `widgetUrl` · origin check<br>④ Production CSP and CORS<br>⑤ Share the HA release schedule in advance | identify 200 with `"authenticated": true` on production HA; a package signed with the staging secret gets 401 | P0 | Before production UAT | Open | G11 · G1 |

### 3.3 Go2Joy operations (CS)

| WR | Task | Detail | Done when | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|---|
| WR-10 | **Confirm the routing rules** | Check the 4 rules in §2.3.<br>① Should the **North Center and South Center teams** receive enquiries? If yes, split the rules by region or add them as targets<br>② Central-coast provinces (Đà Nẵng, Quảng Nam, Bình Định, Khánh Hòa, Gia Lai …) are region 5 "South Center" in the Province Feed and Thừa Thiên Huế is region 4 "North Central"; no province is in region 3. With the current rules they go to the South / North teams — confirm this is intended, or list exception provinces<br>③ The one active North agent holds both `sa` and `cs` — confirm<br>④ The Philippines (`region_10`) is phase 2 | Written confirmation (or edit in the console and tell us); no warnings in the assignment check | P0-S | 10/27 | Partial | G20 |
| WR-11 | **Activate agents, complete the roster, set ranks** | **Each invited agent sets a password through the invitation link** (signing in with the temporary password keeps the account "invited" and unassigned — SharpTalk fixes this in S-13; after that, signing in once is enough). At least one active Go2Joy agent per team, South and South Center above all. Send each person's rank: 11 of 12 accounts are master (full rights). Send name · email · team · job label (cs / sa) for anyone missing | Every team has an active **@go2joy.vn** agent; no "0 active" warning; ranks set | P0-S | 10/27 | Partial | G21 |
| WR-12 | **Define the consult categories and name them** | When to pick Business Support and when Customer Services (1 – 2 lines each), and the **Vietnamese display names** (shown as-is on the widget card). Whether to split further (e.g. settlement / contract) | Vietnamese names show in the Vietnamese widget | P0-S | 10/27 | Partial | G22 |
| WR-13 | **Hours, absence order, default assignee** | Working hours per team (HCM time zone), order when nobody is available (proposal: backup agent → team queue → offline message). The **default assignee** — today none, so these alert everyone: skipped category, southern / central hotels while South has 0 active, Manila, "all hotels" | Assignment check "category skipped" → default assignee | P0-S | 10/27 | Open | G23 |
| WR-14 | **UAT test accounts** | One `Quản lý` (several hotels, used to test hotel change — D9) + one `Lễ tân` (one hotel), covering **north and south** hotels and at least one hotel name with Vietnamese diacritics | Accounts sent over a secure channel | P0-S | 10/27 | Partial (one southern account) | G13 |
| WR-15 | Reconnect the Notion knowledge source | The 3 sources were reconnected on 10/22 and sync normally | — | P0 | — | **Done** | G30 |
| WR-16 | Knowledge conflict decisions | The 78 items classified on 10/15: which side to keep | Decision table | P1 | 11/06 | Open | G31 |
| WR-17 | Golden set review | Confirm the answers of the 44 `#Talk-4-Hotel` questions | Review result | P1 | 11/06 | Open | G32 |
| WR-18 | Widget visibility and resume window | Current defaults: the widget shows the user's own conversations + "n earlier enquiries from this hotel"; the AI sees the hotel's previous conversation; the same agent is preferred for 24 hours (a chosen category takes the rules first) | Keep / change | P1 | 11/06 | Confirm | G14 · G15 |
| WR-19 | Zalo OA · ZNS templates | To send agent alerts over Zalo too | Approved OA and templates | P1 | TBD | Open | G24 |
| WR-19a | Agent alert settings | Each agent sets, under 🔔 › Settings: alert scope, sound, **allow desktop notifications**, mail | Set for every agent | P1 | 10/30 | Open | — |

### 3.4 Infrastructure · Partner API go-live

| WR | Task | Detail | Done when | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|---|
| WR-20 | **Production server + SSH + DNS + TLS** | `sharptalk.go2joy.vn` (no DNS record as of 10/27), Vietnam region. Pilot 4 vCPU / 8 GB / 80 GB; production 8 vCPU / 16 GB / 200 GB or more. Daily backup storage. **Static public IP** (WR-23 allow-list) and **NTP time sync** (the Partner API `timestamp` expires after 5 minutes) | SSH access and static IP delivered, DNS resolves | P0 | 10/30 | Open | G1 |
| WR-21 | **Production AI API keys (Go2Joy account and billing)** | Answer LLM (Anthropic Claude recommended) and embeddings (Voyage). Monthly limit and who receives exhaustion alerts | Keys delivered over a secure channel | P0 | 10/30 | Open | G2 |
| WR-22 | Mail sender account | SMTP for agent alert mails | Account delivered | P1 | 10/30 | Open | G3 |
| WR-23 | **Partner API production certification, credential and IP allow-list** | Go-live procedure in the document: certification request (about one week) → 3 test bookings → production clientId · secret → 3 more bookings. **SharpTalk uses no booking API**, so we ask for an exemption and a lookup-API connection test instead. Allow the SharpTalk production static IP on `https://partner.go2joy.vn` (about 500 requests/minute) | Request filed → exemption answered → credential delivered, connection test passes | P0 | File 10/26 · credential by 11/02 | **Filing overdue** | G18 |

### 3.5 Go2Joy dev — Partner API questions

Where the Support Assistant API document (unchanged 10/23 – 10/27) and staging measurements differ. Replies only; Go2Joy decides whether anything needs fixing.

| WR | Question | Docs / observed | Prio | Ref |
|---|---|---|---|---|
| WR-24 | Partner staging vs HA UAT database | Hotel 4118: 21 rooms in Partner / 7 in HA, different prices and hours. Is production one database? | P1 | G19 ① |
| WR-25 | Room status codes | The docs define `status` 1 Available · 2 Locked, but we observe 1 · 4 · 5 | P1 | G19 ② |
| WR-26 | Room count | `numOfRoom` is always 2147483647 ("cannot be determined"). Is there a field for a hotel's total number of rooms? | P1 | G19 ③ ⑥ |
| WR-27 | Region `10` and region `3` | The documented enum is 1 – 5, but the feed returns 17 Manila cities with `10`, and no province with `3`. Name and meaning of `10`; will any province get `3`? | P1 | G19 ⑤ |
| WR-28 | Hourly lookup error | Room Type List with `bookingType=1` returns `code 0`. SharpTalk re-checks its own request with `startTime` · `endTime` first (S-09) | P2 | G19 ⑦ |
| WR-29 | Hotel Feed coverage and behaviour | Does it include every HA hotel (4118 is missing)? Is returning everything when no hotel matches intended? | P2 | G18 · G34 |
| — | Document errata | Hotel Info path `getHotelnfo` (should be `getHotelInfo`); Room Type Feed v1 path shows a v2 response example; does the go-live booking test apply to a lookup-only partner? | P2 | G19 ⑧ |

### 3.6 Legal

| WR | Task | Detail | Done when | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|---|
| WR-30 | **Privacy / PDPL review** | Cross-border transfer notice (processors Anthropic · Voyage, processing regions), whether a transfer impact assessment is needed, masking scope, conversation retention (draft 180 days), breach notification procedure. **Review on the basis that the AI provider receives the staff display name, hotel name, province, region and role** (§2.1) | Written reply | P0 | 10/30 | Open | G4 |
| WR-31 | **Terms URL and version, AI notice, privacy policy URL** | Set on staging: terms `https://go2joy.vn/vi-vn/policy?tab=terms-of-use`; notice VI "Được tạo bởi AI, áp dụng **điều khoản dịch vụ**" / EN "Created by AI; apply **terms of service**". Missing: the **terms version** and a **privacy policy URL** (the consent notice has no policy link today) | Confirmation with version + privacy policy URL | P0 | 10/30 | Confirm | G5 |

### 3.7 PM

| WR | Task | Detail | Prio | Due (proposed) | Status | Ref |
|---|---|---|---|---|---|---|
| WR-40 | **Owners and channel** | Owners for PM, HA backend / FE, infra, Partner API, operations (CS lead), legal, and the daily check-in channel | P0-S | 10/26 | **Overdue** | G6 |
| WR-40a | **Confirm the dates** | 10/31 is a Saturday — confirm a Saturday staging open. Production earliest 11/10 – 11/11 (§5) | P0-S | 10/28 | Open | — |
| WR-41 | Phase-2 schedule | B2C before / after booking, booking-completed webhook, app / web embed, HA menu (iframe · SSO), reception agents, point billing, Zalo conversations, contract terms | P2 | November | Open | G40 – G47 · G7 |
| WR-42 | Business name and address needed? | SharpTalk can read the **hotel address** from Hotel Feed (except hotels missing from it, WR-29). A **registered business name** would be a signed key in a phase-2 spec (v1.5); do not send it before then | P2 | With WR-41 | Open | — |

## 4. SharpTalk work

| # | Work | Starts when | Due | Status | Prio |
|---|---|---|---|---|---|
| S-01 | Spec v1.4: change history, PHP sample (with NFC), test vectors T1 – T6 (cross-checked with PHP 8.3 + intl). Doc revision 10/27 | — | 10/26 | **Done** 10/24 · revised 10/27 | P0-S |
| S-02 | Accept v1.4: `province_sn` → name and region from the province index (80), role codes, v1.3 keys in parallel | — | 10/27 | **Done** 10/24 on staging | P0-S |
| S-03 | Send the staging embed secret over a secure channel | WR-02 (option A by default) | Same day | Waiting for an HA backend owner (WR-40) | P0-S |
| S-04 | Input for a partner-supplied secret | WR-02 option B | After the decision | Conditional | — |
| S-05 | Enter rules, Vietnamese category names, default assignee and hours from Go2Joy's reply; remove the Amoeba / test accounts from go2joy routing once Go2Joy agents are active; share the assignment-check result | WR-10 – 13 | Same day | Waiting | P0-S |
| S-06 | **End the temporary unsigned mode** on staging and set host terms trust back to "signed" | **A verified identify seen on HA UAT** (WR-01 · WR-04) — **before** WR-05 | ≤ 10/28 | Waiting | P0-S |
| S-07 | Install SharpTalk on the Go2Joy server (VN profile), move the go2joy tenant, knowledge, province index, rules, categories and notice text, re-index, connect the Partner API (within ~500/minute), and **register the HA production origin in the tenant's allowed embed origins** | WR-20 · 21 · 22 · 23 | 4 working days | Waiting | P0 |
| S-08 | Send the production embed secret (different from staging) | WR-20 | Before WR-06 | Waiting | P0 |
| S-09 | Re-check the hourly lookup request (`startTime` · `endTime`) before asking WR-28 | — | 10/27 | Open | P2 |
| S-10 | Zero-downtime secret rotation (old and new accepted during a window) + procedure in the spec | — | 11/06 | Open | P1 |
| S-11 | Enter the terms version and the privacy policy URL | WR-31 | Same day | Waiting | P0 |
| S-12 | Clean up knowledge conflicts | WR-16 | 1 – 2 days | Waiting | P1 |
| S-13 | **Invited → active on first sign-in** (an invited agent who signs in with the temporary password becomes assignable) | — | 10/28 | Open | P0-S |
| S-14 | **Hyphenated province names in the stopgap** (Bà Rịa - Vũng Tàu was stored as region `bà_rịa_vũng_tàu`, so hotel 4162 matched no rule); keep a wrong region from being stored as signed | — | 10/28 | Open | P0-S |
| S-15 | Duplicate sign-in rows in the work log when two identify calls for the same session arrive together | — | 11/06 | Open | P1 |
| S-16 | Spec v1.4 / WR in ko · en · vi + PDF on /manual/go2joy | — | 10/27 | **Done** (this version) | P0-S |

## 5. Timeline and dependencies

```
Mon 10/26  (overdue) WR-02 key decision · WR-40 owners · WR-23 filing
Tue 10/27  WR-01 signing endpoint + T1–T6 + role code list · WR-10–14 rules, activation, categories, default assignee, accounts
           SharpTalk: S-16 docs v1.4 · S-09
Wed 10/28  WR-04 FE fix → identify 200 with "authenticated": true, console "verified"
           SharpTalk: S-06 right after that · S-13 · S-14
10/29–30   WR-05 joint UAT on spec §8 (after S-06) · WR-19a alert settings · WR-20/21/22
Sat 10/31  Staging open (to confirm, WR-40a)

Production open = the day all three are done
  ① WR-23 filed → credential about one week later
  ② then S-07 install (4 working days, needs WR-20 · 21 · 22) → production UAT (3 working days, needs WR-30 · 31)
  ③ WR-06 HA production deploy (needs S-08)
  → earliest 11/10 – 11/11, later by every day WR-23 filing slips
```

- If WR-01 or WR-04 is late, staging can only open with the temporary unsigned mode. We recommend not starting real agent service in that case.
- If WR-11 and WR-13 are late, southern and central hotels keep alerting everyone.

## 6. Done criteria

### 6.1 Staging open

**The joint UAT uses one list: [spec v1.4 §8](GUIDE-261024-Go2Joy-HA-Identify-v1.4.en.md).** It runs after S-06, so the 401 rows can pass.

### 6.2 Production open

| Check | Expected |
|---|---|
| Sign in to production HA → widget (`sharptalk.go2joy.vn`) | identify 200 with `"authenticated": true` (production secret); the key spec §8 rows pass again |
| Send a package signed with the staging secret to production | 401 (environments are separate) |
| HA production origin | Registered in the tenant's allowed embed origins; the widget works with origin enforcement on |
| Partner API production connection | Hotel info · rooms · province index refresh succeeds; no error 6 (signature) or 8 (IP) |
| Terms and notice | Consent records carry the terms URL and version; the consent notice links the privacy policy |

## 7. Reference — Partner API essentials (public docs, checked 10/27)

| Item | Docs | Used by SharpTalk for |
|---|---|---|
| Environments | Staging `staging-partner.go2joy.vn` (about 250/minute) · production `partner.go2joy.vn` (about 500/minute) | Sync rate limit |
| Auth | `Authorization` = hex(HMAC-SHA256(client secret, URL + "\|" + JSON body sorted by key)); body has `clientId` · `timestamp` (expires in 5 minutes); IP allow-list | WR-20 NTP · static IP |
| Language | `Localization` header `vi` / `en` (default en) | Lookups in the widget's language |
| Regions | Province Feed `region`: 1 South · 2 North · 3 Central · 4 North Central · 5 South Center (+ `10` undocumented). No province uses 3 today | §1 derivation |
| Feeds | Province (80) · District (per province) · Hotel (address, province, district, rating, images — HA hotels partly missing) · Room Type (bed, size, facilities, views, images) | Province index, hotel profile, room products |
| Hotel APIs | Hotel Info (hours, cancellation, no province) · Hotel List and Room Type List (live price, flash sale, lock status; rooms left always "unknown") | Hotel profile; live availability is a later step |
| Error codes | Body `code` 0 server error · 1 success · 2 failure; error 4 parameter · 6 signature · 8 unauthorized (IP / client) · 10 permission · 11 not found · 12 too many attempts | Production monitoring |

## 8. Reply table

Fill in and send to the daily check-in channel.

| WR | Prio | Owner | Feasible date | Status (in progress / done / on hold) | Note |
|---|---|---|---|---|---|
| WR-01 | P0-S | | | | |
| WR-02 | P0-S | | | | Option A / B (A if no reply) |
| WR-03 | P1 | | | | |
| WR-04 | P0-S | | | | |
| WR-05 | P0-S | | | | |
| WR-06 | P0 | | | | |
| WR-10 | P0-S | | | | |
| WR-11 | P0-S | | | | |
| WR-12 | P0-S | | | | |
| WR-13 | P0-S | | | | |
| WR-14 | P0-S | | | | |
| WR-15 | P0 | | | Done | |
| WR-16 | P1 | | | | |
| WR-17 | P1 | | | | |
| WR-18 | P1 | | | | Keep / change |
| WR-19 | P1 | | | | |
| WR-19a | P1 | | | | |
| WR-20 | P0 | | | | |
| WR-21 | P0 | | | | |
| WR-22 | P1 | | | | |
| WR-23 | P0 | | | | Booking-test exemption? |
| WR-24 – 29 | P1 / P2 | | | | |
| WR-30 | P0 | | | | |
| WR-31 | P0 | | | | |
| WR-40 | P0-S | | | | |
| WR-40a | P0-S | | | | Saturday 10/31? |
| WR-41 | P2 | | | | |
| WR-42 | P2 | | | | Needed / not needed |
