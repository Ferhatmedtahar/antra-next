# Security

antra runs locally against your source tree. It never sends code anywhere; Studio binds to `127.0.0.1` only. The only network calls are the ones a schema provider makes when you point it at a URL (an OpenAPI spec, for example).

## Reporting a vulnerability

If you find a way antra could be made to execute code, leak the scanned project, or write outside `.antra/` and the files it documents (`antra.config.json`, `.gitignore`, suppression comments from `fix`), please report it privately through [GitHub security advisories](https://github.com/Ferhatmedtahar/Antra/security/advisories/new) rather than a public issue.

A missed leak (false negative) is a bug, not a vulnerability — open a regular issue with the snippet.
