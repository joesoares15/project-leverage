# Project Leverage — One-Time GitHub Setup

This guide uses **GitHub Desktop** because it reliably uploads hidden folders such as `.github`, which contains the automated build and deployment workflows.

## What you need

- A free GitHub account
- A Mac
- GitHub Desktop (free)
- The unzipped `project-leverage` folder from this package

## Part 1 — Download and unzip

1. Download `project-leverage-github-v1.2.zip`.
2. Double-click the ZIP in Finder.
3. You should now have a folder named `project-leverage`.

The `.github` folder is included, but Finder hides names beginning with a period. To verify it exists, open the folder in Finder and press:

**Command + Shift + .**

Press the same keys again to hide hidden files.

You should see:

```text
.github/
  workflows/
    deploy-pages.yml
    test.yml
site/
scripts/
notebooks/
tests/
README.md
```

## Part 2 — Install GitHub Desktop

1. Open `https://desktop.github.com` in your browser.
2. Download and install GitHub Desktop.
3. Sign in with your GitHub account.

## Part 3 — Turn the folder into your repository

1. Open GitHub Desktop.
2. Choose **File → Add Local Repository**.
3. Select the unzipped `project-leverage` folder.
4. GitHub Desktop will say it is not yet a Git repository.
5. Click **Create a repository**.
6. Keep the repository name as `project-leverage`.
7. Do not select a new README, license, or `.gitignore`; those files already exist.
8. Click **Create Repository**.

## Part 4 — Commit all project files

1. In GitHub Desktop, confirm the left side shows the project files.
2. At the lower left, enter this summary:

```text
Initial Project Leverage release
```

3. Click **Commit to main**.
4. Click **Publish repository** at the top.
5. Leave **Keep this code private** checked for now.
6. Click **Publish Repository**.

GitHub Desktop includes hidden files automatically, so `.github/workflows` will be published with everything else.

## Part 5 — Enable GitHub Pages

1. Open the repository on GitHub by clicking **View on GitHub** in GitHub Desktop.
2. Open **Settings** in the repository.
3. Select **Pages** in the left sidebar.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.

## Part 6 — Run the first build

1. Open the repository's **Actions** tab.
2. You should see **Build data and deploy site**.
3. Open it.
4. Click **Run workflow**.
5. Keep the branch set to `main`.
6. Click the green **Run workflow** button.

The workflow will:

- Download the nflverse research data
- Build the bundled AnyRBOnA53 study file
- Validate the output
- Publish the website through GitHub Pages

## Part 7 — Open the live site

After the workflow finishes successfully:

1. Return to **Settings → Pages**.
2. GitHub will display the live website address.
3. Open it in Safari.
4. On iPhone, use **Share → Add to Home Screen**.

## Normal workflow after setup

You should not need to upload replacement ZIP files for routine changes.

The intended process is:

1. You describe the requested change in ChatGPT.
2. Updated project files are prepared.
3. The changed files are committed through GitHub Desktop.
4. GitHub tests, rebuilds, and publishes the site automatically.

## Troubleshooting

### “Build data and deploy site” is missing

On the GitHub website, open:

```text
.github/workflows/
```

You should see:

- `deploy-pages.yml`
- `test.yml`

If they are missing, the folder was uploaded manually rather than through GitHub Desktop. Repeat Parts 3–4 using GitHub Desktop.

### Finder does not show `.github`

Press **Command + Shift + .** while the project folder is open.

### GitHub says Actions are disabled

Open **Settings → Actions → General** and allow actions and reusable workflows.

### The first data build fails

Open the failed workflow, expand the red step, and copy the error into ChatGPT. Do not repeatedly change configuration without reviewing the actual error.
