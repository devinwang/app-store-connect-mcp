# Security

## Threat model

Running `app-store-connect-mcp` grants an LLM the ability to call App Store Connect as you. Treat the `.p8` file with the same care as an SSH key or a production deployment token.

| Asset | Protection |
|---|---|
| `.p8` private key (on disk) | `chmod 600`, outside any git repo, `.gitignore` blocks commit by accident |
| `.p8` content (in memory) | Read fresh on every JWT sign, buffer zeroed + dereferenced immediately after. Never cloned, never logged, never returned from any tool. |
| Key ID / Issuer ID | Not secrets per se (Apple surfaces them in the ASC web UI), but still written only into `~/.app-store-connect-mcp/accounts.json` with mode `0600`. |
| Signed JWTs | In-memory only, never written to disk, 20-minute lifetime, invalidated on account switch / update / remove. |
| Tool outputs | Passed through `redact()` — any JWT-shaped string, `-----BEGIN PRIVATE KEY-----` block, `Bearer` header, or long hex token is replaced with `[REDACTED …]` before reaching the MCP client. |

## Key rotation

1. Generate a new key in App Store Connect → Users and Access → Integrations.
2. Download the new `.p8`.
3. Revoke the old key.
4. Update the MCP: `accounts_update --keyFile /path/to/AuthKey_NEW.p8 --keyId NEW`
5. Call `auth_revoke_cache` followed by `auth_status` to verify the new key works.

## Restricting an account's scope

App Store Connect roles give coarse control (Admin, Developer, Finance, Marketing, etc.). For finer-grained enforcement, use JWT scope:

```
accounts_update --name my-app --scope '["GET /v1/apps", "GET /v1/builds"]'
```

`accounts_add` also accepts `scope`. Leave empty for full access.

## Reporting a vulnerability

Open a GitHub issue marked `[security]`, or email the author privately. We'll acknowledge within 72 hours.
