# Security

Do not disclose credentials, private drawings or security vulnerabilities in public issues.
Use GitHub's private vulnerability reporting for this repository when enabled. If it is
unavailable, contact the repository owner privately before sharing reproduction details.
This document does not claim an unconfigured reporting channel is active.

Include the affected revision, impact and a minimal reproduction using synthetic data.
Do not upload another user's documents or exploit a live deployment.

## Deployment responsibilities

Keep environment files private; configure exact HTTPS origins, verified PostgreSQL TLS,
trusted proxies and private storage according to the VPS guide. Development Compose
credentials and published loopback ports are not production settings. Public registration
is an explicit deployment choice. Do not bypass permissions, CSRF or rate limits to fix tests.

CI checks high/critical dependency advisories and scans the checkout for secrets with
redacted output. These checks do not replace security review. Confirmed accidental key
exposure requires revocation/rotation; simply deleting a file is insufficient.

Only the current development branch is actively maintained. No additional release support
window, service-level agreement or transfer of code ownership is established here.
