---
title: Pgpool-IIを野良ビルドしてローカルインストールしたい
description: LinuxにおいてPgpool-IIのビルドおよびインストールする方法を解説しています
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

Pgpool-IIをソースコードからビルドしローカルインストールする方法についてです。

## 環境

ここでは、以下の環境を使用します。

| ソフトウェア | バージョン                       |
| :----------- | :------------------------------- |
| OS           | Ubuntu 20.04.2 LTS (Focal Fossa) |
| Postgres     | 11.12                            |
| Pgpool-II    | 4.2.4                            |

また、ソースコードは`$HOME/source`に展開するものとし、バイナリは`$HOME/local/pgpool`にインストールするものとします。

## Postgresのインストール

Postgresのクライアントライブラリを使用するので、先にPostgresをビルドしてインストールします。

## ソースコードのダウンロード・展開

以下のコマンドよりソースコードをダウロード・展開します。

```sh
cd $HOME/source
wget "https://www.pgpool.net/mediawiki/download.php?f=pgpool-II-4.2.4.tar.gz" -O pgpool-II-4.2.4.tar.gz
tar zxf pgpool-II-4.2.4.tar.gz
```

## ビルド・インストール

以下のコマンドより、Pgpool-IIのビルド及びインストールを行います。

```sh
cd pgpool-II-4.2.4
./configure --prefix=$HOME/local/pgpool --with-pgsql=$HOME/local/pg/11
make
make install
```

また、Pgpool-II用の拡張をPostgresのlibディレクトリにインストールする必要があるっぽいので、以下のコマンドを入力します。

```sh
cd src/sql/pgpool-recovery
make
make install
```

## PATHの設定

必要に応じて、シェルの`PATH`環境変数に`$HOME/local/pgpool/bin`を追加すると良いでしょう。

おわり
