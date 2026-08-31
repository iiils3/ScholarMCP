# Neon database

This directory is the versioned database source of truth for ScholarMCP.

- Project: `ScholarMCP` in Neon.
- Do not reuse databases, schemas, credentials or organizations belonging to unrelated products.
- Apply migrations in numeric order.
- Authentication remains an adapter boundary; the baseline schema stores a stable external auth subject and does not store raw passwords.
