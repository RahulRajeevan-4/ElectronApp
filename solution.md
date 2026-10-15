# Installing Focus Todo on another Mac without `xattr -cr`

## Why the command is needed today

When a Mac downloads a file (from a browser, AirDrop, Messages, Slack, email and so on), it tags the file with the
`com.apple.quarantine` attribute. When you first open a quarantined app, Gatekeeper checks two things:

1. **Is it signed with an Apple-issued Developer ID certificate?**
2. **Has Apple notarized it**, meaning scanned it and issued a ticket?

The current build passes neither check. Here is what `codesign -dv` reports for `dist/mac-arm64/Focus Todo.app`:

```
Signature=adhoc
flags=0x20002(adhoc,linker-signed)
Sealed Resources=none
TeamIdentifier=not set
```

Only the main executable has an automatic ad-hoc signature from the linker, and the rest of the bundle isn't sealed.
`electron-builder.yml` also has `notarize: false`, and this Mac has no signing identity
(`security find-identity -v -p codesigning` → `0 valid identities found`). On Apple Silicon, Gatekeeper reports this
kind of quarantined app as **"Focus Todo is damaged and can't be opened"** and gives no way around it in the UI.
`xattr -cr` removes the quarantine attribute, so Gatekeeper never checks the app. That's why the command works.

There's no setting inside the app that can avoid this. The fix belongs in how the app is **signed and distributed**.

---

## Recommended solution: sign with Developer ID and notarize

This is the only option where the other Mac needs no command and no extra clicks: the user double-clicks the DMG,
drags the app to Applications and opens it.

### 1. Join the Apple Developer Program

- Enroll at https://developer.apple.com/programs/ (99 USD per year, individual enrollment is fine).
- A free Apple ID **can't** issue Developer ID certificates.

### 2. Create a "Developer ID Application" certificate

1. In Xcode, go to **Settings → Accounts**, add your Apple ID, then **Manage Certificates… → + → Developer ID Application**.
   You can also create it at https://developer.apple.com/account/resources/certificates.
2. Check that it's in your keychain:

   ```bash
   security find-identity -v -p codesigning
   # 1) ABCDEF... "Developer ID Application: Your Name (TEAMID1234)"
   ```

electron-builder finds this certificate in the keychain automatically.

### 3. Create notarization credentials

Use an **App Store Connect API key**, which is recommended:

1. Go to https://appstoreconnect.apple.com/access/integrations/api → **Team Keys** → **+**, with the *Developer* role.
2. Download the `.p8` file (you can only download it once) and note the **Key ID** and **Issuer ID**.

The alternative is an Apple ID with an app-specific password from https://account.apple.com → *Sign-In and Security* →
*App-Specific Passwords*.

### 4. Update `electron-builder.yml`

Replace the `mac:` section:

```yaml
mac:
  hardenedRuntime: true # required for notarization (this is the default, shown here for clarity)
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true
  target:
    - target: dmg
      arch: [arm64, x64] # x64 lets the app also run on Intel Macs
```

Notes:

- `notarize: true` makes electron-builder upload the app to Apple, wait for approval and **staple** the ticket to the app.
  Stapling lets Gatekeeper accept the app even when the other Mac is offline.
- The current `extendInfo` asks for **camera, microphone, Documents and Downloads** access. Focus Todo uses none of
  these, so remove it. Unneeded permission prompts look suspicious to users and reviewers.
- You can also remove `com.apple.security.cs.allow-dyld-environment-variables` from `build/entitlements.mac.plist`,
  because Electron doesn't need it. Keep `allow-jit` and `allow-unsigned-executable-memory`, which V8 needs.

### 5. Build with the credentials in the environment

Don't commit these values. Put them in your shell profile or a password manager instead:

```bash
export APPLE_API_KEY=~/keys/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# If you use an Apple ID instead of an API key:
# export APPLE_ID=you@example.com
# export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
# export APPLE_TEAM_ID=TEAMID1234

npm run build:mac
```

Notarization usually takes 1–10 minutes.

### 6. Verify before you share the DMG

```bash
APP="dist/mac-arm64/Focus Todo.app"

codesign --verify --deep --strict --verbose=2 "$APP"   # should report "valid on disk"
spctl -a -vvv -t exec "$APP"                            # should report "accepted  source=Notarized Developer ID"
xcrun stapler validate "$APP"                           # should report "The validate action worked!"
```

If `spctl` says **accepted / Notarized Developer ID**, the app installs on any Mac with no terminal commands.

---

## Free alternative (no Apple Developer account)

If you don't want to pay the 99 USD per year, you can't get rid of the warning completely. You can still replace the
terminal command with a **one-time click in System Settings**.

### 1. Ad-hoc sign the whole bundle

In `electron-builder.yml`:

```yaml
mac:
  identity: '-' # ad-hoc sign the whole app (seals all resources)
  notarize: false
```

Rebuild with `npm run build:mac`. The app is then signed consistently and macOS stops calling it "damaged".

### 2. Steps for the person installing it (once per Mac)

1. Open the DMG and drag **Focus Todo** to **Applications**.
2. Open the app. macOS warns *"Apple could not verify 'Focus Todo' is free of malware"*. Click **Done**.
3. Open **System Settings → Privacy & Security** and scroll down to the message about Focus Todo.
   Click **Open Anyway**, then confirm with your password or Touch ID.
4. After this, the app opens normally.

On macOS 15 (Sequoia) and later, the old trick of right-clicking the app and choosing **Open** no longer bypasses this
warning, so step 3 is required.

You have to repeat these steps every time you install a new build.

### Ways to share it without quarantine

Quarantine is added by the app that downloads or receives the file. Copying the `.app` or `.dmg` from a **USB drive or
external disk** with Finder usually doesn't add the quarantine attribute, so no warning appears. Use this only for
personal installs on your own Macs, not as a distribution method.

---

## Summary

| Option                                      | Cost           | What the other Mac's user does                          |
| ------------------------------------------- | -------------- | ------------------------------------------------------- |
| Current build (linker ad-hoc, unsealed)     | Free           | Runs `xattr -cr` ("damaged" error otherwise)            |
| Ad-hoc signed (`identity: '-'`)             | Free           | Clicks **Open Anyway** in Privacy & Security once       |
| **Developer ID + notarization** (recommended) | 99 USD per year | Nothing, the app just opens                             |
