# Automatic pull-request previews

This change gives each future pull request a temporary website URL such as:

`https://joesoares15.github.io/project-leverage/pr-preview/pr-6/`

The workflow adds that link as a comment on the pull request, updates it after new commits, and removes the preview when the pull request closes.

## Apply this change

1. Create a branch from `main` named `feature/pr-preview-deployments`.
2. Upload the contents of this package to the repository root on that branch.
3. Commit with: `Add automatic pull request previews`.
4. Open a pull request into `main`.
5. Confirm the normal tests are green, then merge it. This setup PR cannot reliably preview itself because the publishing setting changes only after it is merged.

## One-time GitHub settings after merging

### 1. Give Actions write permission

Go to:

**Settings → Actions → General → Workflow permissions**

Choose:

**Read and write permissions**

Save.

### 2. Change the Pages source

Wait for the merged `Build data and deploy site` workflow to finish once. It will create a `gh-pages` branch.

Then go to:

**Settings → Pages → Build and deployment**

Set:

- **Source:** Deploy from a branch
- **Branch:** `gh-pages`
- **Folder:** `/ (root)`

Save.

Production remains at:

`https://joesoares15.github.io/project-leverage/`

## Test the preview feature

1. Create a small test branch from `main`.
2. Change visible text in `site/index.html`.
3. Open a pull request.
4. Wait for **Deploy PR preview** to finish.
5. Open the preview link posted in the PR comments.
6. Close the test PR without merging if it was only a test. The workflow removes its preview directory.

## Notes

- Preview deployments work for branches created inside this repository.
- Production deployment preserves the `pr-preview` directory.
- Preview paths use relative site URLs, so Sleeper imports and bundled research data continue to load from the preview folder.
