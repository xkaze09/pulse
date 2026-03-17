#!/usr/bin/env bash
# setup-dev.sh — one-time dev environment setup for Pulse contributors
set -e

echo "==> Installing gstack (Claude Code skills)..."
if [ -d "$HOME/.claude/skills/gstack" ]; then
  echo "    gstack already installed, pulling latest..."
  git -C "$HOME/.claude/skills/gstack" pull --ff-only
else
  git clone https://github.com/garrytan/gstack.git "$HOME/.claude/skills/gstack"
fi

cd "$HOME/.claude/skills/gstack" && ./setup

# On Windows, ln -snf silently fails — copy skill dirs as fallback
echo "==> Registering skills..."
cd "$HOME/.claude/skills/gstack"
for skill_dir in */; do
  if [ -f "$skill_dir/SKILL.md" ]; then
    skill_name="${skill_dir%/}"
    [ "$skill_name" = "node_modules" ] && continue
    target="$HOME/.claude/skills/$skill_name"
    if [ ! -e "$target" ]; then
      cp -r "$skill_dir" "$target"
      echo "    registered: $skill_name"
    fi
  fi
done

echo ""
echo "==> gstack ready. Available Claude Code skills:"
echo "    /browse, /plan-ceo-review, /plan-eng-review, /plan-design-review"
echo "    /review, /ship, /qa, /qa-only, /qa-design-review"
echo "    /setup-browser-cookies, /retro, /document-release"
echo ""
echo "==> Done. Run 'cd backend && pip install -e .' and 'cd frontend && pnpm install' to finish setup."
