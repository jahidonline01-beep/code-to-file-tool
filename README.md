# Code to File Tools PC v13

Clean English UI. Check-only workflow. Upload/read code, paste code, preview index, preview code, and download flat ZIP.

## GitHub build
Upload all files to repository root. Only this workflow is included:

```text
.github/workflows/windows-build.yml
```

Then run Actions > Windows Build.

## Local run
```bash
npm install
npm start
```

## Local build
```bash
npm install
npm run check
npm run dist
```
