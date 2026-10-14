# Pulse — your music player (React + Android APK)

Build the Android APK in the cloud. Nothing to install on your computer.

## Get the APK (about 10 minutes, one time)

1. Go to github.com and sign up (free).
2. Click **+** (top right) → **New repository**. Name it `pulse-player`. Keep it **Public**. Click **Create repository**.
3. On the new page, click **uploading an existing file**.
4. Unzip this folder on your computer. Open it, select **everything inside** (not the folder itself) and drag it into the GitHub page.
   - Make sure the `.github` folder goes in too. If you can't see it, turn on "show hidden files".
5. Click **Commit changes**.
6. Click the **Actions** tab. If asked, click **"I understand my workflows, go ahead and enable them"**.
7. Open **Build Android APK**. If nothing is running, click **Run workflow**. Wait 6-10 minutes until you see a green tick.
8. Click the finished run, scroll to **Artifacts**, download **pulse-apk**, and unzip it. Inside is `app-debug.apk`.
9. Send it to your phone, tap it, and allow "install unknown apps" when asked.

### If the Actions tab shows no workflow
The `.github` folder didn't upload. Fix:
1. In your repository click **Add file → Create new file**.
2. In the name box type exactly: `.github/workflows/android.yml`
3. Open `android.yml` (it's in this folder too), copy everything, paste it, and click **Commit changes**.

## Changing the app later
Tell Claude what you want ("make the cover bigger", "add playlists"). Claude gives you updated files.
Upload them to GitHub (**Add file → Upload files**, same names overwrite). GitHub rebuilds a new APK automatically.

## Notes
- Songs you add are stored on the phone and play offline.
- Streaming links must start with `https://`.
- Music may pause when the phone locks. Fixing this needs a background-audio plugin (ask Claude to add it).
- This is a debug APK for personal use. To publish on the Play Store later, a signed release build is needed.

## Run it on your computer (optional)
Needs Node.js: `npm install` then `npm run dev`.
