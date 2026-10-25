---
title: PostgreSQLでも統計情報を確認したい
description: PostgreSQLの統計情報を確認方法を解説しています
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

PostgreSQLは自動もしくは手動の解析（Analyze）でテーブルの統計情報を取得しています。
当該情報を確認すればテーブルがどの程度のタプルを有しているかや、どれだけ無効なタプルを有しているかの確認が出来ます。

というのが公式リファレンスに載っています。困ったら公式リファレンスを参照する　旧約聖書にも載っています。

[公式リファレンス](https://www.postgresql.jp/document/11/html/monitoring-stats.html)

## 統計ビューを参照する際の注意点

統計ビューは**リアルタイムには更新されません。**

統計ビューの内容はいくつかの要因によって更新までにある程度の遅延が発生します。
そのため、進行中のトランザクションによって変更されている行数などは統計ビューの各種情報には反映されません。

いくつかの要因と言葉を濁していますが、正直よく分かりません。 まぁ確かに更新が遅れているなぁ程度の認識です。

また、統計ビュー自体をトランザクション内で実行している場合においては、常に同じ値を返し続けます。
これは、トランザクション内で複数のビューで問い合わせを行った際にその時点での一貫した回答を行うためです。
そのため、最新の値を取得したい場合はトランザクションの外側でクエリを実行する必要があります。

集められた統計情報はシャットダウン中にデータディレクトリに特定のサブディレクトリに格納され、永続化されます。
しかし、クラッシュ等が発生し次回起動時にリカバリを要する場合は正しく保存されていない可能性があるため統計情報はクリアされます。

## テーブル統計情報

テーブルの統計情報を確認するには、`pg_stat_all_tables`統計ビューを参照します。

```sql
SELECT relid,                                                   -- テーブルのOID
       schemaname,                                              -- テーブルが存在するスキーマ名
       relname,                                                 -- テーブルの名前
       seq_scan,                                                -- テーブルがシーケンシャルスキャンされた回数
       seq_tup_read,                                            -- シーケンシャルスキャンによって取り出された有効行の個数
       idx_scan,                                                -- インデックススキャンの回数
       idx_tup_fetch,                                           -- インデックススキャンによって取り出された有効行の個数
       n_tup_ins,                                               -- 挿入された行数
       n_tup_upd,                                               -- HOT更新を含む更新された行数
       n_tup_del,                                               -- 削除された行数
       n_tup_hot_upd,                                           -- HOT更新された行数
       n_live_tup,                                              -- 有効行の推定値
       n_dead_tup,                                              -- 不要行の推定値
       n_mod_since_analyze,                                     -- 最後にanalyzeをされてからの変更された行の推定値
       last_vacuum AT TIME ZONE 'JST'      AS last_vacuum,      -- 最後に明示的に実行されたバキューム処理の日付（VACUUM FULLは含まず）
       last_autovacuum AT TIME ZONE 'JST'  AS last_autovacuum,  -- 最後に自動バキュームデーモンによってバキュームが行われた日付
       last_analyze AT TIME ZONE 'JST'     AS last_analyze,     -- 最後に明示的に実行されたアナライズ処理の日付
       last_autoanalyze AT TIME ZONE 'JST' AS last_autoanalyze, -- 自動バキュームデーモンによってアナライズが行われた日付
       vacuum_count,                                            -- 明示的にバキューム処理が行われた回数（VACUUM FULLは含まず）
       autovacuum_count,                                        -- 自動バキュームデーモンによって行われたバキューム処理の回数
       analyze_count,                                           -- 明示的にアナライズが行われた回数
       autoanalyze_count                                        -- 自動バキュームデーモンによって行われたアナライズの回数
FROM pg_stat_all_tables
WHERE schemaname = 'public'
  AND relname = 'hoge';
```

このビューは当該テーブルを手動で`ANALYZE`する事で強制的に更新できるようです。

テーブルのディスク上のサイズを確認するには`pg_class`ビューを使用します。

```sql
-- 不思議な力でテーブルのディスク上のサイズが分かるクエリ
SELECT
  pgn.nspname,
  relname,
  pg_size_pretty(relpages::bigint * 8 * 1024) AS size,
  CASE
    WHEN relkind = 't'
	  THEN (SELECT pgd.relname FROM pg_class pgd WHERE pgd.reltoastrelid = pg.oid)
    WHEN nspname = 'pg_toast' AND relkind = 'i'
      THEN (SELECT pgt.relname FROM pg_class pgt WHERE SUBSTRING(pgt.relname FROM 10) = REPLACE(SUBSTRING(pg.relname FROM 10), '_index', ''))
    ELSE (SELECT pgc.relname FROM pg_class pgc WHERE pg.reltoastrelid = pgc.oid) END::varchar
  AS refrelname,
  CASE
    WHEN nspname = 'pg_toast' AND relkind = 'i'
	  THEN (SELECT pgts.relname FROM pg_class pgts WHERE pgts.reltoastrelid = (
        SELECT
          pgt.oid
        FROM
		  pg_class pgt
        WHERE
		  SUBSTRING(pgt.relname FROM 10) = REPLACE(SUBSTRING(pg.relname FROM 10), '_index', ''))) END
  AS relidxrefrelname,
  relfilenode,
  relkind,
  reltuples::bigint,
  relpages
FROM
  pg_class pg,
  pg_namespace pgn
WHERE
  pg.relnamespace = pgn.oid
  AND pgn.nspname NOT IN ('information_schema', 'pg_catalog')
ORDER BY relpages DESC;
```

例として、以下のようなテーブルにランダムな値を1000万行挿入した後にランダムに500万行の書き換えた後のビューの結果を以下に示します。

`n_tup_del`が0なのは、クエリ実行前に手動で`VACUUM`を走らせたためです。たぶん

```sql
create table hoge
(
    ver_qoid     varchar(20) not null,
    ver_num      integer     not null,
    item_name    varchar(30) not null,
    update_count integer     not null
);

alter table hoge add constraint hoge_pkey primary key (ver_qoid, ver_num);
```

おわり
