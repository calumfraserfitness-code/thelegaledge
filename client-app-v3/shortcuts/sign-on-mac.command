#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ ! -x /usr/bin/shortcuts ]]; then
  printf '%s\n' 'Run this on your Mac with the Shortcuts app installed.'
  exit 1
fi
/usr/bin/shortcuts sign --mode anyone --input Legal-Edge-Steps.unsigned.shortcut --output Legal-Edge-Steps.shortcut
printf '%s\n' 'Signed. AirDrop Legal-Edge-Steps.shortcut to your iPhone. Add it, answer the two setup questions and run once while unlocked. This does not approve Health permissions or create an automation.'
