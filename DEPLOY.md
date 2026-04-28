# HumiTrack Deployment Guide

## What this project includes

- `index.html`: main app UI
- `styles.css`: black-and-white theme
- `app.js`: login, admin panel, alerts, hourly reminder, local storage, Google Sheets sync hook
- `google-apps-script.gs`: backend for saving data into your Google Sheet
- `manifest.json` and `sw.js`: installable mobile-friendly PWA support

## Step 1: Put the frontend on hosting

You can deploy this as a static website on any of these:

1. GitHub Pages
2. Netlify
3. Vercel
4. Firebase Hosting

For the simplest deployment:

1. Create a GitHub repository.
2. Upload all project files.
3. In GitHub, open `Settings > Pages`.
4. Select the main branch and root folder.
5. Save.
6. GitHub will give you a live URL.

## Step 2: Connect Google Sheets

Your sheet ID is already added in `google-apps-script.gs`.

1. Open your Google Sheet.
2. Click `Extensions > Apps Script`.
3. Delete any starter code in the editor.
4. Paste the content from `google-apps-script.gs`.
5. Click `Deploy > New deployment`.
6. Choose `Web app`.
7. Set:
   `Execute as`: Me
   `Who has access`: Anyone
8. Click `Deploy`.
9. Authorize the script.
10. Copy the Web App URL.

## Step 3: Add the Apps Script URL to the app

1. Open `app.js`.
2. Find:

```js
apiUrl: "",
```

3. Replace it with:

```js
apiUrl: "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL",
```

4. Redeploy the frontend.

## Step 4: Test the full flow

1. Open the website.
2. Login with `admin / admin123` and check the admin panel.
3. Logout.
4. Login with `ajay / ajay123`.
5. Enter humidity values for a room.
6. Save the room.
7. Open the Google Sheet and confirm the row was added in the `Records` tab.

## Step 5: Mobile app option

This project is already mobile-friendly and can work like a mobile app as a PWA.

On Android:

1. Open the deployed site in Chrome.
2. Tap the browser menu.
3. Tap `Add to Home Screen` or `Install App`.

On iPhone:

1. Open the deployed site in Safari.
2. Tap the Share button.
3. Tap `Add to Home Screen`.

## If you want a real Play Store / App Store app later

Use this same frontend inside:

1. Capacitor
2. Ionic
3. React Native WebView wrapper

Capacitor is the cleanest next step because this app is already web-based.
