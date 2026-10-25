---
title: Pgpool-IIを使用した高可用性構成を試してみたい
description: Pgpool-IIを使用して複数のクラスタを制御し、プライマリへの自動昇格が行えるかを確認します
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

Postgres標準のストリーミングレプリケーションだけでは、スタンバイは自動的にプライマリに昇格せずオペレータの介在を必要とします。

ここでは、Pgpool-IIを使用して複数のクラスタを制御し、プライマリへの自動昇格を行わせます。

## 環境のセットアップ

ゼロから構築するのは割とつらいので、`pgpool_setup`を使用してテスト環境を構築します。

このツールはテスト環境を手早くでっち上げるためのツールなので、本番には使えません。

ローカルからパスワード無しでsshログインが出来る必要があるので、鍵を生成してそのまま自分の公開鍵リストに突っ込みます。

```sh
ssh-keygen -t ed25519 -C localhost
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

PostgresやPgpool-IIのインストール先がデフォルトと異なるので、それぞれのインストール先を環境変数に設定していきます。

```sh
export PGPOOL_INSTALL_DIR=/home/jyuch/local/pgpool
export PGBIN=/home/jyuch/local/pg/11/bin 
export PGLIB=/home/jyuch/local/pg/11/lib
```

データベースクラスタや設定ファイル群を格納するディレクトリを作成し、その中にテスト環境をセットアップします。

```sh
mkdir ~/pgdata/pgpooltest && cd ~/pgdata/pgpooltest
pgpool_setup -s
```

以下のコマンドでシステム全体が起動します。

```sh
./startall
```

起動すると（変更していなければ）Pgpool-IIは`11000`ポートで待ち受けます。
任意のデータベースに対して`show pool_nodes`疑似SQLを投入すると参加しているクラスタの状況が見られます。
`pgpool_setup`は`test`データベースを自動的に作成するので、今回はこれを使用します。

```sh
$ psql -p 11000 -c "show pool_nodes" test
-[ RECORD 1 ]----------+--------------------
node_id                | 0
hostname               | /tmp
port                   | 11002
status                 | up
lb_weight              | 0.500000
role                   | primary
select_cnt             | 0
load_balance_node      | false
replication_delay      | 0
replication_state      |  
replication_sync_state |  
last_status_change     | 2021-08-11 11:08:24
-[ RECORD 2 ]----------+--------------------
node_id                | 1
hostname               | /tmp
port                   | 11003
status                 | up
lb_weight              | 0.500000
role                   | standby
select_cnt             | 0
load_balance_node      | true
replication_delay      | 0
replication_state      | streaming
replication_sync_state | async
last_status_change     | 2021-08-11 11:08:24
```

## レプリケーション

ここでは、テストデータとして`pgbench`のデータを流し込みます。

```sh
$ pgbench -i -p 11000 test
```

ベンチマークを走らせて、結果をそれぞれのDBに問い合わせると同じ答えが返ってくるので、問題なさそうです。

```sh
$ pgbench -p 11000 -T 10 test
psql -p 11002 -c "SELECT sum(abalance) FROM pgbench_accounts" test
  sum  
-------
 92663
(1 row)

psql -p 11003 -c "SELECT sum(abalance) FROM pgbench_accounts" test
  sum  
-------
 92663
(1 row)
```

## フェイルオーバー

プライマリを停止させ、スタンバイが正常にプライマリに昇格するか確認します。

プライマリを疑似的に異常終了させます。

```sh
pg_ctl -m immediate -D data0 stop
```

すると、スタンバイが自動でプライマリに昇格します。

```sh
psql -x -p 11000 -c "show pool_nodes" test
-[ RECORD 1 ]----------+--------------------
node_id                | 0
hostname               | /tmp
port                   | 11002
status                 | down
lb_weight              | 0.500000
role                   | standby
select_cnt             | 690
load_balance_node      | false
replication_delay      | 0
replication_state      |  
replication_sync_state |  
last_status_change     | 2021-08-11 11:38:28
-[ RECORD 2 ]----------+--------------------
node_id                | 1
hostname               | /tmp
port                   | 11003
status                 | up
lb_weight              | 0.500000
role                   | primary
select_cnt             | 0
load_balance_node      | true
replication_delay      | 0
replication_state      |  
replication_sync_state |  
last_status_change     | 2021-08-11 11:38:28
```

この状態でも`pgbench`は完走します。

```sh
$ pgbench -p 11000 -T 10 test                                       
starting vacuum...end.
transaction type: <builtin: TPC-B (sort of)>
scaling factor: 1
query mode: simple
number of clients: 1
number of threads: 1
duration: 10 s
number of transactions actually processed: 1195
latency average = 8.375 ms
tps = 119.403809 (including connections establishing)
tps = 119.429839 (excluding connections establishing)
```

## オンラインリカバリ

ノードを復帰させるコマンドを投入します。

`pg_ctl`を使用して手動で再起動するとわけわかんない事になるのでやってはいけません。（１敗）

```sh
$ pcp_recovery_node -p 11001 -n 0
Password:  # ← 詳しい話は分からないが、とりあえず pgpool_setup を実行したユーザ名と同じであれば大丈夫っぽい
pcp_recovery_node -- Command Successful
```

```sh
$ psql -x  -p 11000 -c "show pool_nodes" test
-[ RECORD 1 ]----------+--------------------
node_id                | 0
hostname               | /tmp
port                   | 11002
status                 | up
lb_weight              | 0.500000
role                   | standby
select_cnt             | 0
load_balance_node      | false
replication_delay      | 0
replication_state      | streaming
replication_sync_state | async
last_status_change     | 2021-08-11 12:19:20
-[ RECORD 2 ]----------+--------------------
node_id                | 1
hostname               | /tmp
port                   | 11003
status                 | up
lb_weight              | 0.500000
role                   | primary
select_cnt             | 0
load_balance_node      | true
replication_delay      | 0
replication_state      | 
replication_sync_state | 
last_status_change     | 2021-08-11 12:18:27
```

すると、何となくノード0が復帰します。

おわり
