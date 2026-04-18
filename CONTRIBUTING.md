# Contributing to CaffeCode

Thank you for your interest in contributing to CaffeCode! This guide will help you get started.

## Development Setup

See [README.md](README.md#getting-started) for installation and environment setup.

## Workflow

1. **Fork** the repository and clone your fork.
2. **Create a branch** from `main` using the naming convention below.
3. **Make your changes** with small, focused commits.
4. **Run tests** before pushing: `pnpm test`
5. **Open a pull request** against `main`.

## Branch Naming

```
feat/<short-description>      # New feature
fix/<short-description>       # Bug fix
refactor/<short-description>  # Code restructuring (no behavior change)
docs/<short-description>      # Documentation only
chore/<short-description>     # Maintenance (CI, deps, config)
test/<short-description>      # Test additions or fixes
perf/<short-description>      # Performance improvement
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style`

**Scopes**: `web`, `shared`, `db`, `ci` (omit for cross-cutting changes)

**Rules**:
- Subject: imperative mood, lowercase, no period, max 72 characters
- One logical change per commit

**Examples**:
```
feat(web): add dark mode toggle to settings page
fix(shared): prevent duplicate push on crash recovery
refactor(shared): extract channel send logic to shared package
docs: add CONTRIBUTING.md
```

## Pull Requests

- Keep PRs focused on a single change.
- Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- Ensure CI passes (build + lint + tests).
- PRs are **squash merged** into `main`.

## Code Style

- **TypeScript** — strict mode, no `any` unless unavoidable.
- **Formatting** — follow existing patterns; Tailwind CSS v4 for styling.
- **Supabase** — always destructure `{ data, error }` and handle errors.
- **Testing** — add tests for new logic. Run `pnpm exec vitest run` in the relevant package.

## Project Layout

| Directory | Purpose |
|-----------|---------|
| `apps/web/` | Next.js 16 web application (includes `/api/cron/push` hourly endpoint) |
| `packages/shared/` | Shared library (push pipeline, channel senders, problem selection, formatters) |
| `supabase/migrations/` | Database migration files |
| `scripts/` | Utility scripts |

## Running the Python content scripts

Content generation and LeetCode metadata sync run through Python scripts in `scripts/`. Dependencies are pinned in `scripts/requirements.txt`.

```bash
# First-time setup
pip install -r scripts/requirements.txt

# Sync LeetCode metadata into data/problems/
python3 scripts/sync_leetcode.py
python3 scripts/sync_leetcode.py --dry-run         # preview without writing
python3 scripts/sync_leetcode.py --ids 1,42,200    # sync specific problems

# Assign orphan problems (with content but not in a list) to topic-based lists
python3 scripts/generate_topic_lists.py

# Import a curated list (and its problem content) into Supabase
python3 scripts/build_database.py --list blind75
python3 scripts/build_database.py --list all

# Run Python tests
cd scripts && python3 -m pytest tests/ -v
```

Requires Python 3.11+.

## Reporting Issues

Use the [issue templates](.github/ISSUE_TEMPLATE/) for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
