#!/usr/bin/env bash
# Install the talk.ivyusa.com auto-deploy schedule on the production host
# (PLN-261110-IVY-CICD). Run once, from the deploy checkout. Two ways:
#
#   bash scripts/ivy-autodeploy-install.sh --cron               # NO sudo: the deploy user's crontab
#   bash scripts/ivy-autodeploy-install.sh --cron --uninstall
#   sudo bash scripts/ivy-autodeploy-install.sh                 # systemd timer (needs root)
#   sudo bash scripts/ivy-autodeploy-install.sh --uninstall
#
# Either runs scripts/ivy-autodeploy.sh every two minutes as the user who owns
# this checkout. In cron mode, that is the user running this script. In systemd
# mode it is the checkout owner (override: DEPLOY_USER=...). Overlapping cron
# runs are prevented by flock inside ivy-autodeploy.sh.
# Production for IVY runs from deploy/talk-ivyusa — never main.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/ivy-autodeploy.sh"
MARK='# ivy-autodeploy'

mode=systemd action=install
for arg in "$@"; do
  case "$arg" in
    --cron) mode=cron ;;
    --uninstall) action=uninstall ;;
    *) echo "usage: $0 [--cron] [--uninstall]" >&2; exit 2 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }

# The current crontab without our line. `crontab -l` fails when the user has no
# crontab yet and grep fails when nothing is left; under pipefail either would
# abort the install, so both are tolerated here.
crontab_without_ours() { { crontab -l 2>/dev/null || true; } | { grep -vF "$MARK" || true; }; }

env_template() {
  cat <<'ENV'
# talk.ivyusa.com auto-deploy (scripts/ivy-autodeploy.sh). KEY=value lines only.
#
# Optional fine-grained GitHub token, repository amoeba-group/ivyusa-sharp-talk only:
#   Actions: read            -> API limit 5000/h instead of 60/h (the repo is public)
#   Commit statuses: write   -> deploy results show on the commit in GitHub
# IVY_GITHUB_TOKEN=
ENV
}

preflight() { # $1 = deploy user
  local user="$1" branch
  [[ "$user" != root ]] || fail "the deploy must not run as root — run as the user who owns $REPO_ROOT"
  [[ "$(stat -c %U "$REPO_ROOT")" == "$user" ]] || fail "$REPO_ROOT is owned by $(stat -c %U "$REPO_ROOT"), not $user"
  id -nG "$user" | tr ' ' '\n' | grep -qx docker || fail "$user is not in the docker group — the deploy could not run docker"
  if [[ "$(id -un)" == "$user" ]]; then
    branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
  else
    branch="$(sudo -u "$user" git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
  fi
  [[ "$branch" == deploy/talk-ivyusa ]] || fail "checkout is on '$branch' — production for IVY runs from deploy/talk-ivyusa"
  local tool
  for tool in git curl python3 flock; do command -v "$tool" >/dev/null || fail "$tool is required"; done
}

# ---- cron (no root) --------------------------------------------------------
if [[ "$mode" == cron ]]; then
  command -v crontab >/dev/null || fail "crontab is not installed — use the systemd mode (needs sudo)"
  if [[ "$action" == uninstall ]]; then
    crontab_without_ours | crontab -
    echo "removed the ivy-autodeploy crontab entry (kept ~/.config/ivy-autodeploy.env and ~/ivy-autodeploy.log)"
    exit 0
  fi
  preflight "$(id -un)"
  pgrep -x cron >/dev/null || pgrep -x crond >/dev/null \
    || echo "WARNING: no cron daemon is running — the entry will be installed but nothing will run it"

  env_file="$HOME/.config/ivy-autodeploy.env"
  log_file="$HOME/ivy-autodeploy.log"
  mkdir -p "$(dirname "$env_file")"
  [[ -f "$env_file" ]] || { env_template >"$env_file"; chmod 600 "$env_file"; }

  line="*/2 * * * * IVY_AUTODEPLOY_ENV=$env_file /usr/bin/env bash $SCRIPT >>$log_file 2>&1 $MARK"
  { crontab_without_ours; echo "$line"; } | crontab -

  cat <<DONE
Installed (cron, every 2 minutes, as $(id -un)):
  $line

  crontab -l | grep ivy-autodeploy                  # the entry
  tail -f $log_file                                 # what it did
  bash $SCRIPT --status
  bash $0 --cron --uninstall                        # stop auto-deploy
DONE
  exit 0
fi

# ---- systemd (root) --------------------------------------------------------
[[ $EUID -eq 0 ]] || fail "systemd mode needs sudo — without sudo use: bash $0 --cron"
SERVICE=/etc/systemd/system/ivy-autodeploy.service
TIMER=/etc/systemd/system/ivy-autodeploy.timer
ENV_FILE=/etc/ivy-autodeploy.env

if [[ "$action" == uninstall ]]; then
  systemctl disable --now ivy-autodeploy.timer 2>/dev/null || true
  rm -f "$SERVICE" "$TIMER"
  systemctl daemon-reload
  echo "removed (kept $ENV_FILE)"
  exit 0
fi

DEPLOY_USER="${DEPLOY_USER:-$(stat -c %U "$REPO_ROOT")}"
preflight "$DEPLOY_USER"

if [[ ! -f "$ENV_FILE" ]]; then
  env_template >"$ENV_FILE"
  chown "$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cat >"$SERVICE" <<UNIT
[Unit]
Description=talk.ivyusa.com — deploy the released tip of deploy/talk-ivyusa
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
User=$DEPLOY_USER
WorkingDirectory=$REPO_ROOT
EnvironmentFile=-$ENV_FILE
ExecStart=/usr/bin/env bash $SCRIPT
# A full image rebuild takes minutes; never let one be killed half-way.
TimeoutStartSec=45min
UNIT

cat >"$TIMER" <<'UNIT'
[Unit]
Description=Check deploy/talk-ivyusa for a released commit every 2 minutes

[Timer]
OnBootSec=3min
OnUnitInactiveSec=2min

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now ivy-autodeploy.timer

cat <<DONE
Installed (systemd). The timer runs scripts/ivy-autodeploy.sh as $DEPLOY_USER in $REPO_ROOT.

  systemctl list-timers ivy-autodeploy.timer      # next run
  journalctl -u ivy-autodeploy -n 50              # what it did
  sudo -u $DEPLOY_USER -H bash $SCRIPT --status
  sudo systemctl stop ivy-autodeploy.timer        # pause auto-deploy
DONE
