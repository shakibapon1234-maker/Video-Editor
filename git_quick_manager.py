import json
import os
import subprocess
import sys
from pathlib import Path

CONFIG = Path(__file__).with_name("git_quick_manager_config.json")


def load_repos():
    if not CONFIG.exists():
        return []
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_repos(repos):
    CONFIG.write_text(json.dumps(repos, indent=2), encoding="utf-8")


def run_git(repo, args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)


def choose_repo(repos):
    if not repos:
        print("No repos added yet.")
        return None
    for i, repo in enumerate(repos, 1):
        print(f"{i}. {repo}")
    while True:
        try:
            choice = input("Select repo number: ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(repos):
                return repos[idx]
            print("Invalid number.")
        except ValueError:
            print("Enter a valid number.")


def add_local_repo():
    repos = load_repos()
    folder = input("Paste local repo folder path: ").strip().strip('"')
    if not folder:
        print("No path entered.")
        return repos
    if not os.path.isdir(folder):
        print("Folder not found.")
        return repos
    git_dir = os.path.join(folder, ".git")
    if not os.path.isdir(git_dir):
        print("This is not a Git repository.")
        return repos
    if folder not in repos:
        repos.append(folder)
        save_repos(repos)
        print(f"Added: {folder}")
    else:
        print("Already added.")
    return repos


def add_github_repo():
    repos = load_repos()
    url = input("GitHub repo URL: ").strip().strip('"')
    if not url:
        print("No URL entered.")
        return repos
    parent = input("Clone folder path (press Enter to use current folder): ").strip().strip('"')
    if not parent:
        parent = os.getcwd()
    if not os.path.isdir(parent):
        print("Clone folder does not exist.")
        return repos
    repo_name = url.rstrip("/").split("/")[-1]
    if repo_name.endswith(".git"):
        repo_name = repo_name[:-4]
    target = os.path.join(parent, repo_name)
    if os.path.exists(target):
        print(f"Target already exists: {target}")
        return repos
    result = subprocess.run(["git", "clone", url, target], capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr.strip() or result.stdout.strip() or "Clone failed.")
        return repos
    repos.append(target)
    save_repos(repos)
    print(f"Cloned successfully to: {target}")
    return repos


def show_status(repo):
    res = run_git(repo, ["status", "--short", "--branch"])
    print(res.stdout.strip() or res.stderr.strip() or "No status output.")


def commit_repo(repo):
    msg = input("Commit message: ").strip() or "Update project"
    add = run_git(repo, ["add", "."])
    if add.returncode != 0:
        print(add.stderr.strip() or add.stdout.strip() or "Add failed.")
        return
    commit = run_git(repo, ["commit", "-m", msg])
    output = (commit.stdout + commit.stderr).strip()
    if commit.returncode == 0:
        print("Commit successful.")
    else:
        print(output or "Commit failed.")


def push_repo(repo):
    res = run_git(repo, ["push"])
    output = (res.stdout + res.stderr).strip()
    if res.returncode == 0:
        print("Push successful.")
    else:
        print(output or "Push failed.")


def list_repos(repos):
    for repo in repos:
        print(repo)


def main():
    repos = load_repos()
    while True:
        print("\nGit Quick Manager")
        print("1. Add Local Repo")
        print("2. Clone GitHub Repo")
        print("3. List Repos")
        print("4. Status")
        print("5. Commit")
        print("6. Push")
        print("7. Open Folder")
        print("8. Exit")
        choice = input("Choose: ").strip()

        if choice == "1":
            repos = add_local_repo()
        elif choice == "2":
            repos = add_github_repo()
        elif choice == "3":
            list_repos(repos)
        elif choice == "4":
            repo = choose_repo(repos)
            if repo:
                show_status(repo)
        elif choice == "5":
            repo = choose_repo(repos)
            if repo:
                commit_repo(repo)
        elif choice == "6":
            repo = choose_repo(repos)
            if repo:
                push_repo(repo)
        elif choice == "7":
            repo = choose_repo(repos)
            if repo:
                os.startfile(repo)
        elif choice == "8":
            print("Goodbye.")
            break
        else:
            print("Invalid option.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as exc:
        print(f"Error: {exc}")
        input("Press Enter to exit...")
