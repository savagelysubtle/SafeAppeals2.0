# Contributing to SafeAppeals

Welcome — thank you for your interest in contributing to SafeAppeals.

SafeAppeals is an AI-native desktop workspace for legal appeals, research, and complex document work. There are several ways to contribute beyond writing code. This document is a high-level overview of how to get involved.

## Asking Questions

Have a product or usage question? Open a [GitHub Discussion](https://github.com/savagelysubtle/SafeAppeals2.0/discussions) or email [support@safeappeals.com](mailto:support@safeappeals.com).

For development questions about the codebase, open an issue with the `question` label so others can find the answer later.

## Providing Feedback

Comments and feedback are welcome.

- **Product ideas / feature requests**: [GitHub Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues/new) with the `enhancement` label
- **Roadmap**: see [ROADMAP.md](ROADMAP.md) for shipped features and what’s next
- **Email**: [support@safeappeals.com](mailto:support@safeappeals.com)

## Reporting Issues

Found a reproducible problem or have a feature request? We want to hear about it.

### Look for an existing issue

Before creating a new issue, search [open issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues) to see if it already exists.

If you find a match, add a comment with extra detail or react with 👍 instead of opening a duplicate.

### Writing good bug reports and feature requests

- File **one issue per problem** or feature request
- Do not add a different bug as a comment on an unrelated issue

Please include:

- SafeAppeals version (Help → About)
- Operating system
- List of installed extensions (if relevant)
- Reproducible steps (1… 2… 3…)
- What you expected vs. what you saw
- Screenshots, a short video, or console errors (Help → Toggle Developer Tools)

### Creating pull requests

1. Fork the repo and create a branch from `main` (or the active development branch)
2. Follow the coding guidelines in [AGENTS.md](AGENTS.md)
3. Prefer `bun` for scripts (`bun run …`); use `fnm` for Node version management
4. After `src/` changes, restore a launchable tree with `bun run transpile-client`
5. Open a PR with a clear description of the change and how to test it

### Final checklist

- [ ] Searched existing issues so this is not a duplicate
- [ ] Reproduced the issue with a clean workspace when possible
- [ ] Isolated the problem (minimal steps / sample files)
- [ ] PR builds and is testable locally

## Code contributions

If you want to fix bugs or ship features:

1. Read [AGENTS.md](AGENTS.md) for architecture, tooling, and coding standards
2. Check [ROADMAP.md](ROADMAP.md) and [docs/ADDED_FEATURES_TRACKER.md](docs/ADDED_FEATURES_TRACKER.md) for priorities
3. See the [Development Setup](README.md#development-setup) section in the README

SafeAppeals handles confidential legal data. New stores must encrypt user content at rest — see the **Local Data Security** section in [AGENTS.md](AGENTS.md).

## License

By contributing, you agree that your contributions will be licensed under the project’s [Apache License 2.0](LICENSE.txt) (with upstream Code - OSS portions remaining under MIT as described there).

## Thank you

Your contributions — large or small — make SafeAppeals better for people navigating complex document and legal work. Thank you for taking the time to contribute.
