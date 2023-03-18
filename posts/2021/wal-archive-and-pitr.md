---
title: PostgreSQLでもWALアーカイブを使用してPITRしたい
description: PostgreSQLでもWALアーカイブを使用してPITRしたい
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

ここではベースバックアップとWALアーカイブを組み合わせ、クラッシュ直前の状態までクラスタを復旧させる方法を確認します。

また、リカバリオプションを確認し、任意の時点までのリカバリを行えることを確認します。

## 諸元

ここでは、以下のディレクトリにデータベースクラスタとWALアーカイブを保存します。

|                                      |                               |
| :----------------------------------- | :---------------------------- |
| データベースクラスタ（プライマリ）   | /home/jyuch/pgdata/11/primary |
| データベースクラスタ（バックアップ） | /home/jyuch/pgdata/11/standby |
| WALアーカイブ                        | /home/jyuch/pgdata/11/walarch |

## データベースクラスタの初期化

それとなくデータベースクラスタを初期化します。

```sh
initdb --no-locale --encoding=UTF-8 -D /home/jyuch/pgdata/11/primary
```

アーカイブ先を作成します。

```sh
mkdir -p /home/jyuch/pgdata/11/walarch
```

`postgres.conf`を編集して、WALをアーカイブ先にアーカイブするように構成します。
また、1分で強制的にWALファイルをローテートするようにします。（本番用途では短すぎる値なので、もっと伸ばした方が良いです。）

また、確実にチェックポイント前にデータベースが吹っ飛ぶように`checkpoint_timeout`を極端な値にします。（テスト用の構成なので、本番では絶対にマネしないでね）

```sh
archive_mode = on
archive_command = 'test ! -f /home/jyuch/pgdata/11/walarch/%f && cp %p /home/jyuch/pgdata/11/walarch/%f'
archive_timeout = 1min
checkpoint_timeout = 1d
max_wal_size = 4GB
min_wal_size = 1GB
```

```sh
pg_ctl -D /home/jyuch/pgdata/11/primary start
```

データベースを作成します。

```sh
$ psql postgres
psql (11.12)
Type "help" for help.

postgres=# CREATE DATABASE test;
CREATE DATABASE
postgres=# \q

$ psql test    
psql (11.12)
Type "help" for help.

test=# CREATE TABLE hoge (msg varchar(100));
CREATE TABLE
test=# INSERT INTO hoge VALUES ('database initialized');
INSERT 0 1
test=# \q
```

一度、強制的にチェックポイントを走らせます。

これで、この時点の変更はすべてディスクに書き出された事が保証されます。

```sh
psql -c "CHECKPOINT" postgres
```

`pg_basebackup`でベースバックアップを取得します。

```sh
pg_basebackup -h localhost -D /home/jyuch/pgdata/11/standby -X stream --progress
```

## データベースクラスタの破壊

新しいレコードを挿入したら、WALがローテートされるのを待ってからクラスタを南無三します。

```sh
psql -c "INSERT INTO hoge VALUES ('before crash')" test; \
  sleep 70; \
  pg_ctl stop -m immediate -D /home/jyuch/pgdata/11/primary
```

## リカバリ

ベースバックアップを採ったディレクトリに`recovery.conf`を追加し、WALアーカイブからのコピーコマンドを追加します。

```sh
restore_command = 'cp /home/jyuch/pgdata/11/walarch/%f %p'
```

追加したらリカバリ側を起動させます。

```sh
$ pg_ctl -D /home/jyuch/pgdata/11/standby start
waiting for server to start....2021-08-12 10:23:20.654 JST [16316] LOG:  listening on IPv4 address "127.0.0.1", port 5432
2021-08-12 10:23:20.681 JST [16316] LOG:  listening on Unix socket "/tmp/.s.PGSQL.5432"
2021-08-12 10:23:20.734 JST [16317] LOG:  database system was interrupted; last known up at 2021-08-12 10:02:44 JST
2021-08-12 10:23:20.837 JST [16317] LOG:  starting archive recovery
2021-08-12 10:23:20.851 JST [16317] LOG:  restored log file "000000010000000000000004" from archive
2021-08-12 10:23:21.076 JST [16317] LOG:  redo starts at 0/4000028
2021-08-12 10:23:21.085 JST [16317] LOG:  consistent recovery state reached at 0/40000F8
2021-08-12 10:23:21.085 JST [16316] LOG:  database system is ready to accept read only connections
2021-08-12 10:23:21.099 JST [16317] LOG:  restored log file "000000010000000000000005" from archive
 done
server started
cp: cannot stat '/home/jyuch/pgdata/11/walarch/000000010000000000000006': No such file or directory
2021-08-12 10:23:21.264 JST [16317] LOG:  redo done at 0/5000170
2021-08-12 10:23:21.264 JST [16317] LOG:  last completed transaction was at log time 2021-08-12 10:06:19.604226+09
2021-08-12 10:23:21.294 JST [16317] LOG:  restored log file "000000010000000000000005" from archive
cp: cannot stat '/home/jyuch/pgdata/11/walarch/00000002.history': No such file or directory
2021-08-12 10:23:21.445 JST [16317] LOG:  selected new timeline ID: 2
2021-08-12 10:23:21.651 JST [16317] LOG:  archive recovery complete
cp: cannot stat '/home/jyuch/pgdata/11/walarch/00000001.history': No such file or directory
2021-08-12 10:23:21.905 JST [16316] LOG:  database system is ready to accept connections
```

WALアーカイブからリカバリが走り、ベースバックアップ後に追加したレコードも正常にリストア出来ていることが確認出来ます。

```sh
$ psql -c "SELECT * FROM hoge" test
         msg          
----------------------
 database initialized
 before crash
(2 rows)
```

## PITR

次に、WALアーカイブを利用したPITRを試してみます。

先ほどと同様にクラスタを作成・初期化します。

```sh
initdb --no-locale --encoding=UTF-8 -D /home/jyuch/pgdata/11/primary
mkdir -p /home/jyuch/pgdata/11/walarch
```

```sh
archive_mode = on
archive_command = 'test ! -f /home/jyuch/pgdata/11/walarch/%f && cp %p /home/jyuch/pgdata/11/walarch/%f'
archive_timeout = 1min
checkpoint_timeout = 1d
max_wal_size = 4GB
min_wal_size = 1GB
```

```sh
pg_ctl -D /home/jyuch/pgdata/11/primary start
```

データベースを作成します。

```sh
$ psql postgres
psql (11.12)
Type "help" for help.

postgres=# CREATE DATABASE test;
CREATE DATABASE
postgres=# \q

$ psql test    
psql (11.12)
Type "help" for help.

test=# CREATE TABLE foo (i timestamp, msg varchar(50));
CREATE TABLE
test=# \q
```

以下のスクリプトを実行し、データベースにデータを投入します。

```sh
#!/bin/sh

for i in `seq 5`
do
  echo "before basebackup `date`"
  psql -c "INSERT INTO foo VALUES (now(), 'before pg_basebackup $i')" test
  sleep 60
done

echo 'execute checkpoint'
psql -c "CHECKPOINT" postgres

echo 'execute pg_basebackup'
pg_basebackup -h localhost -D /home/jyuch/pgdata/11/standby -X stream --progress

for i in `seq 10`
do
  echo "after basebackup `date`"
  psql -c "INSERT INTO foo VALUES (now(), 'after pg_basebackup $i')" test
  sleep 60
done
```

投入したデータを確認します。

```sh
psql -c "SELECT * FROM foo ORDER BY i DESC" test
```

```sh
             i              |          msg           
----------------------------+------------------------
 2021-08-12 12:13:00.403919 | after pg_basebackup 10
 2021-08-12 12:12:00.208846 | after pg_basebackup 9
 2021-08-12 12:10:59.991466 | after pg_basebackup 8
 2021-08-12 12:09:59.796172 | after pg_basebackup 7
 2021-08-12 12:08:59.556793 | after pg_basebackup 6
 2021-08-12 12:07:59.542937 | after pg_basebackup 5
 2021-08-12 12:06:59.533902 | after pg_basebackup 4
 2021-08-12 12:05:59.413026 | after pg_basebackup 3
 2021-08-12 12:04:59.395453 | after pg_basebackup 2
 2021-08-12 12:03:59.386102 | after pg_basebackup 1
 2021-08-12 12:02:57.576892 | before pg_basebackup 5
 2021-08-12 12:01:57.37541  | before pg_basebackup 4
 2021-08-12 12:00:57.161414 | before pg_basebackup 3
 2021-08-12 11:59:57.13221  | before pg_basebackup 2
 2021-08-12 11:58:57.119013 | before pg_basebackup 1
(15 rows)
```

プライマリのクラスタを停止させます。

```sh
pg_ctl -D /home/jyuch/pgdata/11/primary stop
```

ここでは、12時8分30秒時点までリカバリするものとします。

スクリプト中で取得したベースバックアップに、`recovery.conf`を追加し、WALアーカイブからのコピーコマンドとPITRポイントを追加します。

```sh
restore_command = 'cp /home/jyuch/pgdata/11/walarch/%f %p'
recovery_target_time  = '2021-08-12 12:08:30 JST'
```

追加したらリカバリ側を起動させます。

```sh
pg_ctl -D /home/jyuch/pgdata/11/standby start
```

```sh
waiting for server to start....2021-08-12 12:17:41.105 JST [19993] LOG:  listening on IPv4 address "127.0.0.1", port 5432
2021-08-12 12:17:41.142 JST [19993] LOG:  listening on Unix socket "/tmp/.s.PGSQL.5432"
2021-08-12 12:17:41.179 JST [19994] LOG:  database system was interrupted; last known up at 2021-08-12 12:03:58 JST
2021-08-12 12:17:41.270 JST [19994] LOG:  starting point-in-time recovery to 2021-08-12 12:08:30+09
2021-08-12 12:17:41.284 JST [19994] LOG:  restored log file "000000010000000000000008" from archive
2021-08-12 12:17:41.475 JST [19994] LOG:  redo starts at 0/8000028
2021-08-12 12:17:41.484 JST [19994] LOG:  consistent recovery state reached at 0/80000F8
2021-08-12 12:17:41.485 JST [19993] LOG:  database system is ready to accept read only connections
 done
server started
2021-08-12 12:17:41.500 JST [19994] LOG:  restored log file "000000010000000000000009" from archive   
2021-08-12 12:17:41.697 JST [19994] LOG:  restored log file "00000001000000000000000A" from archive
2021-08-12 12:17:41.874 JST [19994] LOG:  restored log file "00000001000000000000000B" from archive
2021-08-12 12:17:42.050 JST [19994] LOG:  restored log file "00000001000000000000000C" from archive
2021-08-12 12:17:42.296 JST [19994] LOG:  restored log file "00000001000000000000000D" from archive
2021-08-12 12:17:42.467 JST [19994] LOG:  restored log file "00000001000000000000000E" from archive
2021-08-12 12:17:42.642 JST [19994] LOG:  recovery stopping before commit of transaction 580, time 2021-08-12 12:08:59.557185+09
2021-08-12 12:17:42.642 JST [19994] LOG:  recovery has paused
2021-08-12 12:17:42.642 JST [19994] HINT:  Execute pg_wal_replay_resume() to continue.
```

問題無かったら`pg_wal_replay_resume()`を実行しろと言われるので、実行します。

```sh
$ psql postgres
psql (11.12)
Type "help" for help.

postgres=# select pg_wal_replay_resume();
 pg_wal_replay_resume 
----------------------
 
(1 row)

postgres=# \q
```

リカバリが終了したと言われます。

```sh
2021-08-12 12:20:58.839 JST [19994] LOG:  redo done at 0/E000080
2021-08-12 12:20:58.839 JST [19994] LOG:  last completed transaction was at log time 2021-08-12 12:07:59.543321+09
cp: cannot stat '/home/jyuch/pgdata/11/walarch/00000002.history': No such file or directory
2021-08-12 12:20:58.896 JST [19994] LOG:  selected new timeline ID: 2
2021-08-12 12:20:59.145 JST [19994] LOG:  archive recovery complete
cp: cannot stat '/home/jyuch/pgdata/11/walarch/00000001.history': No such file or directory
2021-08-12 12:20:59.392 JST [19993] LOG:  database system is ready to accept connections
```

データを確認すると、指定した時点までのデータがリストアされていることが確認出来ます。

```sh
psql -c "SELECT * FROM foo ORDER BY i DESC" test
```

```sh
             i              |          msg           
----------------------------+------------------------
 2021-08-12 12:07:59.542937 | after pg_basebackup 5
 2021-08-12 12:06:59.533902 | after pg_basebackup 4
 2021-08-12 12:05:59.413026 | after pg_basebackup 3
 2021-08-12 12:04:59.395453 | after pg_basebackup 2
 2021-08-12 12:03:59.386102 | after pg_basebackup 1
 2021-08-12 12:02:57.576892 | before pg_basebackup 5
 2021-08-12 12:01:57.37541  | before pg_basebackup 4
 2021-08-12 12:00:57.161414 | before pg_basebackup 3
 2021-08-12 11:59:57.13221  | before pg_basebackup 2
 2021-08-12 11:58:57.119013 | before pg_basebackup 1
(10 rows)
```

おわり
