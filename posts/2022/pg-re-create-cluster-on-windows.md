---
title: WindowsでもPostgreSQLのデータディレクトリを移動したい
description: WindowsでもPostgreSQLのデータディレクトリを移動したい
date: 2021-11-08
tags: 
  - postgres
---

## はじめに

何らかの理由により、インストール済みのクラスタを再作成したい時のお話です。

11で検証しましたが、まぁ他のバージョンでも同じだと思います。

## サービスマネージャからPostgresサービスを停止する

停止します。

## 新しい場所にデータベースクラスタを再作成する

管理者で実行しているコマンドプロンプトから以下のコマンドを実行します。

```bat
> "C:\Program Files\PostgreSQL\11\bin\initdb.exe" -D "C:\pgdata\11" -U postgres --encoding=UTF8 --locale=C

データベースシステム内のファイルの所有者は"JYUCH"となります。
このユーザがサーバプロセスも所有する必要があります。

データベースクラスタはロケール"C"で初期化されます。
デフォルトのテキスト検索設定はenglishに設定されました。

データベージのチェックサムは無効です。

ディレクトリC:/pgdata/11を作成します ... 完了
サブディレクトリを作成します ... 完了
max_connectionsのデフォルト値を選択します ... 100
shared_buffersのデフォルト値を選択します ... 128MB
selecting default timezone ... Asia/Tokyo
動的共有メモリの実装を選択します ... windows
設定ファイルを作成します ... 完了
ブートストラップスクリプトを実行します ... 完了
ブートストラップ後の初期化を行っています ... 完了
データをディスクに同期します...完了

警告: ローカル接続で"trust"認証を有効にします。
この設定はpg_hba.confを編集するか、次回のinitdbの実行の際であれば-Aオプ
ション、または、--auth-localおよび--auth-hostを使用することで変更するこ
とができます。

成功しました。以下のようにしてデータベースサーバを起動できます。

    ^"C^:^\Program^ Files^\PostgreSQL^\11^\bin^\pg^_ctl^" -D ^"C^:^\pgdata^\11^" -l <ログファイル> start
```

## 以前に登録済みのサービスの登録を消す

管理者で実行しているコマンドプロンプトから以下のコマンドを実行します。

```bat
"C:\Program Files\PostgreSQL\11\bin\pg_ctl.exe" unregister -N postgresql-x64-11
```

## 一度Windowsを再起動する

します。

## サービスを再登録する

管理者で実行しているコマンドプロンプトから以下のコマンドを実行します。

```bat
"C:\Program Files\PostgreSQL\11\bin\pg_ctl.exe" register -N postgresql-x64-11 -U "NT AUTHORITY\NetworkService" -D "C:\pgdata\11" -w
```

## サービスを起動する

祈りながらサービスコンソールから先ほど登録したサービスを起動します


## 確認

psqlコマンドから試しに接続してみて、問題無いか確認します。

## 参考

- https://lets.postgresql.jp/documents/tutorial/windows/1#pgdata

おわり
