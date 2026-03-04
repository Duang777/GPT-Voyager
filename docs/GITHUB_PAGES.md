# GitHub Pages Deployment (Promo Site)

This project now includes a static promo frontend in `site/` and an automated GitHub Pages workflow:

- Site source: `site/index.html`, `site/styles.css`, `site/script.js`
- Workflow: `.github/workflows/deploy-pages.yml`

## 1. Push to GitHub

1. Create a GitHub repository (or use an existing one).
2. Push this project to `main` (or `master`).

## 2. Enable Pages

1. Open repository `Settings`.
2. Go to `Pages`.
3. In `Build and deployment`, set `Source` to `GitHub Actions`.

## 3. Wait for Deployment

After push, GitHub Actions will run:

- `Deploy static site to GitHub Pages`

When the workflow succeeds, your site URL is usually:

- `https://<github-username>.github.io/<repository-name>/`

For this folder name (`GPT`), a typical URL is:

- `https://<github-username>.github.io/GPT/`

## 4. Local Preview

Use any static file server in project root:

```powershell
npx serve site
```

Or open `site/index.html` directly in browser.
