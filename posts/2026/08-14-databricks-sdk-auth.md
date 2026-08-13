---
title: Databricks SDKでも統合認証を使いたい
description: Databricks SDKで統合認証を使う方法を確認します。
date: 2026-08-14
lastModified: 2026-08-14
tags:
    - databricks
    - python
---

## はじめに

Databricksでは[統合認証](https://docs.databricks.com/aws/ja/dev-tools/auth/unified-auth)と呼ばれる、ツールやSDKの言語に関わらず統一的な方法で認証を行う方法が用意されています。

その中でも、今回はなんだかんだ言って色々お世話になりそうな[環境変数を使用した認証](https://docs.databricks.com/aws/ja/dev-tools/auth/env-vars)を試してみます。

ここで紹介されている環境変数はSDKだけでなく、CLIやTerraformでの認証にも使うことが出来ます。

## 認証を行うサンプルコード

今回は[Databricks SDK for Python](https://docs.databricks.com/gcp/ja/dev-tools/sdk-python)を使用します。

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

for c in w.catalogs.list():
    print(c.name)
```

みたいなコードを用意し、[uvの環境変数読み込み機能](https://docs.astral.sh/uv/concepts/configuration-files/#environment-variable-files)を使用して環境変数経由で認証情報を注入します。

認証がうまくいけば、認証されたユーザ・サービスプリンシパルの権限に応じたカタログの一覧が見えるはずです。

以下のサンプルでは`DATABRICKS_AUTH_TYPE`を使用して認証方法の指示をSDKに与えていますが、与えない場合は[認証方法の優先度](https://docs.databricks.com/aws/ja/dev-tools/auth/unified-auth#%E8%AA%8D%E8%A8%BC%E6%96%B9%E6%B3%95%E3%81%AE%E5%84%AA%E5%85%88%E5%BA%A6)に応じて認証を試行します。

## Databricks CLIの認証情報を使用した認証

Databricks CLIを使用してOAuth U2M認証を行ってから、その認証情報を使ってSDKの認証を行います。

使い方はとっても簡単で、`databricks auth login`でCLI上でログインしてから以下の環境変数をセットするだけです。

`DATABRICKS_CONFIG_PROFILE`は`DEFAULT`以外のプロファイル名を使用したいときに設定します。

```sh
DATABRICKS_HOST=https://dbc-12345678-abcd.cloud.databricks.com
DATABRICKS_AUTH_TYPE=databricks-cli
```

## Personal Access Tokenを使用した認証

PATを発行して、そのPATでアクセスします。

```sh
DATABRICKS_HOST=https://dbc-12345678-abcd.cloud.databricks.com
DATABRICKS_AUTH_TYPE=pat
DATABRICKS_TOKEN=<token>
```

## サービスプリンシパルのシークレットを使用した認証

何らかの処理を自動化したい場合、サービスプリンシパルを使うことも多いと思います。

```sh
DATABRICKS_HOST=https://dbc-12345678-abcd.cloud.databricks.com
DATABRICKS_AUTH_TYPE=oauth-m2m
DATABRICKS_CLIENT_ID=00000000-0000-0000-0000-000000000000
DATABRICKS_CLIENT_SECRET=<secret>
```

おわり
