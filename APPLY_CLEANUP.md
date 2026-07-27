# Apply the cleanup through GitHub.com

This method requires no GitHub Desktop and no Terminal.

1. Unzip the cleanup package.
2. Open the `project-leverage` repository in GitHub and select **Code**.
3. Choose **Add file → Upload files**.
4. From the unzipped folder, drag these visible items into the upload area:
   - `docs`
   - `site`
   - `scripts`
   - `tests`
   - `notebooks`
   - all visible `.md` files
   - `requirements.txt`
   - `LICENSE`
5. Commit directly to `main` with the message: `Sprint 1 repository cleanup`.
6. Delete the two obsolete files individually:
   - `site/app.js`
   - `site/styles.css`
   Open each file in GitHub, use the three-dot menu, choose **Delete file**, and commit.
7. Open **Actions**. The existing **Build data and deploy site** workflow should run automatically.
8. Wait for both Build and Deploy to turn green, then reload the GitHub Pages site.

## Optional workflow validation update

The cleaned package also adds JavaScript syntax validation to the hidden `.github/workflows` files. The existing workflows will still deploy the cleaned site without this update. We can add the extra validation through GitHub's web editor after the site is confirmed working.
