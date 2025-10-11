---
title: PostgreSQL 18 をソースコードからビルドしたい
description: PostgreSQL 18 をソースコードからビルドする手順を確認します。
date: 2025-10-11
lastModified: 2025-10-11
tags: 
  - postgres
---

# はじめに

PostgreSQL 18 がリリースされたので、ソースコードからビルドする手順を確認してみました。

まぁ、基本的には公式リファレンスと過去の自分のブログをなぞっているだけです。

LLVMのサポートと、lz4・zstd圧縮のサポートを有効にしてビルドします。

[Chapter 17. Installation from Source Code](https://www.postgresql.org/docs/18/installation.html)

[PostgreSQLを野良ビルドしてローカルインストールしたい](https://www.jyuch.dev/posts/2021/build-pg-on-linux/)

# 環境

|ソフトウェア|バージョン|
|:-|:-|
|OS|Ubuntu 24.04.3 LTS|
|PostgreSQL|18.0|

また、ソースコードは`$HOME/src`に展開するものとし、バイナリは`$HOME/.local/pg18.0`にインストールするものとします。

# コンパイラ・ライブラリのインストール

ビルドするだけなら以下のパッケージを入れるだけでOKです。

```sh
sudo apt install \
  build-essential \
  flex \
  bison \
  libreadline-dev \
  zlib1g-dev \
  liblz4-dev \
  libzstd-dev \
  llvm-20 \
  clang-20
```

ドキュメントを含めたフルビルドが必要なら以下のパッケージも必要になります。

```sh
sudo apt install \
  docbook-xml \
  docbook-xsl \
  libxml2-utils \
  xsltproc \
  fop
```

# ソースコードのダウンロード・展開

以下のコマンドよりソースコードをダウロード・展開します。

```sh
cd $HOME/src
curl -OL https://ftp.postgresql.org/pub/source/v18.0/postgresql-18.0.tar.gz
tar zxvf postgresql-18.0.tar.gz
```

# ビルド・インストール

以下のコマンドより、`configure`を流します。

```sh
cd postgresql-18.0
mkdir build_temp && cd build_temp
$HOME/src/postgresql-18.0/configure \
  --prefix=$HOME/.local/pg18.0 \
  --with-icu \
  --with-lz4 \
  --with-zstd \
  --with-llvm \
  LLVM_CONFIG='/usr/bin/llvm-config-20' \
  CLANG='/usr/bin/clang-20' \
  CC='/usr/bin/clang-20' \
  CXX='/usr/bin/clang-20'
```

バイナリ系をビルドするだけなら以下のコマンドを実行します。

```sh
make world-bin
make install-world-bin
```

ドキュメントを含めてすべてビルドするなら以下のコマンドを実行します。

```sh
make world
make install-world
```

おわり
