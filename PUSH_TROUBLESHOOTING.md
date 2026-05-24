# Push to GitHub – Troubleshooting

Your remote is: `https://github.com/rizwanarshad-lang/360-Portal.git`

If you get **"Repository not found"** or **"Authentication failed"**, do the following:

---

## 1. Confirm the repository exists

- Log in to GitHub as **rizwanarshad-lang** (or the account that owns the repo).
- Open: https://github.com/rizwanarshad-lang/360-Portal
- If it doesn’t exist, create it: **New** → name: `360-Portal` → **Create repository** (no README/gitignore).

---

## 2. Use a Personal Access Token (HTTPS)

GitHub no longer accepts account passwords for `git push`. Use a **Personal Access Token (PAT)**:

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**.
3. Give it a name, set expiry, and check **repo**.
4. Copy the token (you won’t see it again).

When you run `git push`, use:

- **Username:** your GitHub username (e.g. `rizwanarshad-lang`)
- **Password:** paste the **token** (not your GitHub password).

---

## 3. Update stored credentials (macOS)

If you’ve pushed before with a different account, update the stored credentials:

```bash
# Open Keychain Access, search for "github.com", delete the "github.com" entry.
# Or from terminal:
git credential-osxkeychain erase
host=github.com
protocol=https
```
(Press Enter twice after the last line.)

Then run `git push -u origin main` again; Git will ask for username and password (use the PAT as password).

---

## 4. Use SSH instead of HTTPS

If you have an SSH key added to GitHub:

```bash
git remote set-url origin git@github.com:rizwanarshad-lang/360-Portal.git
git push -u origin main
```

---

## 5. Verify remote and push

```bash
cd "/Users/muhammadarshad/Downloads/360 Portal"
git remote -v
git push -u origin main
```

If the repo is under a **different username or org**, set the correct URL:

```bash
git remote set-url origin https://github.com/CORRECT_USERNAME/360-Portal.git
git push -u origin main
```
