# CapCut TTS Wrapper API

[English README](./README.en.md)

CapCut Web に email / password でログインし、session を維持しながら最新の Web TTS 経路で音声を取得する、セルフホスト用ラッパー API です。

旧来の `token + websocket` 方式ではなく、現在の CapCut Web の認証フローと `storyboard/v1/tts/multi_platform` に合わせています。

## できること

- CapCut Web に email / password でログインして session を維持
- `GET /v1/synthesize` で MP3 音声を取得
- `GET /legacy/synthesize` で旧 token + websocket フローの WAV 音声を取得
- `buffer` と `stream` の 2 つのレスポンス方式に対応
- session を `capcut-session.json` に保存して再利用

## 注意事項

- このプロジェクトは CapCut の公式 SDK / 公式 API ラッパーではありません
- CapCut 側の仕様変更により、突然動かなくなる可能性があります
- 利用にあたっては、各自の責任で公開範囲や運用方法を判断してください

## クイックスタート

### 1. 依存関係をインストール

```bash
npm install
```

### 2. `.env` を作成

```bash
cp .env.example .env
```
### 3. CapCut の認証情報を設定

最低限、次の 2 つを設定してください。

```env
CAPCUT_EMAIL=your-account@example.com
CAPCUT_PASSWORD=your-password
```

通常は他の値はデフォルトのままで動きます。

### 4. 開発サーバーを起動

```bash
npm run dev
```

### 5. API を呼び出す

```bash
curl "http://localhost:8080/v1/synthesize?text=こんにちは&type=0&method=buffer" --output voice.mp3
```

旧フローを使う場合は、`LEGACY_DEVICE_TIME` と `LEGACY_SIGN` を設定したうえで次のように呼び出せます。

```bash
curl "http://localhost:8080/legacy/synthesize?text=こんにちは&type=0&pitch=10&speed=10&volume=10&method=buffer" --output voice.wav
```

## API

### ベース URL

```text
http://<host>:<port>/
```

### エンドポイント

```http
GET /v1/synthesize
```

```http
GET /legacy/synthesize
```

### クエリパラメーター

| パラメーター | 型 | 必須 | 説明 | デフォルト |
| --- | --- | --- | --- | --- |
| `text` | string | はい | 読み上げるテキスト | なし |
| `type` | number | いいえ | 互換用の voice index | `0` |
| `voice` | string | いいえ | 明示的な voice 指定。alias / `effectId` / `resourceId` / `speaker` を受け付けます | なし |
| `pitch` | number | いいえ | 旧互換パラメーター。現在の Web TTS では未使用です | `10` |
| `speed` | number | いいえ | 再生速度。`10` が等速です | `10` |
| `volume` | number | いいえ | 音量。`10` が標準です | `10` |
| `method` | string | いいえ | `buffer` または `stream` | `buffer` |

### レスポンス

| ステータスコード | 内容 |
| --- | --- |
| `200 OK` | `audio/mpeg` |
| `400 Bad Request` | クエリが不正 |
| `502 Bad Gateway` | CapCut 側の認証または音声生成に失敗 |

`/legacy/synthesize` は旧 token + websocket フローを使い、`audio/wav` を返します。
`LEGACY_DEVICE_TIME` と `LEGACY_SIGN` が未設定の場合は `503 Service Unavailable` を返します。

## `type`用 Voice 互換表

`type` は次の固定 voice にマップされます。`voice` を使う場合は `alias` 列の値を指定できます。

これら以外の音声は、`/v1/models`を参照してください。

| type | alias | voice |
| --- | --- | --- |
| `0` | `labebe` | ラベベさん |
| `1` | `cool_lady` | 冷静なレディ |
| `2` | `happy_dino` | ハッピーディノ |
| `3` | `puppet` | おかしなあやつり人形 |
| `4` | `popular_guy` | モテ男 |
| `5` | `bratty_witch` | 生意気な魔女 |
| `6` | `game_host` | ゲームホスト |
| `7` | `calm_dubbing` | 穏やかな吹き替え |
| `8` | `gruff_uncle` | 濁声おじさん |
| `9` | `witch_granny` | 魔婆 |
| `10` | `high_tension` | 高テンション |
| `11` | `serious_man` | 真面目男 |
| `12` | `manager` | マネージャー |
| `13` | `little_sister` | 妹系 |
| `14` | `young_girl` | 幼い女の子 |
| `15` | `peaceful_woman` | 平和な女性 |

## 環境変数

主要な環境変数は次のとおりです。

| 変数名 | 説明 |
| --- | --- |
| `CAPCUT_WEB_URL` | CapCut Web のベース URL |
| `CAPCUT_EDIT_API_URL` | CapCut Edit API のベース URL |
| `CAPCUT_LOGIN_HOST` | primary login host |
| `CAPCUT_FALLBACK_LOGIN_HOST` | fallback login host |
| `CAPCUT_EMAIL` | CapCut ログイン用 email |
| `CAPCUT_PASSWORD` | CapCut ログイン用 password |
| `CAPCUT_LOCALE` | API に送る locale |
| `CAPCUT_PAGE_LOCALE` | login page URL の locale |
| `CAPCUT_REGION` | CapCut request に使う region |
| `CAPCUT_STORE_COUNTRY_CODE` | store-country-code header の値 |
| `CAPCUT_DEVICE_ID` | device id を固定したい場合に指定 |
| `CAPCUT_VERIFY_FP` | verifyFp を固定したい場合に指定 |
| `CAPCUT_VOICE_CATEGORY_ID` | voice catalog 取得に使う category id |
| `CAPCUT_SESSION_STORE_PATH` | session 保存先 |
| `LEGACY_CAPCUT_API_URL` | 旧 token API のベース URL |
| `LEGACY_BYTEINTL_API_URL` | 旧 WebSocket 接続先のベース URL |
| `LEGACY_DEVICE_TIME` | 旧 token API に送る Device-Time |
| `LEGACY_SIGN` | 旧 token API に送る Sign |
| `LEGACY_TOKEN_INTERVAL` | legacy token の再取得間隔。単位は時間 |
| `USER_AGENT` | CapCut へ送る User-Agent |
| `SESSION_REFRESH_INTERVAL_MINUTES` | background session validation 間隔 |
| `HOST` | サーバー待ち受け host |
| `PORT` | サーバー待ち受け port |
| `CORS_POLICY_ORIGIN` | CORS 許可 Origin |

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run build` | `dist/` へビルド |
| `npm run start` | ビルド済みアプリ起動 |

## 補足

- 起動時に session の warmup を試み、その後は `SESSION_REFRESH_INTERVAL_MINUTES` ごとに検証します
- `LEGACY_DEVICE_TIME` と `LEGACY_SIGN` を設定すると、起動時に legacy token の取得も試みます
- `voice` に `effectId` / `resourceId` / `speaker` を直接渡しても選択できます
- 現在の CapCut Web TTS は MP3 を返すため、レスポンスも `audio/mpeg` です
