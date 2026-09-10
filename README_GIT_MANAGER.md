# Git Repo Manager

This small desktop app lets you manage multiple Git repositories from one place.

## Features
- Add any Git repository folder
- See repo name, local path, current branch, and status
- Commit all changes with one click
- Pull and push selected repo
- Open repo folder or GitHub remote in browser

## Run it
1. Make sure Python is installed.
2. Double-click `start_git_manager.bat`.
3. Or run:
   `python git_repo_manager.py`

## Notes
- If a repo is not a real Git repo, the app will reject it.
- Commit creates a commit from all tracked/untracked changes in that repo.
- Push requires a valid remote URL.

## Safe use
All repository data stays on your machine. This app does not upload anything by itself.
