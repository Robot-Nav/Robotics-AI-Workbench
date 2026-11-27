# Private Offer Recording Worker

This Cloudflare Worker hosts the private recording and transcription page. It is intentionally separate from the public GitHub Pages site.

## Access rule

Only the GitHub repository owner account is accepted:

- Login: `Robot-Nav`
- Numeric GitHub user ID: `186013147`
- Repository: `Robot-Nav/Robotics-AI-Workbench`

The callback exchanges the OAuth authorization code on the server, fetches `GET https://api.github.com/user`, and checks both the immutable numeric user ID and login. It then issues a signed, HttpOnly, Secure, SameSite=Lax session cookie. GitHub access tokens are not returned to the browser or stored.

## Deploy

See [Offer Assistant authentication setup](../../docs/tools/offer-assistant/README.md#录音访问控制仅限仓库所有者) for Cloudflare setup, GitHub OAuth App callback URL, and required GitHub Actions secrets.

The workflow deploys this directory with Wrangler. Configure these repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `OFFER_SESSION_SECRET`

First deploy with Cloudflare credentials to obtain the Worker URL. Register the GitHub OAuth App callback as `https://<worker-host>/auth/callback`, then add the OAuth and session secrets and run the workflow again.

## Routes

- `/login`: private-tool landing page
- `/auth/login`: starts GitHub OAuth
- `/auth/callback`: validates OAuth state and GitHub identity
- `/recording`: owner-only recorder and transcription UI
- `/logout`: clears the signed session cookie

## Data handling

The Worker does not accept or store audio uploads. The browser records locally with MediaRecorder; audio is held in page memory until downloaded. Speech recognition uses the browser Speech Recognition API where supported, which may rely on a browser vendor's online service.
