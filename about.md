---
layout: layouts/post.njk
title: About Me
templateClass: tmpl-post
date: 2022-11-07
menu:
  visible: true
  order: 2
---

<img src="./img/jyuch.jpg" style="border-radius:50%;height:10rem">

## 概要
社内システムとして、アプリケーション開発からインフラ整備からユーザ部門のヒアリングまで手広くやっています。

お仕事としてはC#及びJavaをメインで使用していますが、プライベートでRustやTypeScriptを使用しています。

本業はアプリケーション開発のはずですが、最近はサーバやネットワークなどのインフラ業も兼務するようになってきました。
そのせいもあってか、最近はインフラ管理の自動化に興味があります。

### アウトプット

- [GitHub](https://github.com/jyuch)
- [旧ブログ（はてなブログ）](https://jyuch.hatenablog.com/)

### コンタクト
コンタクトは contact [at] jyuch.dev までよろしくお願いします。

Google Domainでエイリアスを貼っているだけなので、返信は違うメールアドレスから行います。
また、同じ名前のTwitterアカウントがありますが、全く見ていないのでそちらに連絡を貰っても反応できないと思います。

## スキル

### 開発言語

#### C#
仕事でメインに使用している言語その1です。

主にバッチ処理を実装するのに使用していますが、WinFormやWPFを使用したデスクトップアプリケーションの開発やASP Coreを使用したWeb APIの実装経験もあります。

ソースコードや式木・ILなど複数の領域でのメタプログラミングを得意としており、それらを組み合わせたプログラムの自動生成を得意としています。

- [C#でもSigilでデリゲートをダイナミックに生成したい](https://jyuch.hatenablog.com/entry/2016/05/01/181145)

#### Java
仕事でメインに使用している言語その2です。

Spring Frameworkを使用したWeb APIバックエンドやWebアプリケーションの実装を行っています。

サーバの実装メモリに応じたガベージコレクタモードの選定やパラメータのチューニング、Java Flight Recorderを使用してクラスローダに係るMetaspaceリークのトラブルシュートの経験があります。

#### Rust
現在、個人的に最も興味を持って勉強している言語です。

簡単なコンソールアプリケーションの実装に使用したり、[windows-rs](https://github.com/microsoft/windows-rs)を使用したWin32 APIとの相互運用について勉強しています。

- [jyuch/tama](https://github.com/jyuch/tama)
- [jyuch/rust-win32](https://github.com/jyuch/rust-win32)

#### Deno / TypeScript
フロントエンド周りが弱いため、その領域の知識を身に着けるために個人的に勉強しています。

仕事で使用することを前提としていないため、せっかくなら新しいランタイムを勉強してみようという事でDenoを選択しています。

このサイトもDeno + Lumeを使用して構築しています。

#### Scala
関数型言語の勉強として個人的に勉強していました。

また、[GitBucket](https://github.com/gitbucket/gitbucket)向けのバックアッププラグインのメンテナンスを行っています。

- [jyuch/gitbucket-backup-plugin](https://github.com/jyuch/gitbucket-backup-plugin)

### ミドルウェア

#### PostgreSQL
開発ではプランナの実行計画を確認し、適切なインデックスが使用されるようSQLのチューニングやインデックスの作成を行っています。

運用ではバックアップやリストアなどの日常的なオペレーションのスケジュールの登録や、サーバのメモリ実装量やディスクの特性に応じたパラメータチューニングを行っています。

#### nginx
Tomcatのリバースプロキシとして、静的ファイルのキャッシングによる配信の最適化を構成しています。

### OS

#### Windows Server
Windows Server上にTomcat及びPostgreSQLを構成し、社内向けのサービスを展開しています。

検証環境でのActive Directory環境の構築及び、Windows Server Failover ClusterとHyper-Vを使用した高可用構成を構築したことがあります。

#### Linux
開発及び検証環境として主にUbuntuを使用しています。

また、Amazon Linux 2上にnignx・Tomcat及びPostgreSQLを構成し、社内向けのWebアプリケーションを展開しています。

#### FreeBSD
自宅のファイルサーバとして、FreeBSDをベースとしたアプライアンスであるXigmaNASを使用してファイルサーバを構築・運用しています。

- [FreeBSDでZFSを使用するときに気を付けたいこと](https://jyuch.hatenablog.com/entry/2021/01/01/162640)
- [XigmaNASで運用しているZFSのディスクを交換したお話](https://jyuch.hatenablog.com/entry/2022/01/30/175006)

### ネットワーク
ヤマハのRTXシリーズを使用したNAT及びパケットフィルタの設計と構築を行っています。

自宅ネットワークとして、アライドテレシスのx510とMikroTikを使用した10Gネットワークを構築・運用しています。

- [逸般の誤家庭でも10GbpsのLANを構築したい（機材選定・購入編）](https://jyuch.hatenablog.com/entry/2022/07/13/212000)
- [逸般の誤家庭でも10GbpsのLANを構築したい（配線・動作確認編）](https://jyuch.hatenablog.com/entry/2022/07/23/211721)

### Git
自部署向けのGitサーバの構築及び運用を行っています。

また、メンバーへのGitの使用方法の啓蒙やブランチ運用計画の策定、トラブル発生時のリポジトリの修復などを行っています。

- [新任Git管理者のための歴史改変入門](https://jyuch.hatenablog.com/entry/2022/09/26/002408)
