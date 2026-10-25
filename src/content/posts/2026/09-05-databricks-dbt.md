---
title: Databricksでもdbtを動かしてみたい
description: Databricksをターゲットとしてdbtを動かしてみます。
date: 2026-09-05
lastModified: 2026-09-05
tags:
    - databricks
    - dbt
---

## はじめに

Databricksには[Apache Spark™ 宣言型パイプライン](https://www.databricks.com/jp/product/data-engineering/spark-declarative-pipelines)といういい感じにデータを精錬するための機能があります。

同様の機能を持つ製品として[dbt](https://www.getdbt.com/)があります。
DatabricksだけであればSDPで十分ですが、触ったことすらないのは問題かなと思い試してみました。

## PATの払い出し

dbtからDatabricksを触りに行くために、PATを発行しておきます。

めんどくさかったので私はAPI scopeを`all-apis`で発行してしまいましたが、たぶん`sql`があれば大丈夫かもしれません。しらんけど

## dbt環境のセットアップ

Databricksの公式ドキュメントに[セットアップ方法が載っている](https://docs.databricks.com/aws/ja/partners/prep/dbt)ので、その通りにセットアップします。

Databricks曰くPythonの仮想環境を別途用意して、その上にインストールしろとのことです。

私はuvを使用しているので、uv環境セットアップします。

```sh
uv init -p 3.11
```

dbtの[Get started](https://docs.getdbt.com/docs/local/install-dbt?version=2)ではバージョン2を進められるのですが、どうもプレリリースのようなので`--prerelease allow`を指定してインストールします。

```sh
uv add dbt --prerelease allow
```

あとは、dbtをDatabrickcsにつなげるために[Databricksアダプター](https://github.com/databricks/dbt-databricks)をインストールします。

```sh
uv add dbt-databricks
```

アダプターのインストールが完了したら、dbtのプロジェクトを初期化します。

```sh
uv run dbt init my_dbt_demo
```

対話形式でいろいろ聞かれるので、番号で答えたり実際の値を入力したりします。

```txt
04:55:39  Running with dbt=1.12.3
04:55:39  Creating dbt configuration folder at C:\Users\someone\.dbt
04:55:39  Setting up your profile.
Which database would you like to use?
[1] databricks
[2] spark

(Don't see the one you want? https://docs.getdbt.com/docs/available-adapters)

Enter a number: 1 👈 Databricksにつなぐので「１」
host (yourorg.databricks.com): dbc-12345678-abcd.cloud.databricks.com 👈 ワークスペースのホスト
http_path (HTTP Path): /sql/1.0/warehouses/abc123456789a123 👈 SQL WarehousesのHTTPパス
[1] use access token
Desired access token option (enter a number): 1 👈 トークンを使用するので「1」
token (dapiXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX): 👈 トークンを入力
[1] use Unity Catalog
[2] not use Unity Catalog
Desired unity catalog option (enter a number): 1 👈 UCを使用するので「1」
catalog (initial catalog): dbt 👈 カタログ名を入力
schema (default schema that dbt will build objects in): default 👈 スキーマ名を入力
threads (1 or more) [1]: 👈 同時実行するスレッド数を入力？
04:59:06  Profile my_dbt_demo written to C:\Users\someone\.dbt\profiles.yml using target's profile_template.yml and your supplied values.
04:59:06  Running dbt debug to validate the project...
04:59:06  dbt version: 1.12.3
04:59:06  python version: 3.11.15
04:59:06  python path: C:\dev\try-databricks-dbt\.venv\Scripts\python.exe
04:59:06  os info: Windows-10-10.0.26200-SP0
04:59:06  Using profiles dir at C:\Users\someone\.dbt
04:59:06  Using profiles.yml file at C:\Users\someone\.dbt\profiles.yml
04:59:06  Using dbt_project.yml file at C:\dev\try-databricks-dbt\my_dbt_demo\dbt_project.yml
04:59:06  adapter type: databricks
04:59:06  adapter version: 1.12.5
04:59:06  Configuration:
04:59:06    profiles.yml file [OK found and valid]
04:59:06    dbt_project.yml file [OK found and valid]
04:59:06  Required dependencies:
04:59:06   - git [OK found]

04:59:06  Connection:
04:59:06    host: dbc-52ec1bce-aed0.cloud.databricks.com
04:59:06    http_path: /sql/1.0/warehouses/ca9667106d87a573
04:59:06    catalog: dbt
04:59:06    schema: default
04:59:06  Registered adapter: databricks=1.12.5
04:59:07  Databricks adapter:   SPOG host (host_type='workspace'): no
04:59:07  Databricks adapter:   workspace_id (from ?o= in http_path): None
04:59:07  Databricks adapter:   databricks-sql-connector version: 4.4.0 (supported)
04:59:07  Databricks adapter:   databricks-sdk version: 0.117.0 (supported)
04:59:21    Connection test: [OK connection ok]

04:59:21  All checks passed!
04:59:21  Your new dbt project "my_dbt_demo" was created!
Initialized new project in C:\dev\try-databricks-dbt\my_dbt_demo\my_dbt_demo

For more information on how to configure the profiles.yml file,
please consult the dbt documentation here:

  https://docs.getdbt.com/docs/configure-your-profile

One more thing:

Need help? Don't hesitate to reach out to us via GitHub issues or on Slack:

  https://community.getdbt.com/

Happy modeling!
```

初期化が終わるとプロジェクトのディレクトリが作成されているので、移動します。

```sh
cd .\my_dbt_demo\
```

ちゃんと初期化できているか動作確認をします。
色々出てきますが、`All checks passed!`と出ればOKなんだと思います。

```sh
uv run dbt debug
```

```txt
05:02:37  Running with dbt=1.12.3
05:02:37  dbt version: 1.12.3
05:02:37  python version: 3.11.15
05:02:37  python path: C:\dev\try-databricks-dbt\.venv\Scripts\python.exe
05:02:37  os info: Windows-10-10.0.26200-SP0
05:02:38  Using profiles dir at C:\Users\someone\.dbt
05:02:38  Using profiles.yml file at C:\Users\someone\.dbt\profiles.yml
05:02:38  Using dbt_project.yml file at C:\dev\try-databricks-dbt\my_dbt_demo\dbt_project.yml
05:02:38  adapter type: databricks
05:02:38  adapter version: 1.12.5
05:02:38  Configuration:
05:02:38    profiles.yml file [OK found and valid]
05:02:38    dbt_project.yml file [OK found and valid]
05:02:38  Required dependencies:
05:02:38   - git [OK found]

05:02:38  Connection:
05:02:38    host: dbc-52ec1bce-aed0.cloud.databricks.com
05:02:38    http_path: /sql/1.0/warehouses/ca9667106d87a573
05:02:38    catalog: dbt
05:02:38    schema: default
05:02:38  Registered adapter: databricks=1.12.5
05:02:39  Databricks adapter:   SPOG host (host_type='workspace'): no
05:02:39  Databricks adapter:   workspace_id (from ?o= in http_path): None
05:02:39  Databricks adapter:   databricks-sql-connector version: 4.4.0 (supported)
05:02:39  Databricks adapter:   databricks-sdk version: 0.117.0 (supported)
05:02:42    Connection test: [OK connection ok]

05:02:42  All checks passed!
```

## モデリングする

### サンプルデータの作成

[公式のチュートリアル](https://docs.databricks.com/aws/en/integrations/dbt-core-tutorial)に沿って、いろいろと試してみましょう。

チュートリアルははじめにサンプルテーブルを作るように言いますが、なんとコード例が動きません。
ですので、あきらめてそれっぽい等価なSQLに書き換えて実行します。

```sql
CREATE OR REPLACE TABLE diamonds AS
SELECT
  *
FROM
  read_files(
    "/Volumes/samples/databricks/datasets/Rdatasets/data-001/csv/ggplot2/diamonds.csv",
    format => 'csv',
    header => true
  )
```

### モデルの作成

すでに公式チュートリアルを脱線しますが、dbt上でちゃんとリネージを扱えるように先ほど作成したテーブルをソーステーブルとして登録します。

`models/sources.yml`みたいなファイルに定義するようです。

```yaml
version: 2

sources:
  - name: diamonds_raw
    catalog: dbt
    schema: default
    tables:
      - name: diamonds
```

そうすると、`{{ source('diamonds_raw', 'diamonds') }}`のような表記で参照できるようになるので、各モデル内で参照します。

```sql
{{
  config(materialized = 'table', file_format = 'delta')
}}
SELECT
  carat,
  cut,
  color,
  clarity
FROM
  {{ source('diamonds_raw', 'diamonds') }}
```

```sql
{{
  config(materialized = 'materialized_view')
}}
SELECT DISTINCT
  color
FROM
  {{ ref('diamonds_four_cs') }}
ORDER BY
  color ASC
```

```sql
SELECT
  color,
  avg(price) AS price
FROM
  {{ source('diamonds_raw', 'diamonds') }}
GROUP BY
  color
ORDER BY
  price DESC
```

コマンドを実行すると、それぞれテーブルやマテリアライズドビュー・ビューが生えてきます。

```sh
uv run dbt run
```

```txt
07:37:47  Running with dbt=1.12.3
07:37:48  Registered adapter: databricks=1.12.5
07:37:48  [WARNING]: Configuration paths exist in your dbt_project.yml file which do not apply to any resources.
There are 1 unused configuration paths:
- models.my_dbt_demo.example
07:37:48  Found 3 models, 1 source, 773 macros
07:37:48
07:37:48  Concurrency: 1 threads (target='dev')
07:37:48
07:37:54  1 of 3 START sql table model default.diamonds_four_cs .......................... [RUN]
07:37:57  1 of 3 OK created sql table model default.diamonds_four_cs ..................... [OK in 3.73s]
07:37:57  2 of 3 START sql view model default.diamonds_prices ............................ [RUN]
07:37:59  2 of 3 OK created sql view model default.diamonds_prices ....................... [OK in 1.92s]
07:37:59  3 of 3 START sql materialized_view model default.diamonds_list_colors .......... [RUN]
07:38:47  3 of 3 OK created sql materialized_view model default.diamonds_list_colors ..... [OK in 47.59s]
07:38:47
07:38:47  Finished running 1 materialized view model, 1 table model, 1 view model in 0 hours 0 minutes and 58.55 seconds (58.55s).
07:38:47
07:38:47  Completed successfully
07:38:47
07:38:47  Done. PASS=3 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=3
```

![作成されたテーブル](/img/2026/09-05-databricks-dbt/created-tables.png)

### リネージの確認

```sh
uv run dbt docs generate
```

```sh
uv run dbt docs serve
```

とすると、ローカルサーバーが起動してモデル間のリネージが見られるようになります。

![生成されたリネージ図](/img/2026/09-05-databricks-dbt/dbt-dag.png)

## おわりに

いったんはここまでとしますが、中身はJinjaテンプレートらしく、いろいろと作りこめるそうなので今後もいろいろと触ってみたいですね。

おわり