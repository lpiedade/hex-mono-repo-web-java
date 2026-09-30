# Performance and quality measurements

Version-controlled records of measurements the build or the team relies on.

A document here is evidence, not a requirement: functional obligations and the
acceptance they need belong to the [specifications](../spec/). Raw output
(benchmark JSON, coverage HTML) is generated under ignored `target/` or
`coverage/` directories and kept as CI artifacts, not committed.

## Documents

| Document | Scope | Status |
| --- | --- | --- |
| [Coverage ratchet](coverage-ratchet.md) | The per-module coverage floors `mvn clean verify` and `npm run test:coverage` hold, and the procedure for moving them | Enforced — floors measured on the template baseline |

Add a dated document here when you take a measurement worth keeping — a load
test, a baseline before an optimization — and record the command, the commit and
the environment it ran on, so it can be reproduced.
