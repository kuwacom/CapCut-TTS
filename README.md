# What is this
CapCut の読み上げAPIのセルフホストRapperAPIです

# NEWS
### 2024/05/29
> **tokenが取得できないバグが修正されました！**

### 2024/05/27
> **新しい方法の糸口が見えた！！もうしばらくしたら修正アップデートします！！**

### 2024/02/07
> **2024/02/07 時点でAPIのバージョンが変わり新規に取得した `SIGN` 及び `DEVICE_TIME` を利用したtokenの生成ができなくなりました。** <br>
現在新しくtokenを取得する方法を準備中です。

# How To Use
## .envファイルの作成
`.env`ファイルを作成し、その中に以下の項目を作成してください。
```
DEVICE_TIME=""
SIGN=""
```
それぞれの項目に以下の手順で取得した値を入力してください。

## 値の入手
![1](/images/1.png)

CapCutへログイン後、新規プロジェクトを空で作成し適当なテキストを作成します。

その後、テキスト読み上げタブへ移り、DevToolsの`Clear Network log`をクリックして一度ログを消して見やすくします。

![2](/images/2.png)

その後、適当な声を選択して生成させましょう。

すると、いくつかの通信が行われログが出てきます。

最初の`2000ms`程度をフィルタして見てみると画像のような通信ログがあるはずです。(もし数が多い場合は、`Filter`から`token`と検索してください。)

その中から`POST`で通信している`token`を見つけてください。

その通信のリクエストヘッダーから画像の二つの値、`Device-Time`と`Sign`をコピーして先ほど作成した`.env`ファイルの各変数へ記入します。

# API Docs
## ベースURL
```
http://<host>:<port>/v1/
```
## エンドポイント
### synthesize
#### リクエスト
```http
GET /v1/synthesize
```
#### クリエパラメーター
| パラメーター | 型 | 必須 | 説明 | デフォルト値 |
|--------------|----|------|------|--------------|
| `text`   | string | はい | 音声に変換するテキスト | - |
| `type`   | number | いいえ | 使用する音声のタイプ | `0` |
| `pitch`  | number | いいえ | 合成された音声のピッチ | `10` |
| `speed`  | number | いいえ | 合成された音声のスピード | `10` |
| `volume` | number | いいえ | 合成された音声のボリューム | `10` |
| `method` | string | いいえ | 音声合成に使用するメソッド<br>`buffer` または `stream` のいずれか | `buffer` |

#### レスポンス
| ステータスコード | 状態 | 説明 | 内容 |
|------------------|------|------|------|
| `200 OK` | 成功 | WAV形式の合成された音声を返します | `buffer` メソッドの場合: 完全なバッファとして音声を返します<br>`stream` メソッドの場合: 音声データをストリーム配信します |
| `400 Bad Request` | エラー | クエリパラメータが不足しています | ```json { "error": "Bad Request" } ``` |
| `500 Internal Server Error` | エラー | 音声生成に問題が発生しました | `buffer` メソッドの場合: ```json { "error": "can't get buffer" } ``` <br>`stream` メソッドの場合: ```json { "error": "can't get stream" } ``` |

#### リクエスト例
```http
GET http://localhost:8080/v1/synthesize?text=こんにちは&type=0&pitch=10&speed=10&volume=10&method=buffer
```

#### レスポンス例
| ステータスコード | Content-Type | 内容 |
|------------------|--------------|------|
| `200 OK` | audio/wav | WAV形式の音声コンテンツ |

## Voice Type List
| type | 声の種類          | スピーカーID            |
|------|------------------|-------------------------|
| 0    | 謎1 男子1        | BV525_streaming         |
| 1    | 謎2 坊や          | BV528_streaming         |
| 2    | カワボ            | BV017_streaming         |
| 3    | お姉さん          | BV016_streaming         |
| 4    | 少女              | BV023_streaming         |
| 5    | 女子              | BV024_streaming         |
| 6    | 男子2             | BV018_streaming         |
| 7    | 坊ちゃん          | BV523_streaming         |
| 8    | 女子              | BV521_streaming         |
| 9    | 女子アナ          | BV522_streaming         |
| 10   | 男性アナ          | BV524_streaming         |
| 11   | 元気ロリ          | BV520_streaming         |
| 12   | 明るいハニー      | VOV401_bytesing3_kangkangwuqu |
| 13   | 優しいレディー    | VOV402_bytesing3_oh     |
| 14   | 風雅メゾソプラノ  | VOV402_bytesing3_aidelizan |
| 15   | Sakura            | jp_005                  |
| その他/入力なし | お姉さん         | BV016_streaming |
