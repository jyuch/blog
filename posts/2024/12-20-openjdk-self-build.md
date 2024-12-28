---
title: WindowsでもOpenJDKを野良ビルドしたい
description: ソースコードからOpenJDKをビルドする方法を確認します
date: 2024-12-20
lastModified: 2024-12-28
tags:
  - jdk
---

# はじめに

OpenJDKの中身をいじって検証する必要があったので、WindowsでOpenJDKを野良ビルドする方法を確認してみました。

最新のバージョンなら[OpenJDKの公式Wikiのビルドのページ](https://openjdk.org/groups/build/doc/building.html)を参照すればいいですが、古いバージョンはリポジトリ内の`docs`フォルダの中身を確認する必要があります。（1敗）

また、基本的にバージョンが下るほどビルド難易度が上がっていきます。

古いバージョンだと過去のVisual StudioとかWindowsバージョンが必要っぽいですが、流石に個人でVisual Studio Subscriptionを契約していないので基本的にWindows 11 + Visual Studio 2022でビルドしていきます。

# 必要なもの

OpenJDKの公式リファレンス曰く、英語版のWindowsのみを公式でサポートしているらしいです。
そのため、何らかの合法的な手段で英語版のWindowsを調達するか、ロケールを英語に変更してください。

そうしたら以下の開発ツールをインストールします。

- Visual Studio 2022
  - 「Desktop development with C++」ワークロード
- Cygwin
  - autoconf
  - make
  - zip
  - unzip
- git（GitHubからソースをクローンしてくるなら）
- ビルド済みのJDK（ビルドしたいOpenJDKのバージョンかその一つ前のバージョン）
- JTReg（リグレッションテストを回すなら）
- googletest（hotspotのテストを回すなら）

ソースをzipで落としてくるのであれば、ファイル数がとても多いので7zipなどのアーカイバを使って解凍したほうがいいかもしれません。

# ビルド

どのバージョンでも`build\windows-x86_64-server-release\jdk`にバイナリが吐かれています。

また、大体どのバージョンでも手元のマシンだとビルドで30分位、`test-tier1`で3時間位掛かるのでゆっくりしていってね！！！

## OpenJDK23

最新ならとっても簡単です。

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-23.0.1+11 \
--with-jtreg=/cygdrive/c/java/jtreg \
--with-gtest=/cygdrive/c/src/googletest-1.14.0
```

```sh
make all; make test-tier1
```

## OpenJDK22

22までならなんの捻りもなくビルドが通ります。

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-22.0.2+9 \
--with-jtreg=/cygdrive/c/java/jtreg \
--with-gtest=/cygdrive/c/src/googletest-1.14.0
```

```sh
make all; make test-tier1
```

おわり
