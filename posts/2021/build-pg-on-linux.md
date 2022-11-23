---
title: PostgreSQLを野良ビルドしてローカルインストールしたい
description: PostgreSQLを野良ビルドしてローカルインストールしたい
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

PostgreSQLをソースコードからビルドしてローカルインストール方法についてです。

## 環境

ここでは、以下の環境を使用します。

割と古めなのですが、この記事のベースを書いたのがそこそこ前なのでまぁその・・・

| ソフトウェア   | バージョン                            |
| :------- | :------------------------------- |
| OS       | Ubuntu 20.04.2 LTS (Focal Fossa) |
| Postgres | 11.12                            |

また、ソースコードは`$HOME/source`に展開するものとし、バイナリは`$HOME/local/pg/11`にインストールするものとします。

オプションは最低限です。いろいろ付けたかったら公式リファレンスを見ればいいと思います。

[第16章 ソースコードからインストール](https://www.postgresql.jp/document/11/html/installation.html)

## コンパイラ・ライブラリのインストール

以下のコマンドより、コンパイラ環境と必要なライブラリをインストールします。

```sh
sudo apt install build-essential libreadline-dev zlib1g-dev wget
```

## ソースコードのダウンロード・展開

以下のコマンドよりソースコードをダウロード・展開します。

```sh
cd $HOME/source
wget https://ftp.postgresql.org/pub/source/v11.12/postgresql-11.12.tar.gz
tar zxf postgresql-11.12.tar.gz
```

## ビルド・インストール

以下のコマンドより、Postgresのビルド及びインストールを行います。

```sh
cd postgresql-11.12
mkdir tmp_build_dir && cd tmp_build_dir
$HOME/source/postgresql-11.12/configure --prefix=$HOME/local/pg/11
make
make install
```

## PATHの設定

必要に応じて、シェルの`PATH`環境変数に`$HOME/local/pg/11/bin`を追加するといいかもです。

おわり
