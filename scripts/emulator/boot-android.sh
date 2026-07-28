#!/usr/bin/env bash
# Boots the Android emulator used for mobile testing (Pixel 7 AVD).
set -euo pipefail

AVD="${1:-Pixel_7_Adhikar}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"

nohup "$SDK/emulator/emulator" -avd "$AVD" -no-snapshot-save -no-boot-anim \
  > /tmp/android-emulator.log 2>&1 &
disown

echo "Waiting for '$AVD' to finish booting..."
"$SDK/platform-tools/adb" wait-for-device
until [ "$("$SDK/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  sleep 3
done
echo "Android emulator ready."
