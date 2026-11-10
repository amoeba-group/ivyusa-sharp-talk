#!/usr/bin/env bash
# Install the talk.ivyusa.com auto-deploy timer on the production host
# (PLN-261110-IVY-CICD). Run once, from the deploy checkout, with sudo:
#
#   sudo bash scripts/ivy-autodeploy-install.sh              # install / update
#   sudo bash scripts/ivy-autodeploy-install.sh --uninstall  # remove the timer
#
# It installs a systemd timer that runs scripts/ivy-autodeploy.sh every two
# minutes as the user who owns this checkout (override: DEPLOY_USER=...).
# Production for IVY runs from deploy/talk-ivyusa — never main.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE=/etc/systemd/system/ivy-autodeploy.service
TIMER=/etc/systemd/system/ivy-autodeploy.timer
ENV_FILE=/etc/ivy-autodeploy.env

if [[ "${1:-}" == --uninstall ]]; then
  systemctl disable --now ivy-autodeploy.timer 2>/dev/null || true
  rm -f "$SERVICE" "$TIMER"
  systemctl daemon-reload
  echo "removed (kept $ENV_FILE)"
  exit 0
fi

DEPLOY_USER="${DEPLOY_USER:-$(stat -c %U "$REPO_ROOT")}"
[[ "$DEPLOY_USER" != root ]] || { echo "the checkout is owned by root — set DEPLOY_USER to the deploy user" >&2; exit 1; }
id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker \
  || { echo "$DEPLOY_USER is not in the docker group — the deploy could not run docker" >&2; exit 1; }
branch="$(sudo -u "$DEPLOY_USER" git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
[[ "$branch" == deploy/talk-ivyusa ]] \
  || { echo "checkout is on '$branch' — production for IVY runs from deploy/talk-ivyusa" >&2; exit 1; }
for tool in git curl python3; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<'ENV'
# talk.ivyusa.com auto-deploy (scripts/ivy-autodeploy.sh). KEY=value lines only.
#
# Optional fine-grained GitHub token, repository amoeba-group/ivyusa-sharp-talk only:
#   Actions: read            -> API limit 5000/h instead of 60/h (the repo is public)
#   Commit statuses: write   -> deploy results show on the commit in GitHub
# IVY_GITHUB_TOKEN=
ENV
  chown "$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cat >"$SERVICE" <<UNIT
[Unit]
Description=talk.ivyusa.com — deploy the approved tip of deploy/talk-ivyusa
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
User=$DEPLOY_USER
WorkingDirectory=$REPO_ROOT
EnvironmentFile=-$ENV_FILE
ExecStart=/usr/bin/env bash $REPO_ROOT/scripts/ivy-autodeploy.sh
# A full image rebuild takes minutes; never let one be killed half-way.
TimeoutStartSec=45min
UNIT

cat >"$TIMER" <<'UNIT'
[Unit]
Description=Check deploy/talk-ivyusa for an approved commit every 2 minutes

[Timer]
OnBootSec=3min
OnUnitInactiveSec=2min

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now ivy-autodeploy.timer

cat <<DONE
Installed. The timer runs scripts/ivy-autodeploy.sh as $DEPLOY_USER in $REPO_ROOT.

  systemctl list-timers ivy-autodeploy.timer      # next run
  journalctl -u ivy-autodeploy -n 50              # what it did
  sudo -u $DEPLOY_USER -H bash $REPO_ROOT/scripts/ivy-autodeploy.sh --status
  sudo systemctl stop ivy-autodeploy.timer        # pause auto-deploy
DONE
