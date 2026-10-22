# @ymd121/cli

Install and configure Vue Grab in a Vite or Nuxt project.

```bash
pnpm dlx @ymd121/cli init
```

## Commands

### `vue-grab init`

Detects Vue 3.5+, Vite or Nuxt, and the package manager. It installs `vue-grab` as a dev dependency, creates a managed `src/vue-grab.ts` options module, adds one import to the entry file, and adds `vueGrab()` to the framework config.

```bash
vue-grab init --yes
vue-grab init --dry-run
vue-grab init -c apps/web --key Meta+K --mode hold --hold 250
```

Options: `--cwd`, `--yes`, `--force`, `--key`, `--mode`, `--hold`, `--context-lines`, `--no-allow-input`, `--skip-install`, `--dry-run`.

### `vue-grab configure`

Edits only the managed options block, never user code around it.

```bash
vue-grab configure --key Meta+K --context-lines 6
```

## Notes

- No telemetry or version checks.
- Nuxt projects get a `plugins/vue-grab.client.ts` plugin and a `vite.plugins` entry so both dev compilers inject the same location attributes.
- Existing config is detected and left idempotent.
