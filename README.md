# Festival of False Bloom website

## Editing and publishing

- **Source:** Edit the campaign notes in Obsidian.
- **Preview.cmd:** Exports selected notes and opens a local server at http://localhost:8080. Keep its terminal running while viewing; Ctrl+C stops it.
- **Publish.cmd:** Exports selected notes, verifies a build, commits changes to the exported content, and pushes them to GitHub.
	- GitHub Actions rebuilds the website after the push.
	- Only use this after the GitHub repository and Pages are configured.

## Content

- **Included:** Party, People index and entries, Current Threads, numbered session notes, and quest scroll images.
- **Excluded:** Transcripts, templates, Notes Guide, live Meta Bind tracker, personal combat reference, and old campaigns.
- **Generated files:** `content/` is an export; edit the Obsidian originals instead.
- **Local configuration:** `.publish.local.json` identifies the campaign folder on this computer and is excluded from Git.

## Initial GitHub setup

1. Create the GitHub repository `Trefoiler/festival-of-false-bloom` using this local checkout.
2. Set its `origin` remote to that repository; the Quartz source is the `upstream` remote.
3. Push `main` with the initial website files.
4. In GitHub Settings → Pages, select GitHub Actions as the publishing source.
5. Wait for the Publish campaign wiki workflow to finish.

**Expected website:** https://trefoiler.github.io/festival-of-false-bloom/
**Visibility:** Ordinary GitHub Pages hosting is public; this checkout has not been published merely by building a preview.
