---
title: DatabricksのSpark Declarative Pipelinesを使って簡易的な家計簿を作りたい
description: Databricks Spark Declarative PipelinesとAI関数を使ってレシートのOCRと情報の抽出を行うパイプラインを実装します。
date: 2026-04-29
lastModified: 2026-04-29
tags: 
  - databricks
---

## はじめに

Databricksには[AI Functions](https://docs.databricks.com/aws/ja/large-language-models/ai-functions)があり、ノートブックやSQL Editorなどで使用できます。

いつからかSpark Declarative Pipelinesでも使えるようになっており、パイプラインだけでOCRと抽出が完結できるようになっていました。

そこで、今回はボリュームに格納されたレシートから日時と金額を抽出してダッシュボードに表示するまでの処理をSpark Declarative Pipelinesで実装して、Declarative Automation Bundlesでデプロイできるようにしてみました。

[jyuch/public-expenses](https://github.com/jyuch/public-expenses)

## パイプラインの実装

以下の流れのパイプラインを実装します。

1. Volumeからレシートのイメージをロード
2. `ai_parse_document`でOCR処理を実行
3. `ai_query`で抽出結果を構造化
4. 構造化データをフラット化してシルバーテーブルに変換

基本的に`ai_〇〇`は実行にまぁまぁの時間が掛かるので、毎回全部のイメージの再処理をしていたら実行時間がとんでもないことになります。
そのため、ストリーミングテーブルを使用して差分実行を行うようにします。

この辺も`CREATE STREAMING TABLE`と`STREAM()`でチェックポイントの管理をしなくても良きにしてくれるのでSDPは大好きです。

まずはVolumeに格納されているレシートのイメージをロードします。

```sql
CREATE STREAMING TABLE raw_receipts AS
SELECT
  path,
  modificationTime,
  length,
  content
FROM
  STREAM(READ_FILES('/Volumes/expenses/default/receipt_images/', format => 'binaryFile'));
```

そうしたら、`ai_parse_document`でOCRを実行します。

```sql
CREATE STREAMING TABLE parsed_receipts AS
SELECT
  path,
  modificationTime,
  length,
  content,
  ai_parse_document(content, Map('version', '2.0')) AS parsed_receipt
FROM
  STREAM(raw_receipts);
```

`ai_query`の`responseFormat`にJSON Schemaを指定して構造化出力を行わせます。
本当は`STRUCT<>`で構造体の定義を指定できるはずなのですが、「Spark Declarative Pipelinesのバグにエンカウントしたのでバグ報告ヨロ」みたいなエラーが表示されるので、あきらめてJSON Schemaを指定しています。

個人的にはJSON Schemaは書式が冗長なので、できれば`STRUCT<>`の方の構文を使いたいです。

```sql
CREATE STREAMING TABLE structured_receipts AS
SELECT
  path,
  ai_query(
    'databricks-qwen3-next-80b-a3b-instruct',
    CONCAT(
      'レシートをパースした結果が与えられます。そこから購入日と合計金額を抽出しなさい。',
      parsed_receipt
    ),
    responseFormat =>
      '{
        "type": "json_schema",
        "json_schema": {
          "name": "structured_food_receipts",
          "schema": {
            "type": "object",
            "properties": {
              "purchase_date": {
                "type": "string",
                "format": "date"
              },
              "total_amount": {
                "type": "integer"
              }
            },
            "required": [
              "purchase_date",
              "total_amount"
            ]
          },
          "strict": true
        }
      }'
  ) AS structured_receipt
FROM
  STREAM(parsed_receipts);
```

抽出したパスからレシートの種類（食費とか日用品とか）を付与しています。また、JSON形式の文字列から`STRUCT<>`に変換します。

購入日とかを抽出するタイミングでカテゴライズをしてもいいのですが、精度が出なかったのでひとまずファイルパスで識別させています。

```sql
CREATE STREAMING TABLE flatten_receipts AS
SELECT
  path,
  regexp_extract(path, '/([^/]+)/[^/]+$', 1) AS kind,
  try_cast(
    try_parse_json(structured_receipt) AS STRUCT<purchase_date DATE, total_amount INT>
  ) AS receipt
FROM
  STREAM(structured_receipts);
```

最後にフラット化すればひとまずは家計簿テーブルが完成します。
名前とやっていることが微妙に一致してませんが、まぁ、その・・・。

```sql
CREATE OR REPLACE MATERIALIZED VIEW receipts AS
SELECT
  path,
  kind,
  receipt.purchase_date,
  receipt.total_amount
FROM
  flatten_receipts;
```

## DABでの展開

パイプラインを手動でデプロイしてもいいのですが、全部自動でできた方がうれしいですよね。

ということでDABで一発デプロイできるようにします。

特にひねりのない`databricks.yml`と`resources/expenses.pipeline.yml`を定義します。

```yaml
bundle:
  name: expenses
  uuid: 00000000-0000-0000-0000-000000000000

include:
  - resources/*.yml

variables:
  catalog:
    description: The catalog to use
  schema:
    description: The schema to use
  ingest_from:
    description: The path log ingestion

targets:
  dev:
    mode: development
    default: true
    variables:
      catalog: expenses
      schema: dev
  prod:
    mode: production
    workspace:
      root_path: /Workspace/Bundles/${bundle.name}/${bundle.target}
    variables:
      catalog: expenses
      schema: prod
```

```yaml
resources:
  pipelines:
    expenses:
      name: expenses
      catalog: ${var.catalog}
      schema: ${var.schema}
      serverless: true
      root_path: "../src/expenses"

      libraries:
        - glob:
            include: ../src/expenses/transformations/**

      environment:
        dependencies:
          - --editable ${workspace.file_path}
```

あとは🚀ボタンで一発デプロイです。

## ダッシュボードの作成

あとはお好みの種類のグラフでダッシュボードを作るだけです。

ダッシュボードもDABでデプロイ出来ます。
お仕事ではダッシュボードもパイプラインと同じようにDABでデプロイしているのですが、小回りが利かなくなるので趣味ならこの辺はお好みでいいと思います。

## おわりに

SQLだけでレシートのOCR ⇒ 情報の抽出が完結しました。
また、差分更新も勝手にやってくれます。

宣言的に実装からデプロイまでできるので管理しやすいです。皆様のお仕事のお供のぜひぜひ

おわり
