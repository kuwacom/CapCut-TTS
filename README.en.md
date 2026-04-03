# CapCut TTS Wrapper API

[日本語 README](./README.md)

A self-hosted wrapper API for logging in to CapCut Web with email / password, keeping the session alive, and fetching audio through the latest Web TTS flow

Instead of the old `token + websocket` approach, this project follows the current CapCut Web authentication flow and `storyboard/v1/tts/multi_platform`

## Features

- Log in to CapCut Web with email / password and keep the session alive
- Fetch MP3 audio through `GET /v1/synthesize`
- Fetch WAV audio through the old token + websocket flow via `GET /legacy/synthesize`
- Support both `buffer` and `stream` response modes
- Save and reuse the session in `capcut-session.json`
- Save and reuse bundle-derived runtime settings in `capcut-bundle-config.json`

## Notes

- This project is not an official CapCut SDK or official API wrapper
- It may stop working at any time if CapCut changes its internal implementation
- Please decide how to publish and operate it at your own risk

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```bash
cp .env.example .env
```

### 3. Set CapCut credentials

At minimum, configure the following two values

```env
CAPCUT_EMAIL=your-account@example.com
CAPCUT_PASSWORD=your-password
```

The default values are usually enough for everything else

### 4. Start the development server

```bash
npm run dev
```

### 5. Call the API

```bash
curl "http://localhost:8080/v1/synthesize?text=Hello&type=0&method=buffer" --output voice.mp3
```

If you want to use the old flow, configure `LEGACY_DEVICE_TIME` and `LEGACY_SIGN` and call:

```bash
curl "http://localhost:8080/legacy/synthesize?text=Hello&type=0&pitch=10&speed=10&volume=10&method=buffer" --output voice.wav
```

## How Bundle Config Works

This project stores settings discovered from CapCut Web bundles in `capcut-bundle-config.json`.

That file can contain values such as:

- login and account endpoint paths
- editor and TTS endpoint paths
- version-related values such as `appvr`, `version_name`, and `sdk_version`
- the sign recipe used for edit API requests
- discovered voice category ids

`capcut-bundle-config.json` is effectively a cache of bundle information fetched from real CapCut pages. If the file already exists and its contents are still within the cache window, the server does not need to re-fetch bundle pages every time.

The service will try live extraction again when:

- `capcut-bundle-config.json` does not exist yet
- the cache has expired
- the current cached values are not sufficient

This means HAR files are not required for normal operation. As long as the server can access CapCut pages, it can discover bundle settings dynamically, save them to `capcut-bundle-config.json`, and reuse them on later runs.

## HAR and `capcut:extract`

`npm run capcut:extract` is an optional helper command that generates `capcut-bundle-config.json` from HAR files.

```bash
npm run capcut:extract
```

This command is not required for normal runtime. It is mainly useful when you want to:

- preload known bundle values from HAR before the first startup
- prepare bundle settings without relying on live page access first
- investigate CapCut changes offline

The current implementation does not rely on blindly hardcoded constants. Instead, it prefers values discovered from one of these sources and stores them in `capcut-bundle-config.json`:

- values extracted from HAR files
- values extracted live from real CapCut pages

In other words, the operating model is: reuse saved bundle settings first, and refresh them only when needed.

## API

### Base URL

```text
http://<host>:<port>/
```

### Endpoint

```http
GET /v1/synthesize
```

```http
GET /legacy/synthesize
```

### Query Parameters

| Parameter | Type | Required | Description | Default |
| --- | --- | --- | --- | --- |
| `text` | string | Yes | Text to read aloud | None |
| `type` | number | No | Compatibility voice index | `0` |
| `voice` | string | No | Explicit voice selector. Accepts alias / `effectId` / `resourceId` / `speaker` | None |
| `pitch` | number | No | Legacy compatibility parameter. Currently unused by the Web TTS flow | `10` |
| `speed` | number | No | Playback speed. `10` means normal speed | `10` |
| `volume` | number | No | Volume. `10` means standard level | `10` |
| `method` | string | No | `buffer` or `stream` | `buffer` |

### Responses

| Status Code | Description |
| --- | --- |
| `200 OK` | `audio/mpeg` |
| `400 Bad Request` | Invalid query |
| `502 Bad Gateway` | Authentication or synthesis failed on the CapCut side |

`/legacy/synthesize` uses the old token + websocket flow and returns `audio/wav`.
If `LEGACY_DEVICE_TIME` and `LEGACY_SIGN` are not configured, it returns `503 Service Unavailable`.

## Voice Compatibility Table For `type`

`type` maps to the fixed voices below. When using `voice`, you can pass the value from the `alias` column

For voices outside this table, refer to `/v1/models`

| type | alias | voice |
| --- | --- | --- |
| `0` | `labebe` | Ms. Labebe |
| `1` | `cool_lady` | Cool Lady |
| `2` | `happy_dino` | Happy Dino |
| `3` | `puppet` | Funny Puppet |
| `4` | `popular_guy` | Popular Guy |
| `5` | `bratty_witch` | Bratty Witch |
| `6` | `game_host` | Game Host |
| `7` | `calm_dubbing` | Calm Dubbing |
| `8` | `gruff_uncle` | Gruff Uncle |
| `9` | `witch_granny` | Witch Granny |
| `10` | `high_tension` | High Tension |
| `11` | `serious_man` | Serious Man |
| `12` | `manager` | Manager |
| `13` | `little_sister` | Little Sister |
| `14` | `young_girl` | Young Girl |
| `15` | `peaceful_woman` | Peaceful Woman |

## Environment Variables

Main environment variables are listed below

| Variable | Description |
| --- | --- |
| `CAPCUT_WEB_URL` | Base CapCut Web URL |
| `CAPCUT_EDIT_API_URL` | Base CapCut Edit API URL |
| `CAPCUT_LOGIN_HOST` | Primary login host |
| `CAPCUT_FALLBACK_LOGIN_HOST` | Fallback login host |
| `CAPCUT_EMAIL` | CapCut login email |
| `CAPCUT_PASSWORD` | CapCut login password |
| `CAPCUT_LOCALE` | Locale sent to the API |
| `CAPCUT_PAGE_LOCALE` | Locale used in the login page URL |
| `CAPCUT_REGION` | Region used in CapCut requests |
| `CAPCUT_STORE_COUNTRY_CODE` | Value for the `store-country-code` header |
| `CAPCUT_DEVICE_ID` | Set this if you want to fix the device id |
| `CAPCUT_VERIFY_FP` | Set this if you want to fix verifyFp |
| `CAPCUT_BUNDLE_CONFIG_PATH` | Path for the persisted bundle config cache |
| `CAPCUT_VOICE_CATEGORY_ID` | Category id used when fetching the voice catalog |
| `CAPCUT_SESSION_STORE_PATH` | Session persistence path |
| `LEGACY_CAPCUT_API_URL` | Base URL for the old token API |
| `LEGACY_BYTEINTL_API_URL` | Base URL for the old websocket endpoint |
| `LEGACY_DEVICE_TIME` | Device-Time sent to the old token API |
| `LEGACY_SIGN` | Sign sent to the old token API |
| `LEGACY_TOKEN_INTERVAL` | Legacy token refresh interval in hours |
| `USER_AGENT` | User-Agent sent to CapCut |
| `SESSION_REFRESH_INTERVAL_MINUTES` | Background session validation interval |
| `HOST` | Server bind host |
| `PORT` | Server bind port |
| `CORS_POLICY_ORIGIN` | Allowed CORS origin |

## npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run build` | Build to `dist/` |
| `npm run start` | Start the built app |
| `npm run capcut:extract` | Generate `capcut-bundle-config.json` from HAR files |

## Additional Notes

- The server attempts a session warmup on startup and validates it every `SESSION_REFRESH_INTERVAL_MINUTES`
- When bundle settings are needed, the server loads `capcut-bundle-config.json` first and refreshes it through live extraction only when necessary
- When `LEGACY_DEVICE_TIME` and `LEGACY_SIGN` are set, the server also warms up the legacy token flow on startup
- You can also pass `effectId`, `resourceId`, or `speaker` directly to `voice`
- The current CapCut Web TTS returns MP3, so the response content type is `audio/mpeg`
