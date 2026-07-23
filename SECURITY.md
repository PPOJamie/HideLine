# Security policy

## Reporting a vulnerability

Do not publish an exploit, live room code, private image URL or location data in a public issue. Send a private report to the repository owner with:

- the affected version/commit;
- reproducible steps;
- the expected and actual access boundary;
- whether real user data may be exposed;
- a suggested mitigation, where possible.

Repository owners should acknowledge reports promptly, revoke exposed credentials or data, and publish a fix before detailed disclosure.

## Deployment responsibilities

- Never use a Supabase `service_role` key in `config.js` or browser code. Only the public anon key belongs in the app.
- Keep Anonymous Sign-In, Row Level Security and storage policies configured together.
- Review rate limits, CAPTCHA/bot controls, retention and incident procedures before a public launch.
- Treat room codes as invitations, not high-entropy passwords. Share them only with intended players and delete stale rooms according to your retention policy.
- Serve the app over HTTPS so service workers, geolocation and browser security controls operate correctly.
- Review third-party CDN and API dependencies before high-assurance use.

## Security model limitations

HideLine is designed for a cooperative social game, not adversarial anti-cheat. Room members can update shared game state and may inspect the open-source client. Row Level Security is intended to prevent cross-room access and protect team-private rows, but it cannot stop a member from deliberately entering false answers, manipulating shared timers or sharing information outside the app.
