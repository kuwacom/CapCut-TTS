# CapCut TTS Wrapper API

[日本語 README](./README.md)

A self-hosted wrapper API for logging in to CapCut Web with email / password, keeping the session alive, and fetching audio through the latest Web TTS flow

Instead of the old `token + websocket` approach, this project follows the current CapCut Web authentication flow and `storyboard/v1/tts/multi_platform`

## Features

- Log in to CapCut Web with email / password and keep the session alive
- Fetch MP3 audio through `GET /v1/synthesize`
- Support both `buffer` and `stream` response modes
- Save and reuse the session in `capcut-session.json`

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

## API

### Base URL

```text
http://<host>:<port>/v1/
```

### Endpoint

```http
GET /v1/synthesize
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
| `CAPCUT_VOICE_CATEGORY_ID` | Category id used when fetching the voice catalog |
| `CAPCUT_SESSION_STORE_PATH` | Session persistence path |
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

## Additional Notes

- The server attempts a session warmup on startup and validates it every `SESSION_REFRESH_INTERVAL_MINUTES`
- You can also pass `effectId`, `resourceId`, or `speaker` directly to `voice`
- The current CapCut Web TTS returns MP3, so the response content type is `audio/mpeg`
