# Git Conventions (Google / Angular Style)

All contributors (including AI agents) MUST follow these rules exactly.

## Branch Naming

Format: `<type>/<short-kebab-description>`

```
feat/dark-mode-toggle         # New feature
fix/duplicate-push-on-crash   # Bug fix
refactor/extract-channel-send # Code restructuring (no behavior change)
docs/add-contributing-guide   # Documentation only
chore/upgrade-dependencies    # Maintenance (CI, deps, config)
test/add-webhook-tests        # Test additions or fixes
perf/batch-channel-queries    # Performance improvement
```

## Commit Message Format

Follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) (Google/Angular convention).

```
<type>(<scope>): <subject>
                                    <- blank line
[optional body]                     <- explain WHY, not WHAT
                                    <- blank line
[optional footer(s)]                <- BREAKING CHANGE, Closes #issue
```

### Header (`<type>(<scope>): <subject>`)

| Element | Rule |
|---------|------|
| **type** | Required. One of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style` |
| **scope** | Optional but recommended. One of: `web`, `worker`, `shared`, `db`, `ci`. Omit only for cross-cutting changes |
| **subject** | Required. Imperative mood. Lowercase. No period. Max 50 chars (hard limit 72) |

**Type definitions**:
- `feat` — new feature visible to users (triggers minor version bump)
- `fix` — bug fix (triggers patch version bump)
- `refactor` — code change that neither fixes a bug nor adds a feature
- `docs` — documentation only (README, CLAUDE.md, comments, JSDoc)
- `test` — adding or correcting tests
- `chore` — maintenance tasks (deps, config, scripts)
- `perf` — performance improvement with no functional change
- `ci` — CI/CD pipeline changes (GitHub Actions, deployment config)
- `build` — build system changes (turbo, tsconfig, package.json)
- `style` — formatting, whitespace, semicolons (no logic change)

### Body & Footer

- Body: Wrap at 72 chars, explain the motivation and contrast with previous behavior
- `BREAKING CHANGE: <description>` — triggers major version bump
- `Closes #<issue-number>` — auto-close linked issue
- `Co-Authored-By: Name <email>` — credit co-authors

### Examples

```
feat(web): add dark mode toggle to settings page

Users requested a dark mode option. Implemented using CSS custom
properties to avoid runtime theme switching overhead.

Closes #42
```

```
fix(worker): prevent duplicate push when worker crashes mid-batch

stamp_last_push_date() now runs before dispatch instead of after,
ensuring at-most-once delivery even on crash.
```

```
refactor(shared): extract channel send logic to shared package

Both worker and admin were duplicating ~120 lines of send logic.
Moved to packages/shared to maintain a single source of truth.
```

## Commit Discipline

- **One logical change per commit** — never mix unrelated changes (e.g. a bug fix and a refactor)
- **Atomic commits** — each commit should build and pass tests independently
- **No "fix typo" chains** — squash trivial fixes into the relevant commit before PR (use `git rebase -i`)

## PR Workflow

1. Create feature branch from `main` using naming convention above
2. Make small, focused commits following the format above
3. Open PR -> CI must pass -> reviewer approves -> **squash merge** into `main`
4. Branch auto-deleted after merge

### PR Description Format

Squash merge produces one commit on `main` — the PR title becomes the commit subject, the PR body becomes the commit body.

| Element | Rule |
|---------|------|
| **Title** | `<type>(<scope>): <subject>` — same format as commit header |
| **Body** | `## Summary` (concise bullet points of what changed and why) + `## Test plan` (verified items as plain text statements) |
| **Test plan** | Only list items that have been verified. Never use unchecked checkboxes (`- [ ]`) or TODO items |

### Documentation Maintenance

Every feature branch must update documentation before opening a PR:

- **`CLAUDE.md`** — update if the change adds/removes files, tables, patterns, or conventions
- **`README.md`** — update if the change affects features, test counts, or user-facing description

Include these doc updates as a `docs:` commit in the same feature branch — do NOT create a separate branch for docs.

## Hard Rules

- **Never** push directly to `main` — always use PRs
- **Squash merge only** — keeps `main` history clean (one PR = one commit on main)
- **Delete branch** after merge (GitHub auto-delete enabled)
- **No force push** to `main` under any circumstances
- **No `--no-verify`** — if a hook fails, fix the issue, don't skip it
