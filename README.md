# স্বাস্থ্যবন্ধু (Shasthobondhu)

বাংলা ভাষায় ডিজিটাল ওষুধ ব্যবস্থাপনা অ্যাপ: ওষুধের তালিকা, স্টক প্রেডিকশন, মেয়াদ শেষের সতর্কতা, রিমাইন্ডার ও ডাক্তারের রিপোর্ট।

## Tech stack
- Web: React 19, Vite, Tailwind CSS 4
- Backend: Firebase Auth + Firestore (rules: `firestore.rules`)
- Android: Kotlin (অ্যালার্ম রিমাইন্ডার), `android/` ফোল্ডারে

## Run locally
```bash
bun install   # or npm install
cp .env.example .env   # GEMINI_API_KEY বসান
npm run dev   # http://localhost:3000
```

## Build APK
GitHub Actions: `.github/workflows/main.yml` (Actions ট্যাব থেকে "Run workflow")।
