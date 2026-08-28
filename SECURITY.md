# Security Policy

ThreadHelm is pre-release software that will coordinate local AI agent processes and access
user-approved workspaces. Security reports are taken seriously even before the first application
release.

## Supported versions

Only the latest commit on the default branch is currently supported. No packaged release is
available yet.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, or pull request.

Use GitHub's **Report a vulnerability** option in the Security tab of this repository. Include:

- the affected component and commit or version;
- reproduction steps or a proof of concept;
- the expected and observed behavior;
- the potential impact, especially to local files, processes, credentials, or agent authority; and
- any suggested mitigation.

You should receive an acknowledgement within three business days. Please allow time to investigate
and prepare a coordinated fix before publishing details.

## Security expectations

- Never commit API keys, access tokens, credentials, signing certificates, or private user data.
- Treat prompts, agent output, repository content, and tool responses as untrusted input.
- Scope filesystem and command access to user-approved workspaces.
- Keep operating-system access outside the renderer or equivalent presentation layer.
- Require explicit authority for destructive, privileged, or externally consequential actions.
