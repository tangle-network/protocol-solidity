<!-- Inspired by: https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md -->

# Contributing to Webb Protocol Projects

A big welcome and thank you for considering contributing to Webb Protocol open source projects! It’s people like you that make it a reality for users in our community.

Reading and following these guidelines will help us make the contribution process easy and effective for everyone involved. It also communicates that you agree to respect the time of the developers managing and developing these open source projects. In return, we will reciprocate that respect by addressing your issue, assessing changes, and helping you finalize your pull requests.

## Quicklinks

- [Contributing to Webb Protocol Projects](#contributing-to-webb-protocol-projects)
  - [Quicklinks](#quicklinks)
  - [Getting Started](#getting-started)
    - [Local qualification](#local-qualification)
    - [Issues](#issues)
    - [Pull Requests](#pull-requests)
  - [Getting Help](#getting-help)


## Getting Started

Contributions are made to this repo via Issues and Pull Requests (PRs). A few general guidelines that cover both:

- To report security vulnerabilities, please direct message <a href="mailto:drew@webb.tools">code maintainers</a> which will promptly be answered.
- Search for existing Issues and PRs before creating your own.
- We work hard to makes sure issues are handled in a timely manner but, depending on the impact, it could take a while to investigate the root cause. A friendly ping in the comment thread to the submitter or a contributor can help draw attention if your issue is blocking.

### Local qualification

Merge the current `origin/main` before qualifying code changes. Use Node from the package's runtime requirements, Corepack/Yarn, Foundry (`forge`), and the pinned Git submodules. The fixture checkout must already contain its approved artifacts; DVC and its existing private storage authorization are needed when restoring fixture data. `yarn fetch:fixtures` verifies and links those files rather than downloading them. Supply `INFURA_API_KEY` through the existing private local environment for RPC-backed tests; never put its value in the repository.

The canonical local gate is `beelink-gate auto https://github.com/tangle-network/protocol-solidity.git <full-sha> -- bash -lc 'git submodule update --init --recursive && yarn fetch:fixtures && yarn clean && yarn compile && yarn build:packages && yarn ts-check && yarn test && (cd packages/contracts && forge build && forge test)'`. The launcher performs the frozen install; package compilation and builds finish before tests. Workflow and documentation changes use YAML and content checks. Package publication and main-branch documentation deployment retain their own workflows.

For JavaScript/TypeScript security qualification, use a separately installed [CodeQL CLI bundle and standard query packs](https://docs.github.com/en/code-security/tutorials/customize-code-scanning/analyze-code) on the Beelink. The retired hosted scan selected JavaScript with the default queries; this uses the corresponding standard code-scanning suite. Run from the qualified repository root and retain the database and SARIF outside the checkout:

```bash
codeql_results="$(mktemp -d /tmp/protocol-solidity-codeql.XXXXXX)"
codeql database create "$codeql_results/javascript" --language=javascript-typescript --source-root="$PWD"
codeql database analyze "$codeql_results/javascript" javascript-code-scanning.qls --format=sarif-latest --output="$codeql_results/javascript.sarif"
```

Inspect the SARIF findings as local release evidence. These commands do not upload to GitHub Security. CLI availability and a completed analysis must be verified on the authoring host; documenting the commands does not establish either.

### Issues

Issues should be used to report problems with the implementation, request a new feature, or to discuss potential changes before a PR is created. When you create a new Issue, a template will be loaded that will guide you through collecting and providing the information we need to investigate.

If you find an Issue that addresses the problem you're having, please add your own reproduction information to the existing issue rather than creating a new one. Adding a [reaction](https://github.blog/2016-03-10-add-reactions-to-pull-requests-issues-and-comments/) can also help be indicating to our maintainers that a particular problem is affecting more than just the reporter.

### Pull Requests

PRs to our libraries are always welcome and can be a quick way to get your fix or improvement slated for the next release. In general, PRs should:

- Only fix/add the functionality in question **OR** address wide-spread whitespace/style issues, not both.
- Prove changed behavior with the relevant integration or served product checks.
- Address a single concern in the least number of changed lines as possible.
- Include documentation in the repo
- Be accompanied by a complete Pull Request template (loaded automatically when a PR is created).

For changes that address core functionality or would require breaking changes (e.g. a major release), it's best to open an Issue to discuss your proposal first. This is not required but can save time creating and reviewing changes.

In general, we follow the ["fork-and-pull" Git workflow](https://github.com/susam/gitpr)

1. Fork the repository to your own Github account
2. Clone the project to your machine
3. Create a branch locally with a succinct but descriptive name
4. Commit changes to the branch
5. Following any formatting and testing guidelines specific to this repo
6. Push changes to your fork
7. Open a PR in our repository and follow the PR template so that we can efficiently review the changes.

## Getting Help

Join us in the [Webb Community](https://discord.gg/cv8EfJu3Tn) and post your question there.