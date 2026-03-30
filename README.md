# CapCut TTS Rapper API

[English README](./README.en.md)

CapCut の TTS をシンプルな HTTP API として使いやすくする、セルフホストラッパーAPIです。

このプロジェクトを使うと、CapCut 側の TTS リクエストに必要なトークン更新をサーバー側で吸収しながら、`GET /v1/synthesize` で音声を取得できます。

## できること

- CapCut の TTS をシンプルな HTTP API として利用
- `buffer` と `stream` の 2 つのレスポンス方式に対応
- トークンの自動取得と定期更新
- TypeScript + Express 5 ベースで運用しやすい構成

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

macOS / Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. `DEVICE_TIME` と `SIGN` を設定

`.env` に最低限、次の 2 つを設定してください。

```env
DEVICE_TIME=
SIGN=
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

デフォルトの待ち受け先:

- `http://0.0.0.0:8080`
- ブラウザやクライアントからのアクセス例: `http://localhost:8080`

### 5. API を呼び出す

```bash
curl "http://localhost:8080/v1/synthesize?text=こんにちは&type=0&pitch=10&speed=10&volume=10&method=buffer" --output voice.wav
```

## `DEVICE_TIME` と `SIGN` の取得方法

CapCut にログインした状態で、ブラウザの DevTools を使って値を取得します。

### 手順

1. CapCut にログインし、空の新規プロジェクトを作成します
2. 適当なテキストを追加して、テキスト読み上げタブへ移動します
3. DevTools の Network を開き、`Clear Network log` でログを一度消します
4. 適当な声を選んで音声を生成します
5. 通信一覧から `token` を含む `POST` リクエストを探します
6. そのリクエストヘッダーから `Device-Time` と `Sign` をコピーして `.env` に入れます

通信が多い場合は、Network のフィルターで `token` と検索すると見つけやすいです。

### 参考画像

CapCut 側で TTS を生成する画面:

![CapCut TTS screen](./images/1.png)

Network から対象リクエストを探すイメージ:

![CapCut Network log](./images/2.png)

## API 仕様

### ベース URL

```text
http://<host>:<port>/v1/
```

### エンドポイント

```http
GET /v1/synthesize
```

### クエリパラメーター

| パラメーター | 型 | 必須 | 説明 | デフォルト |
| --- | --- | --- | --- | --- |
| `text` | string | はい | 読み上げるテキスト | なし |
| `type` | number | いいえ | 音声タイプ | `0` |
| `pitch` | number | いいえ | ピッチ | `10` |
| `speed` | number | いいえ | スピード | `10` |
| `volume` | number | いいえ | ボリューム | `10` |
| `method` | string | いいえ | `buffer` または `stream` | `buffer` |

### リクエスト例

```http
GET http://localhost:8080/v1/synthesize?text=こんにちは&type=0&pitch=10&speed=10&volume=10&method=buffer
```

### レスポンス

| ステータスコード | 内容 |
| --- | --- |
| `200 OK` | `audio/wav` を返します |
| `400 Bad Request` | クエリパラメーターが不正です |
| `502 Bad Gateway` | CapCut 側の音声生成に失敗しました |
| `503 Service Unavailable` | トークンがまだ取得できていません |

`method=buffer` の場合は音声全体をまとめて返します。  
`method=stream` の場合は音声データを順次ストリームで返します。

OpenAPI 定義は [openapi.yaml](./openapi.yaml) を参照してください。

## Voice Type 一覧

| type | 声の種類 | スピーカー ID |
| --- | --- | --- |
| 0 | 謎1 男子1 | `BV525_streaming` |
| 1 | 謎2 坊や | `BV528_streaming` |
| 2 | カワボ | `BV017_streaming` |
| 3 | お姉さん | `BV016_streaming` |
| 4 | 少女 | `BV023_streaming` |
| 5 | 女子 | `BV024_streaming` |
| 6 | 男子2 | `BV018_streaming` |
| 7 | 坊ちゃん | `BV523_streaming` |
| 8 | 女子 | `BV521_streaming` |
| 9 | 女子アナ | `BV522_streaming` |
| 10 | 男性アナ | `BV524_streaming` |
| 11 | 元気ロリ | `BV520_streaming` |
| 12 | 明るいハニー | `VOV401_bytesing3_kangkangwuqu` |
| 13 | 優しいレディー | `VOV402_bytesing3_oh` |
| 14 | 風雅メゾソプラノ | `VOV402_bytesing3_aidelizan` |
| 15 | Sakura | `jp_005` |
| その他 / 未指定 | お姉さん | `BV016_streaming` |

## 環境変数

主要な環境変数は次のとおりです。

| 変数名 | 説明 | 例 |
| --- | --- | --- |
| `CAPCUT_API_URL` | CapCut の token 取得 API | `https://edit-api-sg.capcut.com/lv/v1` |
| `BYTEINTL_API_URL` | WebSocket 接続先のベース URL | `wss://sami-sg1.byteintlapi.com/internal/api/v1` |
| `DEVICE_TIME` | CapCut 側リクエストから取得した値 | 取得必須 |
| `SIGN` | CapCut 側リクエストから取得した値 | 取得必須 |
| `USER_AGENT` | token 取得時に使う User-Agent | Chrome 系の値 |
| `HOST` | サーバーの待ち受けホスト | `0.0.0.0` |
| `PORT` | サーバーの待ち受けポート | `8080` |
| `CORS_POLICY_ORIGIN` | CORS 許可 Origin | `*` |
| `ORIGIN` | 旧構成との互換用 Origin 設定 | `*` |
| `TOKEN_INTERVAL` | token の再取得間隔。単位は時間 | `6` |

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | `tsx watch` で開発サーバーを起動 |
| `npm run typecheck` | TypeScript の型チェック |
| `npm run lint` | `src/**/*.ts` を ESLint で検査 |
| `npm run lint:fix` | ESLint の自動修正 |
| `npm run build` | `dist/` にビルド |
| `npm run start` | ビルド済みのアプリを起動 |
| `npm run test` | `build` 後に `start` を実行 |

## ディレクトリ概要

```text
.
├─ src/
│  ├─ api/
│  ├─ configs/
│  ├─ middleware/
│  ├─ routes/
│  │  └─ v1/
│  │     └─ synthesize/
│  ├─ schemas/
│  ├─ services/
│  ├─ types/
│  └─ utils/
├─ images/
├─ openapi.yaml
├─ package.json
└─ tsconfig.json
```

## 補足

- 起動時に token の取得を試行し、その後は `TOKEN_INTERVAL` 時間ごとに自動更新します
- 最新構成では `CORS_POLICY_ORIGIN` を優先して参照します
- 既存設定との互換のため、`ORIGIN` も引き続き読み取り可能です
