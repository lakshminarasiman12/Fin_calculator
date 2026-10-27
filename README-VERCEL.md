# Yield & Tax Scanner — Vercel deployment

This folder is arranged for Vercel:
- `index.html`, `styles.css`, `app.js`: static frontend
- `api/calculate.py`: Vercel Python Function at `/api/calculate`
- `yield_tax_engine.py`: calculation engine

## Deploy
1. Extract this ZIP.
2. Upload the extracted folder to a new GitHub repository (the files above should be at the repository root, not inside another nested folder).
3. In Vercel, import that repository.
4. Framework Preset: **Other**. Leave Build Command and Output Directory blank/default; do not set an output directory such as `dist` or `build`.
5. Deploy. If the existing Vercel project has the wrong Root Directory, set it to the folder containing `index.html` and `api/`.
6. If deployment still fails, open the deployment's **Logs** and check both build and function/runtime logs.

Note: rates in this app are illustrative sample rates, not live bank offers or financial advice.
