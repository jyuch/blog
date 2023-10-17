---
title: PostgreSQLを野良ビルドしてローカルインストールしたい
description: LinuxにおいてPostgreSQLのビルドおよびインストールする方法を解説しています
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

PostgreSQLをソースコードからビルドしてローカルインストール方法についてです。

ここではLLVMのサポート、lz4・zstd圧縮のサポート、icuのサポートを有効にしてビルドします。

[Chapter 17. Installation from Source Code](https://www.postgresql.org/docs/15/installation.html)

## 環境

ここでは、以下の環境を使用します。

| ソフトウェア | バージョン                           |
| :----------- | :----------------------------------- |
| OS           | Ubuntu 22.04.1 LTS (Jammy Jellyfish) |
| Postgres     | 15.1                                 |

また、ソースコードは`$HOME/src`に展開するものとし、バイナリは`$HOME/.local/pg15`にインストールするものとします。

## コンパイラ・ライブラリのインストール

以下のコマンドより、コンパイラ環境と必要なライブラリをインストールします。

```sh
$ sudo apt install build-essential libreadline-dev zlib1g-dev liblz4-dev libzstd-dev llvm-14 clang-14
```

## ソースコードのダウンロード・展開

以下のコマンドよりソースコードをダウロード・展開します。

```sh
$ cd $HOME/src
$ curl -OL https://ftp.postgresql.org/pub/source/v15.1/postgresql-15.1.tar.gz
$ tar zxvf postgresql-15.1.tar.gz
```

## ビルド・インストール

以下のコマンドより、Postgresのビルド及びインストールを行います。

```sh
$ cd postgresql-15.1
$ mkdir build_temp && cd build_temp
$ $HOME/src/postgresql-15.1/configure \
    --prefix=$HOME/.local/pg15 \
    --with-icu \
    --with-lz4 \
    --with-zstd \
    --with-llvm \
    LLVM_CONFIG='/usr/bin/llvm-config-14' \
    CLANG='/usr/bin/clang-14' \
    CC='/usr/bin/clang-14' \
    CXX='/usr/bin/clang-14'
$ make world
$ make install-world
```

## PATHの設定

必要に応じて、シェルの`PATH`環境変数に`$HOME/local/pg15/bin`を追加するといいかもです。

おわり
