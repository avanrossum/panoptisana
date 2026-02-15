# Panoptisana

A fast, focused Asana visibility tool for macOS. Lives in your menu bar, shows your tasks and projects at a glance.

## Features

- **Task List** - Searchable, sortable list of all incomplete tasks
- **Project List** - Searchable list of all active projects
- **Comment Tracking** - Toggle comments on any task; highlights when new comments arrive
- **Smart Filtering** - Filter by user, exclude or include tasks/projects by name pattern
- **"Only My Projects" Filter** - Quick checkbox to show only projects you're a member of
- **Right-Click Context Menu** - Right-click any task or project to exclude it or copy its GID
- **Dark/Light/System Theme** - 7 accent colors, matches your macOS appearance
- **Global Hotkey** - Ctrl+Shift+A to toggle visibility (configurable)
- **Auto-Updates** - Automatic update checks via GitHub releases
- **Encrypted API Key** - Your Asana API key is stored securely via the OS Keychain

## Getting Started

### Prerequisites

- macOS 12 or later
- An Asana account with a [Personal Access Token](https://app.asana.com/0/my-apps)

### Install from Release

Download the latest `.dmg` from the [Releases](https://github.com/avanrossum/asana-list/releases) page.

### Build from Source

```bash
git clone https://github.com/avanrossum/asana-list.git
cd asana-list
npm install
npm run dev
```

### Getting an Asana Personal Access Token

Panoptisana needs a Personal Access Token (PAT) — not an app client secret. To create one:

1. Go to the [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Under **Personal access tokens**, click **Create new token**
3. Give it a name (e.g. "Panoptisana") and click **Create token**
4. Copy the token (it starts with `1/`) — you won't be able to see it again

The token is stored encrypted on your machine and is never sent anywhere except directly to Asana's API.

### Setup

1. Launch Panoptisana (it appears as a menu bar icon)
2. Click the gear icon or right-click the tray icon to open Settings
3. Paste your Personal Access Token and click **Verify**
4. Select yourself from the "I am" dropdown
5. Optionally check "Show only my tasks" or select specific users

## Development

```bash
npm run dev          # Dev mode (Vite HMR + Electron)
npm run build        # Production build
npm run pack         # Package without signing
npm run lint         # ESLint
npm test             # Run tests
npm run test:watch   # Tests in watch mode
```

## Development Methodology

Panoptisana is built using AI-assisted development with structured engineering practices. Every feature follows a full software development lifecycle: requirements are captured in a living roadmap, architecture decisions and lessons learned are documented in session context files, and a shared set of design standards (coding conventions, style guides, and testing standards) governs consistency across projects. AI tooling accelerates implementation, but the engineering rigor is human-driven: clear specifications, incremental commits, extracted and tested pure logic, CI/CD gates (lint + test on every push), and a release script that enforces quality checks before any build ships. The methodology treats AI as a collaborator operating within well-defined constraints, not as an autonomous agent — the standards, architecture documentation, and accumulated project memory are what make AI-assisted development effective at scale.

## Known Limitations

- **Single workspace only** — Panoptisana uses the first workspace returned by the Asana API. If your account belongs to multiple workspaces or organizations, only the first one is visible. Multi-workspace support is on the [roadmap](ROADMAP.md).

## Tech Stack

- **Electron 40** - Desktop framework
- **React 19** - UI components
- **Vite 7** - Build tooling
- **Vitest** - Testing framework
- **ESLint** - Code quality
- **GitHub Actions** - CI (lint + test on every push)
- **electron-updater** - Auto-update support

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## Credits

Built by [MipYip](https://github.com/avanrossum).

Check out [Actions](https://github.com/avanrossum/actions-releases) - a quick action launcher for macOS.
