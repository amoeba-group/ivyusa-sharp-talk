#!/usr/bin/env bash
# talk.ivyusa.com — pull-based continuous deployment (PLN-261110-IVY-CICD).
#
# Production for IVY USA runs from branch deploy/talk-ivyusa — NEVER main.
#
# Runs ON the production host (EC2 talkaibotprd01) from the deploy checkout,
# every 2 minutes, via the crontab entry (`--cron`, no sudo — talkaibotprd01) or
# the systemd timer that scripts/ivy-autodeploy-install.sh installs. One cycle:
#
#   1. fetch origin/deploy/talk-ivyusa — nothing to do when HEAD already has it
#   2. ask GitHub whether the "IVY CI/CD" run for that exact commit (event=push,
#      this branch) passed its deploy-gate job: verify + e2e green and, when the
#      talk-ivyusa-production environment requires it, a reviewer approved
#   3. fast-forward and run `deploy-self-hosted.sh --check` (config + outstanding
#      SQL). If it fails, step back to the previous commit so the checkout matches
#      the containers that are running, and retry next cycle — so after a schema
#      change the operator only has to apply the SQL; the deploy then proceeds.
#   4. run deploy-self-hosted.sh (build, start, verify health/widget/console/boot)
#   5. if IVY_GITHUB_TOKEN can write commit statuses, report the result on the
#      commit as "deploy/talk.ivyusa.com"
#
#   bash scripts/ivy-autodeploy.sh            # one cycle (what the timer runs)
#   bash scripts/ivy-autodeploy.sh --dry-run  # say what would happen; deploy nothing
#   bash scripts/ivy-autodeploy.sh --status   # last deployed commit and outcome
#
# Why pull and not push: the repository is public. A self-hosted runner here
# would run fork-PR workflow code with docker (= root) rights, and an SSH deploy
# from GitHub's runners would need port 22 open to their whole address space.
# Pulling needs no inbound port and no deploy secret stored on GitHub.
#
# Configuration (environment, optionally from /etc/ivy-autodeploy.env):
#   IVY_GITHUB_TOKEN   fine-grained token for this repo. Optional. Read-only
#                      lifts the API limit (60 → 5000/h); "Commit statuses:
#                      write" also reports deploy results on GitHub.
#   IVY_BRANCH  IVY_REPO  IVY_WORKFLOW  IVY_GATE_JOB  IVY_GITHUB_API
#   IVY_STATE_DIR  IVY_LOG_DIR  IVY_DEPLOY_CMD      — defaults below
set -euo pipefail

ENV_FILE="${IVY_AUTODEPLOY_ENV:-/etc/ivy-autodeploy.env}"
# shellcheck disable=SC1090
[[ -r "$ENV_FILE" ]] && { set -a; . "$ENV_FILE"; set +a; }

BRANCH="${IVY_BRANCH:-deploy/talk-ivyusa}"
REPO="${IVY_REPO:-amoeba-group/ivyusa-sharp-talk}"
WORKFLOW="${IVY_WORKFLOW:-ivy-ci-cd.yml}"
GATE_JOB="${IVY_GATE_JOB:-deploy-gate}"
API="${IVY_GITHUB_API:-https://api.github.com}"
STATE_DIR="${IVY_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/ivy-autodeploy}"
LOG_DIR="${IVY_LOG_DIR:-$HOME}"
DEPLOY_CMD="${IVY_DEPLOY_CMD:-bash scripts/deploy-self-hosted.sh}"
TOKEN="${IVY_GITHUB_TOKEN:-}"
STATUS_CONTEXT="deploy/talk.ivyusa.com"

say() { printf '[ivy-autodeploy] %s\n' "$*"; }
die() { say "ERROR: $*" >&2; exit 1; }

api_get() {
  local args=(-fsS --max-time 20 -A ivy-autodeploy -H 'Accept: application/vnd.github+json')
  [[ -n "$TOKEN" ]] && args+=(-H "Authorization: Bearer $TOKEN")
  curl "${args[@]}" "$API/$1"
}

# success | pending <why> | failed <why> | error <why>
gate_state() {
  local sha="$1" runs run id status conclusion url jobs job
  runs="$(api_get "repos/$REPO/actions/workflows/$WORKFLOW/runs?branch=$BRANCH&event=push&head_sha=$sha&per_page=10")" \
    || { echo "error GitHub API unreachable or rate-limited"; return; }
  run="$(python3 -c '
import json, sys
runs = json.load(sys.stdin).get("workflow_runs") or []
if not runs:
    print("none"); sys.exit()
r = max(runs, key=lambda r: (r.get("run_number", 0), r.get("run_attempt", 0)))
print(r["id"], r["status"], r.get("conclusion") or "-", r.get("html_url", ""))
' <<<"$runs")"
  [[ "$run" == none ]] && { echo "pending no workflow run for this commit yet"; return; }
  read -r id status conclusion url <<<"$run"
  if [[ "$status" != completed ]]; then echo "pending run $status $url"; return; fi
  [[ "$conclusion" == success ]] || { echo "failed run $conclusion $url"; return; }
  jobs="$(api_get "repos/$REPO/actions/runs/$id/jobs?per_page=100")" \
    || { echo "error GitHub API unreachable or rate-limited"; return; }
  job="$(python3 -c '
import json, sys
jobs = [j for j in json.load(sys.stdin).get("jobs") or [] if j.get("name") == sys.argv[1]]
print((jobs[0].get("conclusion") or jobs[0].get("status")) if jobs else "absent")
' "$GATE_JOB" <<<"$jobs")"
  if [[ "$job" == success ]]; then echo "success $url"; else echo "failed $GATE_JOB $job $url"; fi
}

# Report on the commit only when the state changes — a retry loop must not
# post the same "pending" every two minutes.
post_status() {
  local sha="$1" state="$2" desc="$3" mark="$STATE_DIR/posted-$1"
  [[ -n "$TOKEN" ]] || return 0
  [[ -f "$mark" && "$(cat "$mark")" == "$state:$desc" ]] && return 0
  local body
  body="$(python3 -c 'import json, sys; print(json.dumps({"state": sys.argv[1], "context": sys.argv[2], "description": sys.argv[3][:139]}))' \
    "$state" "$STATUS_CONTEXT" "$desc")"
  if curl -fsS --max-time 20 -A ivy-autodeploy -X POST -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" "$API/repos/$REPO/statuses/$sha" -d "$body" >/dev/null; then
    printf '%s' "$state:$desc" >"$mark"
  else
    say "could not post commit status (token lacks 'Commit statuses: write'?)"
  fi
}

# Log an outcome once — a commit that stays blocked must not repeat every cycle.
record() {
  local prev=""
  [[ -f "$STATE_DIR/last" ]] && prev="$(cut -d' ' -f2- "$STATE_DIR/last")"
  [[ "$prev" == "$*" ]] && return 0
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >"$STATE_DIR/last"
  say "$*"
}

main() {
  local mode=run
  case "${1:-}" in
    '') ;;
    --dry-run) mode=dry ;;
    --status) mode=status ;;
    *) echo "usage: $0 [--dry-run|--status]" >&2; exit 2 ;;
  esac

  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$root"
  mkdir -p "$STATE_DIR"

  if [[ "$mode" == status ]]; then
    echo "checkout : $root ($(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD))"
    echo "deployed : $(cat "$STATE_DIR/deployed" 2>/dev/null || echo '<none recorded>')"
    echo "last     : $(cat "$STATE_DIR/last" 2>/dev/null || echo '<none>')"
    exit 0
  fi

  for tool in git curl python3; do command -v "$tool" >/dev/null || die "$tool is required"; done

  # The timer never overlaps a running service, but a manual run could.
  if command -v flock >/dev/null; then
    exec 9>"$STATE_DIR/lock"
    flock -n 9 || { say "another cycle is running"; exit 0; }
  fi

  [[ "$(git rev-parse --abbrev-ref HEAD)" == "$BRANCH" ]] \
    || die "checkout is on '$(git rev-parse --abbrev-ref HEAD)', expected '$BRANCH' — production never runs from another branch"
  # Tracked edits on the server would be silently mixed into a build, or lost.
  git diff --quiet HEAD -- || die "tracked files are modified in $root — commit or discard them first"

  git fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" || die "git fetch origin failed"
  local head tip
  head="$(git rev-parse HEAD)"
  tip="$(git rev-parse "refs/remotes/origin/$BRANCH")"

  if git merge-base --is-ancestor "$tip" "$head"; then
    [[ "$mode" == dry ]] && say "up to date: HEAD $(git rev-parse --short HEAD) already contains origin/$BRANCH"
    exit 0
  fi
  git merge-base --is-ancestor "$head" "$tip" \
    || die "HEAD $head and origin/$BRANCH $tip have diverged — resolve by hand (never force)"

  local short="${tip:0:8}" gate
  if [[ -f "$STATE_DIR/approved-$tip" ]]; then
    gate="success (cached)"
  else
    gate="$(gate_state "$tip")"
  fi
  case "$gate" in
    success*) : ;;
    pending*) [[ "$mode" == dry ]] && say "$short waiting: ${gate#pending }"; exit 0 ;;
    failed*)  record "$short not deployable: ${gate#failed }"; exit 0 ;;
    *)        say "$short gate unknown: $gate"; exit 0 ;;
  esac
  : >"$STATE_DIR/approved-$tip"

  if [[ "$mode" == dry ]]; then
    say "would deploy $short ($(git log -1 --format=%s "$tip")) over $(git rev-parse --short HEAD)"
    exit 0
  fi

  local log stamp
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  log="$LOG_DIR/sharptalk-deploy-$stamp-$short.log"
  say "deploying $short over ${head:0:8} — log $log"
  git merge --ff-only --quiet "$tip"

  # Check before touching containers. On failure the checkout returns to what
  # the containers run, and the next cycle tries again.
  if ! $DEPLOY_CMD --check >"$log" 2>&1; then
    git reset --keep --quiet "$head"
    post_status "$tip" pending "Waiting: deploy check failed (outstanding SQL or config) on the host"
    record "$short waiting: deploy check failed, checkout back on ${head:0:8} — see $log"
    exit 3
  fi

  post_status "$tip" pending "Deploying to talk.ivyusa.com"
  if $DEPLOY_CMD >>"$log" 2>&1; then
    printf '%s %s\n' "$tip" "$(date -u +%FT%TZ)" >"$STATE_DIR/deployed"
    post_status "$tip" success "Deployed to talk.ivyusa.com"
    record "$short deployed (log $log)"
    find "$STATE_DIR" -maxdepth 1 \( -name 'approved-*' -o -name 'posted-*' \) -mtime +30 -delete 2>/dev/null || true
  else
    # No automatic rollback: a half-applied stack plus a schema change is a
    # judgement call. Fix forward (push a fix) or roll back by hand.
    post_status "$tip" failure "Deploy failed on the host — see $(basename "$log")"
    record "$short DEPLOY FAILED — checkout stays on $short, see $log"
    exit 1
  fi
}

# One line, so bash has read all of it before the fast-forward rewrites this file.
main "$@"; exit $?
