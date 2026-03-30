# 認証とセッション

## 1. 認証の主経路

CapCut Web の login は、少なくとも今回の HAR では次の順で構成されています

1. login page を開く
2. `_tea_web_id` や `ttwid` を受け取る
3. region 解決 API を呼ぶ
4. email/password login を実行する
5. `passport/web/account/info/` でアカウント確認
6. `cc/v1/workspace/get_user_workspaces` で workspace を取得する

## 2. login page 初期化

### 対象 URL

- `GET https://www.capcut.com/ja-jp/login`

### 役割

- `ttwid`
- `_tea_web_id`
- locale 系 cookie
- `x_logid`

などの初期 cookie を受け取る

### 補足

`_tea_web_id` は以後の `did` として使うのが安定でした

## 3. verifyFp

### 概要

passport API では query parameter として `verifyFp` が付いていました

例:

```text
verify_xxxxxxxx_xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx
```

### 形式

調査時点の実装では、概ね次の形を取っていました

```text
verify_<8-char-ish>_<8>_<4>_<4>_<4>_<12>
```

### 重要点

- 固定値ではない
- login 前提の補助識別子として扱う
- 値自体は秘密ではないが、セッションごとに生成する前提で考えた方がよい

## 4. region 解決

### endpoint

- `POST https://login-row.www.capcut.com/passport/web/region/`

### query

- `aid=348188`
- `account_sdk_source=web`
- `sdk_version=2.1.10-tiktok`
- `language=ja-JP`
- `verifyFp=<generated>`
- `mix_mode=1`

### body

`hashed_id` を送って region を引く

```x-www-form-urlencoded
type=2
hashed_id=<sha256(email_normalized + salt)>
```

### ハッシュ

今回の実装では、HAR とコード解析から次のsoltを使っていました

```text
aDy0TUhtql92P7hScCs97YWMT-jub2q9
```

### 役割

- login host の決定
- region 関連の前提合わせ

## 5. email/password login

### 主 endpoint

- `POST /passport/web/email/login/`

### フォールバック

- `POST /passport/web/user/login/`

### 送信値の変換

`email` と `password` はそのままではなく、次の変換をかける

1. UTF-8 bytes にする
2. 各 byte を `XOR 5`
3. 2 桁 hex 文字列へする

### body 例

```x-www-form-urlencoded
email=<xor5-hex>
password=<xor5-hex>
mix_mode=1
fixed_mix_mode=1
```

### 必須ヘッダの傾向

- `appid: 348188`
- `did: <_tea_web_id>`
- `store-country-code: jp`
- `store-country-code-src: uid`
- `x-tt-passport-csrf-token: <cookie由来 or 空文字>`

### login 成功後に見える cookie

live 検証では、成功回で次の cookie を確認しました

- `_tea_web_id`
- `ttwid`
- `passport_csrf_token`
- `passport_csrf_token_default`
- `sessionid`
- `sessionid_ss`
- `sid_guard`
- `sid_tt`
- `sid_ucp_v1`
- `ssid_ucp_v1`
- `uid_tt`
- `uid_tt_ss`
- `store-country-code`
- `store-country-code-src`
- `store-country-sign`
- `store-idc`
- `cc-target-idc`
- `tt-target-idc-sign`
- `tt_session_tlb_tag`

## 6. account info

### endpoint

- `GET https://www.capcut.com/passport/web/account/info/`

### 役割

- user id の確定
- screen name の取得
- account が login 済みかの確認

### 備考

login payload だけでも最低限進めるが、可能なら account info も取った方が安全です

## 7. workspace 取得

### endpoint

- `POST https://edit-api-sg.capcut.com/cc/v1/workspace/get_user_workspaces`

### body

```json
{
  "cursor": "0",
  "count": 100,
  "need_convert_workspace": true
}
```

### 役割

- `workspace_id`
- `space_id`
- `space_host`

などを取得する

### 補足

CapCut Web の多くの editor 系 API は `workspace_id` 依存です

## 8. sign 署名

### 対象

`edit-api-sg.capcut.com` 側の多くの API は `sign` と `device-time` を付けていました

### 生成式

```text
md5("9e2c|<path末尾7文字>|7|<appvr>|<device-time>|<tdid>|11ac")
```

### 主要ヘッダ

- `appvr`
- `device-time`
- `did`
- `pf=7`
- `sign`
- `sign-ver=1`
- `tdid`

### 重要点

- `did` は `_tea_web_id` を使う
- `tdid` は空でも通る経路があるが、HAR では値ありのケースもあった
- `appvr` は endpoint ごとに異なる
  - workspace 取得では `5.8.0`
  - TTS 実行では `8.4.0`

## 9. セッション失効と rate limit

### 観測した失敗

- `check login error`
- `error_code=7`
  - 試行回数上限に達した系
- `error_code=16`
  - 権限 or risk 判定系に見える失敗

### 実装上の扱い

- `check login error` はセッション失効候補として再ログイン
- login 失敗は cookie を捨てて新しいセッションとしてやり直す
- 短時間の連続 login は避ける

## 10. 現行実装との対応

今回のプロジェクト側では次の責務で実装している

- `src/services/CapCutService.ts`
  セッション維持とフロー制御
- `src/lib/capcut/cookieJar.ts`
  cookie 維持
- `src/api/capcut-login/*`
  passport 系呼び出し
- `src/api/capcut-web/*`
  web account 系
- `src/api/capcut-edit/*`
  workspace / voice / TTS 系
