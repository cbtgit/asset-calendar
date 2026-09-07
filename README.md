# Asset Calendar

Asset Calendar is a React and TypeScript app built with Vite+.

## Requirements

- Node.js `24.20.0` (the version in `.node-version`)
- npm `11.19.0` (bundled with that Node.js release)

## Local development

Install Vite+ with the official installer, then install the project
dependencies:

```sh
curl -fsSL https://vite.plus | bash
vp install
```

Start the development server:

```sh
vp dev
```

Run the quality checks, tests, or production build:

```sh
vp check
vp test
vp build
```

The Vite development server keeps its default loopback host. Use `vp preview`
to preview a production build locally.

## Copilot cloud-agent setup

The `copilot-setup-steps` workflow installs the pinned Node.js version,
configures Vite+, caches dependencies, and runs `vp install`. The same `vp`
commands documented above are then available to the cloud agent.
