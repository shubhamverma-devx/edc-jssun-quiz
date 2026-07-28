#!/usr/bin/env bash
# Opens a route (default /join) on both booted simulators.
#   iOS  uses the Mac's LAN IP -> same cross-origin condition as a real phone
#        (falls back to localhost if no LAN IP is found).
#   Android reaches the host's localhost via 10.0.2.2.
# Both origins must be listed in allowedDevOrigins in next.config.ts.
set -euo pipefail

ROUTE="${1:-/join}"
PORT="${PORT:-3000}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || echo localhost)"

echo "iOS      -> http://$LAN_IP:$PORT$ROUTE"
xcrun simctl openurl booted "http://$LAN_IP:$PORT$ROUTE"

echo "Android  -> http://10.0.2.2:$PORT$ROUTE"
"$SDK/platform-tools/adb" shell am start -a android.intent.action.VIEW \
  -d "http://10.0.2.2:$PORT$ROUTE" >/dev/null
