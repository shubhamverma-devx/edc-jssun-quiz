# Emulator testing scripts

Test every user-facing change on **both** real mobile targets before calling it done:
iOS Simulator (iPhone 16 Pro, Safari/WebKit) and Android Emulator (Pixel 7, Chrome).

## Prerequisites

- Xcode (provides `xcrun simctl` + Simulator app)
- Android Studio with the `Pixel_7_Adhikar` AVD (or pass another AVD name)
- Dev server running: `npm run dev`
- `next.config.ts` → `allowedDevOrigins` must include `10.0.2.2` and the Mac's
  LAN IP, otherwise pages render but **never hydrate** (dead buttons, no JS)

## Usage

```bash
./scripts/emulator/boot-ios.sh          # boot iPhone 16 Pro (or: boot-ios.sh "iPhone 16")
./scripts/emulator/boot-android.sh      # boot Pixel 7 AVD (or: boot-android.sh <AVD_NAME>)
./scripts/emulator/open-app.sh /join    # open a route on both (default /join)
./scripts/emulator/screenshot.sh step1  # -> /tmp/ios-step1.png + /tmp/android-step1.png
```

## Why iOS opens the LAN IP, not localhost

The iOS Simulator *could* use `http://localhost:3000`, but real iPhones use the
LAN IP — a **cross-origin dev context** where Next.js blocks dev resources
unless allowed (`allowedDevOrigins`), and where secure-context-only APIs
(`crypto.randomUUID`, `navigator.mediaDevices`) are unavailable. Testing via the
LAN IP on the simulator reproduces what a real phone experiences.

## Driving the UI from the terminal

- **Android**: `adb shell input tap X Y`, `adb shell input text "..."` — plus full
  Chrome DevTools Protocol access: `adb forward tcp:9222 localabstract:chrome_devtools_remote`,
  then `curl localhost:9222/json/list` for page targets (JS eval over WebSocket).
- **iOS**: `xcrun simctl openurl booted <url>`; typing works via macOS keystrokes
  (`osascript ... keystroke`) when the Simulator window is focused. For DOM-level
  control use `safaridriver -p 4445` with capabilities
  `{"platformName":"iOS","safari:useSimulator":true}` — navigation, JS eval, and
  element clicks all work (element `sendKeys` is unreliable on iOS; set values via
  JS instead). Native popovers (file-picker action sheets) ignore synthetic mac
  clicks — inject a `File` into the input via JS `DataTransfer` instead.
- The photo upload step can be exercised without the OS picker by dispatching a
  generated canvas PNG through the hidden `<input type="file">` (same app code path).

## Known quirks

- Chrome first-run on a fresh AVD shows sign-in + notification prompts — dismiss
  once; the choice persists in the AVD image.
- `adb exec-out screencap -p` is the reliable screenshot path (avoids CRLF issues).
- Screenshots land in /tmp so they never pollute the repo.
