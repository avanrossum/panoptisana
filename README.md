# Panorasana

A fast, focused Asana visibility tool for macOS. Lives in your menu bar, shows your tasks and projects at a glance.

## Features

- **Task List** - Searchable, sortable list of all incomplete tasks
- **Project List** - Searchable list of all active projects
- **Comment Tracking** - Toggle comments on any task; highlights when new comments arrive
- **Smart Filtering** - Filter by user, exclude tasks/projects by name or GID
- **Dark/Light/System Theme** - 7 accent colors, matches your macOS appearance
- **Global Hotkey** - Ctrl+Shift+A to toggle visibility (configurable)
- **Auto-Updates** - Automatic update checks via GitHub releases
- **Encrypted API Key** - Your Asana API key is encrypted at rest (AES-256-GCM)

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

Panorasana needs a Personal Access Token (PAT) — not an app client secret. To create one:

1. Go to the [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Under **Personal access tokens**, click **Create new token**
3. Give it a name (e.g. "Panorasana") and click **Create token**
4. Copy the token (it starts with `1/`) — you won't be able to see it again

The token is stored encrypted on your machine and is never sent anywhere except directly to Asana's API.

### Setup

1. Launch Panorasana (it appears as a menu bar icon)
2. Click the gear icon or right-click the tray icon to open Settings
3. Paste your Personal Access Token and click **Verify**
4. Select yourself from the "I am" dropdown
5. Optionally check "Show only my tasks" or select specific users

## Development

```bash
npm run dev          # Dev mode (Vite HMR + Electron)
npm run build        # Production build
npm run pack         # Package without signing
```

## Tech Stack

- **Electron 40** - Desktop framework
- **React 19** - UI components
- **Vite 7** - Build tooling
- **electron-updater** - Auto-update support

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## Credits

Built by [MipYip](https://github.com/avanrossum).

Check out [Actions](https://github.com/avanrossum/actions-releases) - a quick action launcher for macOS.
