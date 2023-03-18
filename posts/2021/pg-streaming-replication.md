---
title: PostgreSQLでもストリーミングレプリケーションを試してみたい
description: PostgreSQLでもストリーミングレプリケーションを試してみたい
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

この記事では、Postgres標準機能であるストリーミングレプリケーションを用いて、複数のクラスタ間でデータを同期出来る事を確認します。

また、プライマリが障害を起こした際にスタンバイで業務を継続出来る事も確認します。

## 諸元

ここでは、以下の諸元を使用してデータベースを構築します。

| ロール和名               | ロール名  |
| :----------------------- | :-------- |
| レプリケーションユーザ   | repl_user |
| アプリケーションDB       | test_app  |
| アプリケーションDBユーザ | test_app  |

## プライマリデータベースクラスタの初期化

まず、プライマリのデータベースクラスタを初期化し起動します。

```sh
initdb --no-locale --encoding=UTF-8 -D /home/jyuch/pgdata/11/primary
pg_ctl -D /home/jyuch/pgdata/11/primary start
```

プライマリクラスタにレプリケーションユーザを作成します。 また、あわせてテストユーザとデータベースを作成します。

```sh
psql -p 5432 postgres
```

```sh
postgres=# CREATE USER repl_user LOGIN REPLICATION PASSWORD 'repl_user';
CREATE ROLE
postgres=# CREATE USER test_app LOGIN PASSWORD 'test_app';
CREATE ROLE
postgres=# CREATE DATABASE test_app OWNER test_app;
```

異なるホスト間でレプリケーションを行う場合はレプリケーション先からレプリケーションユーザが接続出来るよう`pg_hba.conf`に設定を追加しますが、ローカルホスト間のレプリケーションは最初から許可されているためここでは設定を飛ばします。

テストデータベースに初期データを投入します。

```sh
$ psql -p 5432 -U test_app test_app

psql (11.12)
Type "help" for help.

test_app=> CREATE TABLE foo (i int, v varchar(100));
CREATE TABLE
test_app=> INSERT INTO foo VALUES (1, 'hoge'), (2, 'fuga');
INSERT 0 2
test_app=> select * from foo;
 i |  v   
---+------
 1 | hoge
 2 | fuga
(2 rows)
```

プライマリの`postgresql.conf`を以下のように設定します。が、デフォルトで設定されているので大丈夫でしょう。

```sh
wal_level = replica
# 接続が急に切れたらコネクションがタイムアウトするまで残るので、必要数よりも少し大きめにする
max_wal_senders = 10
max_replication_slots = 10
archive_mode = off
hot_standby = on
```

設定が完了したら、一度プライマリを再起動します。

```sh
pg_ctl -D /home/jyuch/pgdata/11/primary restart
```

## スタンバイクラスタのベースコピー

スタンバイクラスタ用に`pg_basebackup`を使用してベースファイルのコピーを行います。

ここでは、レプリケーションスロットを新規で作成し、そのレプリケーションスロットを使用してベースバックアップを取得します。

レプリケーションスロットとは、プライマリ側で管理するスタンバイ側にどこまでのコミットが反映されたか管理するための機構です。
スタンバイ側が停止している間にプライマリ側に変更が行われた場合、スタンバイに未反映のWALは削除されず、スタンバイが復帰してレプリケーションが完了したらWALを消してくれるように制御してくれます。

そのため、逆にいつまでもスタンバイが復帰しない場合だとプライマリ側のWALが溢れるので、復帰しないの分かっている場合はレプリケーションスロットを消しておいた方が良いでしょう。

```sh
pg_basebackup -h localhost -D /home/jyuch/pgdata/11/standby -X stream --progress -U repl_user -R --create-slot --slot=localhost_standby
```

本来であればこの後スタンバイ側の`recovery.conf`を編集する必要があるのですが、なんか色々忖度して良い感じの設定を生成してくれているので、確認して良い感じだったらそのまま使います。

また、別サーバにスタンバイを立てているなら問題ありませんが、今回は同じサーバにスタンバイを立てている都合上スタンバイ側の待ち受けポートを`5433`に変更します。

```sh
port = 5433
```

待ち受けポートを変更したら、スタンバイ側を起動します。

```sh
pg_ctl -D /home/jyuch/pgdata/11/standby start
```

スタンバイとして起動すると、以下のメッセージが出力されます。

```sh
2021-08-10 15:59:45.519 JST [15881] LOG:  database system is ready to accept read only connections
```

## プライマリとスタンバイの同期

プライマリにデータを追加すると、スタンバイ側にも正常に伝搬していることが分かります。

```sh
$ psql -p 5432 -U test_app -c "INSERT INTO foo VALUES (3, 'puipui')" test_app
INSERT 0 1
```

```sh
$ psql -p 5433 -U test_app -c "SELECT * FROM foo" test_app
 i |   v    
---+--------
 1 | hoge
 2 | fuga
 3 | puipui
(3 rows)
```

また、プライマリ側でレプリケーション状態を確認すると、`state`が`streaming`（レプリケーション中）になっていることが確認出来ます。

```sh
$ psql -x -p 5432 -c "SELECT * FROM pg_stat_replication" postgres
-[ RECORD 1 ]----+------------------------------
pid              | 15887
usesysid         | 16384
usename          | repl_user
application_name | walreceiver
client_addr      | 127.0.0.1
client_hostname  | 
client_port      | 41818
backend_start    | 2021-08-10 15:59:45.529388+09
backend_xmin     | 
state            | streaming
sent_lsn         | 0/3000320
write_lsn        | 0/3000320
flush_lsn        | 0/3000320
replay_lsn       | 0/3000320
write_lag        | 
flush_lag        | 
replay_lag       | 
sync_priority    | 0
sync_state       | async
```

レプリケーションに遅延が発生している場合は、以下のように表示されます。（異なるクラスタでの結果なので、色々表示が異なります。）

```sh
-[ RECORD 1 ]----+------------------------------
pid              | 51409
usesysid         | 10
usename          | jyuch
application_name | server1
client_addr      | 127.0.0.1
client_hostname  | 
client_port      | 50836
backend_start    | 2021-08-11 13:30:08.561606+09
backend_xmin     | 
state            | streaming
sent_lsn         | 0/3D4F078
write_lsn        | 0/3D4F078
flush_lsn        | 0/3D4F078
replay_lsn       | 0/3D4F078
write_lag        | 00:00:00.000164 ← これ
flush_lag        | 00:00:00.011684 ← これ
replay_lag       | 00:00:00.011922 ← これ
sync_priority    | 0
sync_state       | async
```

また、スタンバイ側でマスタのどこまでを反映したかを表示すると、以下のような感じになります。

```sh
$ psql -p 5433 -c "SELECT pg_last_xact_replay_timestamp()" postgres
 pg_last_xact_replay_timestamp 
-------------------------------
 2021-08-10 16:04:35.821323+09
(1 row)
```

スタンバイ側はリードオンリーで起動しているため、データへの変更は出来ません。

```sh
$ psql -p 5433 -U test_app -c "INSERT INTO foo VALUES (4, 'standby')" test_app
2021-08-10 16:37:29.526 JST [16558] ERROR:  cannot execute INSERT in a read-only transaction
2021-08-10 16:37:29.526 JST [16558] STATEMENT:  INSERT INTO foo VALUES (4, 'standby')
ERROR:  cannot execute INSERT in a read-only transaction
```

## フェールオーバー

フェールオーバーをテストするため、まずプライマリ側を停止させます。 `-m immediate`を指定する事で疑似的にクラッシュを再現します。

```sh
$ pg_ctl stop -m immediate -D /home/jyuch/pgdata/11/primary
```

※プライマリを停止させた瞬間から、スタンバイ側のログにプライマリに接続できねーよとログが出続けます。

スタンバイ側は引き続き参照は出来ますが、更新は出来ません。

```sh
$ psql -p 5433 -U test_app -c "SELECT * FROM foo" test_app
 i |   v    
---+--------
 1 | hoge
 2 | fuga
 3 | puipui
(3 rows)

$ psql -p 5433 -U test_app -c "INSERT INTO foo VALUES (4, 'standby')" test_app
ERROR:  cannot execute INSERT in a read-only transaction
```

スタンバイをプライマリに昇格させるには、以下のコマンドを投入します。

```sh
$ pg_ctl -D /home/jyuch/pgdata/11/standby promote
waiting for server to promote.... done
server promoted
```

この状態であれば、新プライマリ（旧スタンバイ）から変更が出来るようになります。

```sh
$ psql -p 5433 -U test_app -c "INSERT INTO foo VALUES (4, 'standby')" test_app
INSERT 0 1

$ psql -p 5433 -U test_app -c "SELECT * FROM foo" test_app
 i |    v    
---+---------
 1 | hoge
 2 | fuga
 3 | puipui
 4 | standby
(4 rows)
```

## 旧プライマリの復帰

この状態から旧プライマリをスタンバイとして復帰させることも出来るっぽいですが、新プライマリにレプリケートされていないWALがある状態だと復帰出来ないらしいので、おとなしくクラスタを作り直してスタンバイとして追加した方が良さげです。

まぁこの辺は正直なんともかんともなので、本番環境でやる時は詳しい人に聞いた方が良いかもしれません。

```sh
pg_basebackup -h localhost -p 5433 -D /home/jyuch/pgdata/11/new-standby -X stream --progress -U repl_user -R --create-slot --slot=localhost_new_standby
```

```sh
port = 5434
```

```sh
pg_ctl -D /home/jyuch/pgdata/11/new-standby start
```

```sh
$ psql -p 5434 -U test_app -c "SELECT * FROM foo" test_app
 i |    v    
---+---------
 1 | hoge
 2 | fuga
 3 | puipui
 4 | standby
(4 rows)
```

## スタンバイ停止時のレプリケート

スタンバイ側を停止させてもデータロストは発生せず、プライマリ側の変更はスタンバイが復帰したタイミングでレプリケートされることが確認出来ます。

```sh
pg_ctl -D /home/jyuch/pgdata/11/new-standby stop
```

```sh
$ psql -p 5433 -U test_app -c "INSERT INTO foo VALUES (5, 'standby is offline')" test_app
INSERT 0 1
```

```sh
$ pg_ctl -D /home/jyuch/pgdata/11/new-standby start
$ psql -p 5434 -U test_app -c "SELECT * FROM foo" test_app
 i |         v          
---+--------------------
 1 | hoge
 2 | fuga
 3 | puipui
 4 | standby
 5 | standby is offline
(5 rows)
```
