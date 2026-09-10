import json
import os
import subprocess
import threading
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog
import tkinter as tk

CONFIG_FILE = Path(__file__).with_name("git_repo_manager_config.json")


def run_git(repo_path, args):
    return subprocess.run(["git", *args], cwd=repo_path, capture_output=True, text=True)


def load_repos():
    if not CONFIG_FILE.exists():
        return []
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        return data.get("repos", []) if isinstance(data, dict) else []
    except Exception:
        return []


def save_repos(repos):
    CONFIG_FILE.write_text(json.dumps({"repos": repos}, indent=2), encoding="utf-8")


def normalize_remote_url(remote_url):
    if not remote_url:
        return ""
    if remote_url.startswith("git@github.com:"):
        return "https://github.com/" + remote_url.split(":", 1)[1].replace(".git", "")
    if remote_url.startswith(("https://", "http://")):
        return remote_url.replace(".git", "")
    return remote_url


class GitRepoManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Git Repo Manager")
        self.root.geometry("980x600")
        self.root.minsize(800, 500)
        self.repos = load_repos()
        self.selected_repo = None
        self.build_ui()
        self.refresh_repo_list()

    def build_ui(self):
        top = tk.Frame(self.root)
        top.pack(fill="x", padx=10, pady=8)

        tk.Button(top, text="Add Local Repo", command=self.add_local_repo, width=16, bg="#dff0ff").pack(side="left", padx=(8, 8))
        tk.Button(top, text="Clone GitHub", command=self.add_github_repo, width=16, bg="#e7f9ff").pack(side="left", padx=(0, 8))
        tk.Button(top, text="Refresh", command=self.refresh_repo_list, width=12).pack(side="left", padx=(0, 8))
        tk.Button(top, text="Status", command=self.show_status, width=12).pack(side="left", padx=(0, 8))
        tk.Button(top, text="Commit", command=self.commit_repo, width=12, bg="#dff7df").pack(side="left", padx=(0, 8))
        tk.Button(top, text="Push", command=self.push_repo, width=12, bg="#e9e0ff").pack(side="left", padx=(0, 8))
        tk.Button(top, text="Open Folder", command=self.open_repo_folder, width=12).pack(side="left", padx=(0, 8))
        tk.Button(top, text="Open GitHub", command=self.open_remote, width=12).pack(side="left")

        middle = tk.Frame(self.root)
        middle.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self.repo_listbox = tk.Listbox(middle, width=70, height=18, exportselection=False)
        self.repo_listbox.pack(side="left", fill="y", padx=(0, 10))
        self.repo_listbox.bind("<<ListboxSelect>>", self.on_select)

        right = tk.Frame(middle)
        right.pack(side="left", fill="both", expand=True)
        tk.Label(right, text="Output").pack(anchor="w")
        self.output = tk.Text(right, height=18, wrap="word")
        self.output.pack(fill="both", expand=True)

    def on_select(self, event):
        idx = self.repo_listbox.curselection()
        if not idx:
            self.selected_repo = None
            return
        self.selected_repo = self.repos[int(idx[0])]

    def add_local_repo(self):
        folder = filedialog.askdirectory(title="Select a local Git repository")
        if not folder:
            return
        git_dir = os.path.join(folder, ".git")
        if not os.path.isdir(git_dir):
            messagebox.showwarning("Not Git repo", f"This folder is not a Git repository:\n{folder}")
            return
        if folder not in self.repos:
            self.repos.append(folder)
            save_repos(self.repos)
            self.refresh_repo_list()
        self.output.delete("1.0", tk.END)
        self.output.insert(tk.END, f"Added local repo:\n{folder}")

    def add_github_repo(self):
        url = simpledialog.askstring("GitHub URL", "Paste GitHub repo URL\nExample: https://github.com/owner/repo.git")
        if not url or not url.strip():
            return
        url = url.strip()
        parent = filedialog.askdirectory(title="Choose folder to clone into")
        if not parent:
            return
        repo_name = url.rstrip("/").split("/")[-1]
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]
        target_dir = os.path.join(parent, repo_name)
        if os.path.exists(target_dir):
            messagebox.showwarning("Folder exists", f"Folder already exists:\n{target_dir}")
            return

        def worker():
            result = subprocess.run(["git", "clone", url, target_dir], capture_output=True, text=True)
            if result.returncode != 0:
                self.output.delete("1.0", tk.END)
                self.output.insert(tk.END, result.stderr.strip() or result.stdout.strip() or "Clone failed.")
                return
            self.repos.append(target_dir)
            save_repos(self.repos)
            self.refresh_repo_list()
            self.output.delete("1.0", tk.END)
            self.output.insert(tk.END, f"Cloned successfully:\n{target_dir}\n\n{result.stdout.strip()}")

        threading.Thread(target=worker, daemon=True).start()

    def refresh_repo_list(self):
        self.repo_listbox.delete(0, tk.END)
        for repo in self.repos:
            try:
                branch = self.get_branch(repo)
                status = self.get_status_text(repo)
            except Exception:
                branch = "-"
                status = "Error"
            label = f"{os.path.basename(repo) or repo} | {branch} | {status}"
            self.repo_listbox.insert(tk.END, label)

    def get_branch(self, repo_path):
        result = run_git(repo_path, ["branch", "--show-current"])
        return result.stdout.strip() if result.stdout.strip() else "(detached)"

    def get_status_text(self, repo_path):
        result = run_git(repo_path, ["status", "--short"])
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        return "Clean" if not lines else f"{len(lines)} changed"

    def show_status(self):
        repo = self.selected_repo or (self.repos[0] if self.repos else None)
        if not repo:
            messagebox.showwarning("No repo", "Add or select a repo first.")
            return
        result = run_git(repo, ["status", "--short", "--branch"])
        self.output.delete("1.0", tk.END)
        self.output.insert(tk.END, result.stdout.strip() or result.stderr.strip() or "No status output.")

    def commit_repo(self):
        repo = self.selected_repo or (self.repos[0] if self.repos else None)
        if not repo:
            messagebox.showwarning("No repo", "Add or select a repo first.")
            return
        message = simpledialog.askstring("Commit message", "Write commit message", initialvalue="Update project")
        if not message:
            return
        result_add = run_git(repo, ["add", "."])
        result_commit = run_git(repo, ["commit", "-m", message])
        output = (result_add.stdout or "") + (result_add.stderr or "") + "\n" + (result_commit.stdout or "") + (result_commit.stderr or "")
        self.output.delete("1.0", tk.END)
        self.output.insert(tk.END, output.strip() or "Commit finished.")
        self.refresh_repo_list()

    def push_repo(self):
        repo = self.selected_repo or (self.repos[0] if self.repos else None)
        if not repo:
            messagebox.showwarning("No repo", "Add or select a repo first.")
            return
        result = run_git(repo, ["push"])
        self.output.delete("1.0", tk.END)
        self.output.insert(tk.END, (result.stdout or "") + (result.stderr or "") or "Push completed.")
        self.refresh_repo_list()

    def open_repo_folder(self):
        repo = self.selected_repo or (self.repos[0] if self.repos else None)
        if not repo:
            messagebox.showwarning("No repo", "Add or select a repo first.")
            return
        os.startfile(repo)

    def open_remote(self):
        repo = self.selected_repo or (self.repos[0] if self.repos else None)
        if not repo:
            messagebox.showwarning("No repo", "Add or select a repo first.")
            return
        result = run_git(repo, ["remote", "get-url", "origin"])
        remote = normalize_remote_url(result.stdout.strip())
        if remote:
            webbrowser.open(remote)
        else:
            messagebox.showwarning("No remote", "This repo has no GitHub remote URL.")


def main():
    root = tk.Tk()
    GitRepoManagerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
