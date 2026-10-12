# CapCut TTS Wrapper API

[English README](./README.en.md)

CapCut の TTS を 2 系統の API で扱えるセルフホスト用ラッパー API です。

- **v1**: token + WebSocket 経路。CapCut アカウントなしで利用できます
- **v2**: CapCut Web editor の session 経路。email / password ログインが必要です

## できること

- CapCut Web に email / password でログインして session を維持
- `GET /v2/speakers` で利用可能な話者一覧を取得
- `GET /v2/speakers/:speakerId/preview` で話者プレビュー音声を取得
- `GET /v2/synthesize` で MP3 音声を取得
- `POST /v2/synthesize` で JSON body を使って MP3 音声を取得
- `GET /v1/synthesize` で token + WebSocket 経路の WAV 音声を取得
- `buffer` と `stream` の 2 つのレスポンス方式に対応
- session を `capcut-session.json` に保存して再利用
- CapCut の bundle から抽出した設定を `capcut-bundle-config.json` に保存して再利用

## 注意事項

- このプロジェクトは CapCut の公式 SDK / 公式 API ラッパーではありません
- CapCut 側の仕様変更により、突然動かなくなる可能性があります
- 利用にあたっては、各自の責任で公開範囲や運用方法を判断してください

## クイックスタート（共通）

### 1. 依存関係をインストール

```bash
npm install
```

### 2. `.env` を作成

```bash
cp .env.example .env
```

### 3. `.env` を用意

v2 を使う場合は、次の 2 つを設定してください。

```env
CAPCUT_EMAIL=your-account@example.com
CAPCUT_PASSWORD=your-password
```

通常は他の値はデフォルトのままで動きます。

### 4. 開発サーバーを起動

```bash
npm run dev
```

## v1 クイックスタート

v1 は token + WebSocket 経路で、CapCut アカウントなしで利用できます。
署名はリクエスト時に自動生成します。

```bash
# 利用できる音声モデル一覧
curl "http://localhost:8080/v1/models"

# 音声合成
curl "http://localhost:8080/v1/synthesize?text=こんにちは&type=0&pitch=10&speed=10&volume=10&method=buffer" --output voice.wav
```

## v2 クイックスタート

v2 は CapCut Web editor の session 経路です。  
`.env` に CapCut アカウント情報を設定してください。

```bash
# 話者一覧を取得
curl "http://localhost:8080/v2/speakers"

# 話者プレビューを取得
curl "http://localhost:8080/v2/speakers/ICL_en_female_jiaoao/preview" --output preview.mp3

# GET で音声合成
curl "http://localhost:8080/v2/synthesize?text=こんにちは&speaker=labebe&method=buffer" --output voice.mp3

# POST で音声合成
curl -X POST "http://localhost:8080/v2/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは","speaker":"labebe","method":"buffer"}' \
  --output voice.mp3
```

## bundle 設定の扱い

このプロジェクトは、CapCut Web の bundle から見つかった各種設定値を `capcut-bundle-config.json` に保存しながら動作します。

ここで保存しているのは、たとえば次のような値です。

- login / account 系 endpoint path
- editor / TTS 系 endpoint path
- `appvr`, `version_name`, `sdk_version` などの version 系値
- editor API の sign 生成に使う recipe
- 音声カテゴリ ID 一覧

`capcut-bundle-config.json` は、実際にページへアクセスして取得した bundle 情報のキャッシュです。ファイルが存在し、その内容がキャッシュ有効期間内であれば、毎回あらためて CapCut のページへアクセスして bundle を取り直さなくても動作します。

逆に、次のような場合は live で再取得を試みます。

- `capcut-bundle-config.json` がまだ存在しない
- キャッシュが期限切れになった
- 必要な設定値がまだ十分に揃っていない

つまり、通常運用では HAR は必須ではありません。現在は HAR なしでも、サーバーが CapCut のページにアクセスできれば bundle 情報を動的に取得し、その結果を `capcut-bundle-config.json` に保存して以後の起動や通信で再利用します。

## HAR と `capcut:extract` の位置づけ

`npm run capcut:extract` は、HAR から `capcut-bundle-config.json` を生成したいときの補助コマンドです。

```bash
npm run capcut:extract
```

これは必須コマンドではありません。主な用途は次のとおりです。

- 初回に HAR から既知の設定を投入して起動を安定させたいとき
- live アクセスを行う前に bundle 情報を手元で固定したいとき
- CapCut 側の変更調査をするとき

## API

### ベース URL

```text
http://<host>:<port>/
```

### エンドポイント

| メソッド | パス                              | 説明                           |
| -------- | --------------------------------- | ------------------------------ |
| GET      | `/v2/speakers`                    | 利用可能な話者一覧を取得       |
| GET      | `/v2/speakers/:speakerId/preview` | 話者プレビュー音声を取得       |
| GET      | `/v2/synthesize`                  | 音声合成（クエリパラメーター） |
| POST     | `/v2/synthesize`                  | 音声合成（JSON body）          |
| GET      | `/v1/models`                      | v1 音声モデル一覧              |
| GET      | `/v1/synthesize`                  | v1 音声合成                    |

### `GET /v2/speakers` レスポンス

```json
[
  {
    "id": "ICL_en_female_jiaoao",
    "speaker": "ICL_en_female_jiaoao",
    "resourceId": "7530105822785899777",
    "effectId": "7530105822785899777",
    "name": "ラベベさん",
    "description": "英語の明るい女性ボイス",
    "style": "",
    "language": "en",
    "isVip": true
  }
]
```

`isVip` は CapCut 側の VIP フラグです。`CAPCUT_EXCLUDE_VIP_VOICES=true` にすると、VIP のうち 11labs 連携の音声だけを一覧から除外します。`isVip` は無料で使える声にも付いているため、除外対象にはなりません。

### `GET /v2/speakers/:speakerId/preview`

指定した話者のプレビュー音声を返します。初回アクセス時のみ音声を生成して `speaker-preview-temp/<speakerId>.mp3` に保存し、以降はキャッシュを返します。ファイルの更新日時が `CAPCUT_SPEAKER_PREVIEW_MAX_AGE_DAYS` を超えた場合は再生成します。

### `GET /v2/synthesize` クエリパラメーター

| パラメーター | 型               | 必須   | 説明                                                                                               | デフォルト |
| ------------ | ---------------- | ------ | -------------------------------------------------------------------------------------------------- | ---------- |
| `text`       | string           | はい   | 読み上げるテキスト                                                                                 | なし       |
| `speaker`    | string           | いいえ | 話者指定。alias / `effectId` / `resourceId` / speaker name を受け付けます。`type` より優先されます | なし       |
| `type`       | number \| string | いいえ | フォールバック用の voice index。`speaker` 未指定時に使用されます                                   | `0`        |
| `pitch`      | number           | いいえ | v1 互換パラメーター。現在の Web TTS では未使用です                                                 | `10`       |
| `speed`      | number           | いいえ | 再生速度。`10` が等速です                                                                          | `10`       |
| `volume`     | number           | いいえ | 音量。`10` が標準です                                                                              | `10`       |
| `method`     | string           | いいえ | `buffer` または `stream`                                                                           | `buffer`   |

### `POST /v2/synthesize` リクエストボディ

GET と同じフィールドを JSON body で送信します。

```json
{
  "text": "こんにちは",
  "speaker": "labebe",
  "speed": 10,
  "volume": 10,
  "method": "buffer"
}
```

### レスポンス

| ステータスコード  | 内容                                |
| ----------------- | ----------------------------------- |
| `200 OK`          | `audio/mpeg`                        |
| `400 Bad Request` | パラメーターが不正                  |
| `502 Bad Gateway` | CapCut 側の認証または音声生成に失敗 |

`/v1/synthesize` は token + WebSocket フローを使い、`audio/wav` を返します。  
署名はリクエスト時に自動生成します。

### 話者解決ルール

| 条件               | 挙動                                    |
| ------------------ | --------------------------------------- |
| `speaker` 指定あり | `speaker` で話者を解決（`type` は無視） |
| `type` のみ指定    | `type` でフォールバック話者を選択       |
| 両方なし           | デフォルト話者（index 0）を使用         |

## `type` / `speaker` 互換表

`type` は次の固定話者にマップされます。`speaker` を使う場合は `alias` 列の値を指定できます。

これら以外の話者は、`/v2/speakers` を参照してください。

| type | alias            | 話者名               |
| ---- | ---------------- | -------------------- |
| `0`  | `labebe`         | ラベベさん           |
| `1`  | `cool_lady`      | 冷静なレディ         |
| `2`  | `happy_dino`     | ハッピーディノ       |
| `3`  | `puppet`         | おかしなあやつり人形 |
| `4`  | `popular_guy`    | モテ男               |
| `5`  | `bratty_witch`   | 生意気な魔女         |
| `6`  | `game_host`      | ゲームホスト         |
| `7`  | `calm_dubbing`   | 穏やかな吹き替え     |
| `8`  | `gruff_uncle`    | 濁声おじさん         |
| `9`  | `witch_granny`   | 魔婆                 |
| `10` | `high_tension`   | 高テンション         |
| `11` | `serious_man`    | 真面目男             |
| `12` | `manager`        | マネージャー         |
| `13` | `little_sister`  | 妹系                 |
| `14` | `young_girl`     | 幼い女の子           |
| `15` | `peaceful_woman` | 平和な女性           |

## 環境変数

主要な環境変数は次のとおりです。

| 変数名                                        | 説明                                 |
| --------------------------------------------- | ------------------------------------ |
| `CAPCUT_WEB_URL`                              | CapCut Web のベース URL              |
| `CAPCUT_EDIT_API_URL`                         | CapCut Edit API のベース URL         |
| `CAPCUT_LOGIN_HOST`                           | primary login host                   |
| `CAPCUT_FALLBACK_LOGIN_HOST`                  | fallback login host                  |
| `CAPCUT_EMAIL`                                | CapCut ログイン用 email              |
| `CAPCUT_PASSWORD`                             | CapCut ログイン用 password           |
| `CAPCUT_LOCALE`                               | API に送る locale                    |
| `CAPCUT_PAGE_LOCALE`                          | login page URL の locale             |
| `CAPCUT_REGION`                               | CapCut request に使う region         |
| `CAPCUT_STORE_COUNTRY_CODE`                   | store-country-code header の値       |
| `CAPCUT_DEVICE_ID`                            | device id を固定したい場合に指定     |
| `CAPCUT_VERIFY_FP`                            | verifyFp を固定したい場合に指定      |
| `CAPCUT_BUNDLE_CONFIG_PATH`                   | bundle 設定キャッシュの保存先        |
| `CAPCUT_SESSION_STORE_PATH`                   | session 保存先                       |
| `CAPCUT_SPEAKER_PREVIEW_TEMP_DIR`             | 話者プレビュー音声キャッシュの保存先 |
| `CAPCUT_SPEAKER_PREVIEW_TEXT`                 | プレビュー生成時に読み上げるテキスト |
| `CAPCUT_SPEAKER_PREVIEW_MAX_AGE_DAYS`         | プレビュー再生成までの日数           |
| `CAPCUT_TTS_TEXT_CHUNK_MAX_LENGTH`            | 長文 TTS を分割する最大文字数        |
| `CAPCUT_TTS_TEXT_CHUNK_BOUNDARY_SEARCH_RATIO` | 区切り文字を探し始める位置の割合     |
| `LEGACY_CAPCUT_API_URL`                       | v1 token API のベース URL            |
| `LEGACY_BYTEINTL_API_URL`                     | v1 WebSocket 接続先のベース URL      |
| `LEGACY_TOKEN_INTERVAL`                       | v1 token の再取得間隔。単位は時間    |
| `USER_AGENT`                                  | CapCut へ送る User-Agent             |
| `SESSION_REFRESH_INTERVAL_MINUTES`            | background session validation 間隔   |
| `HOST`                                        | サーバー待ち受け host                |
| `PORT`                                        | サーバー待ち受け port                |
| `CORS_POLICY_ORIGIN`                          | CORS 許可 Origin                     |

## npm scripts

| コマンド                 | 内容                                        |
| ------------------------ | ------------------------------------------- |
| `npm run dev`            | 開発サーバー起動                            |
| `npm run typecheck`      | TypeScript 型チェック                       |
| `npm run lint`           | ESLint                                      |
| `npm run build`          | `dist/` へビルド                            |
| `npm run start`          | ビルド済みアプリ起動                        |
| `npm run capcut:extract` | HAR から `capcut-bundle-config.json` を生成 |

## 補足

- 起動時に session の warmup を試み、その後は `SESSION_REFRESH_INTERVAL_MINUTES` ごとに検証します
- 起動時や実行時に bundle 情報が必要になると、`capcut-bundle-config.json` を読み込み、必要に応じて live 抽出して更新します
- 起動時に v1 token の取得も試みます
- `speaker` に `effectId` / `resourceId` / speaker name を直接渡しても選択できます
- 現在の CapCut Web TTS は MP3 を返し、レスポンスの `Content-Disposition` は `inline` です
