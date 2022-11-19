---
title: PostgreSQLの自動バキューム・自動解析の発動条件を確認したい
description: PostgreSQLの自動バキューム・自動解析の発動条件を確認したい
date: 2021-11-01
tags: 
  - postgres
---

## はじめに

PostgreSQLは追記型アーキテクチャを採用しており、削除だけではなく更新でも参照されないタプルが発生します。

高い頻度で書き込みを行うデータベースでなければ自動バキューム（Auto
Vacuum）でクリーンアップされるので特段気にすることはないと思いますが、どのタイミングで動くか分からない仕組みに依存するのも少し気が引けます。

というわけで、自動バキュームと自動解析の発動条件について確認してみたのでそれについてです。

## 自動バキューム

Postgresの自動バキュームはレコードの`update`、`delete`の合算した回数がしきい値を超えた場合にスケジュールされます。

閾値は`postgres.conf`のパラメータもしくはテーブルごとの設定値によって以下の計算式に従って計算されます。

```
pg_stat.reltuples * autovacuum_vacuum_scale_factor + autovacuum_vacuum_threshold
```

## 自動解析

PostgreSQLの自動解析は`insert`、`update`、`delete`の合算した回数がしきい値を超えた場合にスケジュールされます。

閾値は自動解析と同様に`postgres.conf`のパラメータもしくはテーブルごとの設定値によって以下の計算式に従って計算されます。

```
pg_stat.reltuples * autovacuum_analyze_scale_factor + autovacuum_analyze_threshold
```

## 実例

というわけで実例で確認してみます。

以下のクエリでテーブルごとの統計情報を確認できます。 （閾値はデフォルトの値を使用して計算しています。）

```sql
select pc.relname,                                                     -- テーブル名
       reltuples,                                                      -- 統計情報的にいるはずの行数
       n_live_tup,                                                     -- 統計情報的に生きてるはずの行数
       n_dead_tup,                                                     -- 統計情報的に死んでるはずの行数
       n_mod_since_analyze,                                            -- 前回統計を取った後に変わったっぽい行数
       last_autoanalyze at time zone 'Asia/Tokyo' as last_autoanalyze, -- 最後にauto analyzeが走った時刻
       last_autovacuum at time zone 'Asia/Tokyo'  as last_autovacuum,  -- 最後にauto vacuumが走った時刻
       (reltuples * 0.1) + 50                     as auto_analyze_thr, -- auto analyzeが走る閾値
       (reltuples * 0.2) + 50                     as auto_vacuum_thr   -- auto vacuumが走る閾値
from pg_class pc
         inner join pg_stat_all_tables psat on pc.oid = psat.relid
where pc.relname = 'table01';
```

また、それぞれのパラメータのデフォルト値は以下の通りです。

| name                               | setting | description                                                                               |
| :--------------------------------- | :------ | :---------------------------------------------------------------------------------------- |
| autovacuum\_analyze\_scale\_factor | 0.1     | Number of tuple inserts, updates, or deletes prior to analyze as a fraction of reltuples. |
| autovacuum\_analyze\_threshold     | 50      | Minimum number of tuple inserts, updates, or deletes prior to analyze.                    |
| autovacuum\_vacuum\_scale\_factor  | 0.2     | Number of tuple updates or deletes prior to vacuum as a fraction of reltuples.            |
| autovacuum\_vacuum\_threshold      | 50      | Minimum number of tuple updates or deletes prior to vacuum.                               |

これらのデフォルト値を使用した場合でも小規模なテーブルでは特に問題は起こさないと思います。

しかし、デフォルトの閾値が既存のテーブル行数に比例する形で計算されるため、例えば1億行のような非常に大きなテーブルになった場合においては自動バキュームが発動するまでの閾値が非常に大きくなります。
閾値が大きくなることにより自動バキューム間隔が伸びる・一度に処理するタプルが増えるためにパフォーマンスが明らかに劣化するなどの問題を発生させかねません。

カラム数によってテーブルのディスク上のサイズは大きく変わるので一概には言えませんが、6カラム・1億行のテーブルで大体ディスク上のサイズは15GBになります。
そのため、（単純に考えると）バキュームが発動するまでに16.5GBまでテーブルが肥大化することが予想されます。

そのため、特に大きな行数を含むテーブルに対しては以下の処置を行った方が良い場合があります。

- テーブルごとにパラメータを設定する。
- 夜間などに定期的に手動で`VACUUM`を実行する。

[テーブルごとに自動バキュームを最適化する](https://docs.microsoft.com/ja-jp/azure/postgresql/howto-optimize-autovacuum#optimize-autovacuum-per-table)

特に大きなテーブルの場合は、`autovacuum_vacuum_scale_factor`の値を`0`にしてしまい、代わりに`autovacuum_vacuum_threshold`を使用して固定行数で自動バキュームを発動させる方法もあります。

また、自動バキュームは当該行を参照可能なトランザクションが進行中の場合は何もできません。
そのため、ロングトランザクションが走っていると適切に不要行が回収されない可能性があります。

これは、自動バキュームに限らず手動で実行した場合にも当てはまります。

終わり
