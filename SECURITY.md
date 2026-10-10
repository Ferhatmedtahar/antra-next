# Security

antra runs locally against your source tree. It never sends code anywhere. Studio binds to `127.0.0.1` only and rejects API requests with a non-local `Host` or `Origin`, and state-changing requests without its own `X-Antra-Studio` header. `antra scan` makes no network calls; the only ones happen during `init`/`sync`, when a schema provider is pointed at a URL (an OpenAPI spec, or a Supabase project read with the key variable you name).

## Reporting a vulnerability

If you find a way antra could be made to execute code, leak the scanned project, or write outside `.antra/` and the files it documents (`antra.config.json`, `.gitignore`, suppression comments from `fix`), please report it privately through [GitHub security advisories](https://github.com/Ferhatmedtahar/antra-next/security/advisories/new) rather than a public issue.

A missed leak (false negative) is a bug, not a vulnerability — open a regular issue with the snippet.
