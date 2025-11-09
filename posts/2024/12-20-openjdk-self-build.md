---
title: WindowsでもOpenJDKを野良ビルドしたい
description: ソースコードからOpenJDKをビルドする方法を確認します
date: 2024-12-20
lastModified: 2024-12-29
tags:
  - jdk
---

## はじめに

OpenJDKの中身をいじって検証する必要があったので、WindowsでOpenJDKを野良ビルドする方法を確認してみました。

最新のバージョンなら[OpenJDKの公式Wikiのビルドのページ](https://openjdk.org/groups/build/doc/building.html)を参照すればいいですが、古いバージョンはリポジトリ内の`docs`フォルダの中身を確認する必要があります。（1敗）

また、基本的にバージョンが下るほどビルド難易度が上がっていきます。

古いバージョンだと過去のVisual StudioとかWindowsバージョンが必要っぽいですが、流石に個人でVisual Studio Subscriptionを契約していないので基本的にWindows 11 + Visual Studio 2022でビルドしていきます。

## 必要なもの

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

## ビルド

どのバージョンでも`build\windows-x86_64-server-release\jdk`にバイナリが吐かれています。

大体どのバージョンでも手元のマシンだとビルドで30分位、`test-tier1`で2時間位掛かるのでゆっくりしていってね！！！

あと、ビルドに時間が掛かるからって調子に乗って複数バージョンの同時ビルドを流すと、たまにテストがタイムアウトしてError扱いになるので注意しましょう。（4敗）

### OpenJDK 23 (23.0.1-11)

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

### OpenJDK 22 (22.0.2-9)

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

### OpenJDK 21 (21.0.6-6)

最新のLTSですが、googletestを有効にするとビルドに失敗するようになります。
ここから雲行きが怪しくなります。

とりあえずバイナリが欲しいので、googletestを無効にしてビルドを進めます。

```sh
 bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-21.0.5+11 \
--with-jtreg=/cygdrive/c/java/jtreg
```

googletestを無効化したせいでいくつかのhotspotテストが失敗として報告されますが、動くので多分問題ないでしょう。

```sh
make all; make test-tier1
```

### OpenJDK 20 (20.0.2-ga)

ビルド中にワーニング出てきて若干不穏な感じになりますが、まぁビルドが通るので良しとしましょう。

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-20.0.2+9 \
--with-jtreg=/cygdrive/c/java/jtreg
```

20からgoogletest起因以外でテストが1件失敗し始めます。

```sh
make all; make test-tier1
```

### OpenJDK 19 (19.0.2-ga)

```sh
bash configure \
--with-boot-jdk/cygdrive/c/java/jdk-19.0.2+7 \
--with-jtreg=/cygdrive/c/java/jtreg
```

```sh
make all; make test-tier1
```

### OpenJDK 18 (18.0.2.1-0)

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-18.0.2.1+1 \
--with-jtreg=/cygdrive/c/java/jtreg
```

```sh
make all; make test-tier1
```

### OpenJDK 17 (17.0.14-6)

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-17.0.13+11 \
--with-jtreg=/cygdrive/c/java/jtreg
```

```sh
make all; make test-tier1
```

### OpenJDK 16 (16.0.2-ga)

Visual Studioのビルド環境の検出に失敗して`bash configure`自体が失敗します。

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-16.0.2+7 \
--with-jtreg=/cygdrive/c/java/jtreg
```

```text
configure: Using default toolchain microsoft (Microsoft Visual Studio)
configure: error: Cannot locate a valid Visual Studio installation
configure exiting with result code 1
```

### OpenJDK 11 (11.0.26-3)

11はまだビルドが通ります。
いつまで使う気なんでしょうね

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk-11.0.25+9 \
--with-jtreg=/cygdrive/c/java/jtreg
```

```sh
make all; make run-test-tier1
```

### OpenJDK 8 (jdk8u442-b04)

`u442`ってもはや何なんだよって感じです

```sh
bash configure \
--with-boot-jdk=/cygdrive/c/java/jdk8u432-b06 \
--with-jtreg=/cygdrive/c/java/jtreg \
--with-freetype-src=/cygdrive/c/src/freetype-2.5.3
```

`bash configure`までは通るけど、ビルドはコケます。

```sh
make all
```

おわり
