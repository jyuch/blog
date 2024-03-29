---
title: WindowsでもPostgreSQLのチューニングをしたい
description: WindowsにおけるPostgreSQLのチューニングパラメータの解説をしています
date: 2021-11-08
lastModified: 2022-11-23
tags: 
  - postgres
---

## はじめに

PostgreSQLをWindowsにインストールする際にどのパラメータをチューニングするのか良く忘れるのでそれについてです。

特にチューニング系のパラメータはそこそこ数が多く、どのパラメータがどこに影響するのかよく忘れるのでその辺ですね。

## 検証に使用したプラットフォーム

ここで述べる内容については、以下のプラットフォームで検証を行っています。
使用するOSのバージョンもしくはPostgresのバージョンによっては使用できないパラメータがあるかもしれません。

- Windows
  - Windows 10 2004（19041.264）
- Postgres
  - EDB社製ディストリビューション バージョン11.12

## インストール時に注意すべきパラメータ

### デフォルトロケール

デフォルトでは、デフォルトロケールはインストーラを実行しているOSに設定されている値が使用されます。

しかし、ロケールとして`C`以外を使用すると`C`を設定している場合と比べて文字列のソートが遅くなる傾向があります。
これは、`C`の場合ではソート等に使用する照合順序として文字コードが使用されるのに対して、`C`以外ではそれぞれのロケールの言語の辞書が使用されるためです。
また、`C`以外のロケールでは使用できない機能等も存在します。

そのため、デフォルトロケールとして`C`を使用し、特定の言語向けの照合順序を使用する必要がある場合にはデータベース毎もしくはテーブル毎にロケールを設定するようにした方が良いでしょう。

### データディレクトリ

インストーラのデフォルトでは、データディレクトリは`C:\Program Files\PostgreSQL\data`以下に作成されます。

しかし、Windows Vista・Server 2008以降のWindows
OSでは`C:\Program Files`などの特定のディレクトリのセキュリティが強化され、編集する場合は管理者ユーザでもUACによる特権昇格が要求されるようになりました。
また、`C:\Program Files`の用途としてこのディレクトリにはアプリケーションのみが配置される前提となっています。そのため、データディレクトリは別のディレクトリに配置する事をお勧めします。

個人的には`<ドライブレター>:\pgdata\<メジャーバージョン>`（例：`C:\pgdata\11`）のようなディレクトリパスに作成することをお勧めしています。
Postgresはメジャーバージョン間で内部データの互換性が失われることがあります。そのため、新しいメジャーバージョンをインストールした際に同じルールでデータディレクトリを作成出来るようパスにメジャーバージョンを含めています。

## インストール後に設定すべきパラメータ

### セキュリティ

<table>
<tr>
  <th>項目</th>
  <th>説明</th>
</tr>
<tr>
  <td>listen_addresses</td>
  <td>
  インストール直後の構成では、Postgresはローカルループバックに対してのみ接続を待ち受けます。
  外部からの接続を受け付ける場合はこのパラメータを適切なIPアドレスもしくは<code>*</code>に設定する必要があります。
  </td>
</tr>
<tr>
  <td>password_encryption</td>
  <td>
  <p>
  PostgreSQLユーザのパスワードのハッシュアルゴリズムを指定します。
  デフォルトの<code>md5</code>は現在では安全な暗号学的ハッシュ関数とみなされていません。
  そのため、クライアントがサポートしていないなどの場合を除いて<code>scram-sha-256</code>を指定した方がより安全です。
  </p>
  また、可能であれば<code>pg_hba.conf</code>構成ファイルを使用して、特定のデータベースやユーザとして接続出来るIPアドレスを制限した方が良いでしょう。
  </td>
</tr>
</table>

### メモリ・ストレージ・WAL

Postgresはインストール直後の設定ではメモリをあまり消費しないよう構成されています。
そのため、大容量のメモリを積んでなおかつデータベース専用機として使用する場合はメモリをより積極的に使用できるよう設定を行う必要があります。

また、オンライントランザクションのようなレスポンスを気にするシステムと、データウェアハウスのようなスループットを気にするシステムではチューニングが異なります。
そのため、どちらのワークロードがより実運用に近いかを意識する必要があります。

<table>
<tr>
  <th>項目</th>
  <th>説明</th>
</tr>
<tr>
  <td>shared_buffers</td>
  <td>
  読み込み及び書き込みに使用するための共有バッファのメモリ量を指定します。
  Postgresで使用可能なメモリの25%が妥当と言われています。また、PostgresはOSのファイルキャッシュにも依存しているため、やみくもに大きくすると逆効果となります。
  </td>
</tr>
<tr>
  <td>effective_cache_size</td>
  <td>
  プランナがクエリプランを生成する際に参考とするOSのファイルキャッシュの大きさを指定します。
  実際にこのサイズのメモリを消費するわけではありません。
  Windowsであれば、SuperFetch君が使えるメモリ量を指定すれば大丈夫っぽいです。
  </td>
</tr>
<tr>
  <td>work_mem</td>
  <td>
  <p>
  ソートなどのクエリ操作中に使用可能な最大メモリ量を指定します。
  このサイズを超える場合は一時ファイルに書き出されるようになります。
  </p>
  <p>
  ネット上の記事では1つのセッションでの最大メモリ量と解説されることがありますが、それは誤りです。
  1つのセッションでクエリ操作がパラレル実行される場合、それぞれのクエリ操作で<code>work_mem</code>だけ使用されます。
  そのため使用されるメモリ量は同時実行数に乗じられます。
  </p>
  <p>
  極端に大きな値を設定した場合、同時コネクション数によっては使用できるメモリが枯渇する事になります。
  逆に小さすぎる場合、小さなデータセットのソートでも一時ディスクにデータを書き込むようになるため動作が遅くなります。以下の式をベースに調整するのが良いでしょう。
  </P>
  <code>（PostgreSQLで使用可能なメモリ － 共有バッファ）÷ 最大コネクション数</code>
  </td>
</tr>
<tr>
  <td>maintenance_work_mem</td>
  <td>
  バキュームなどの保守操作で使用される最大メモリ量を指定します。
  このメモリ量を増やすことでダンプからのリストアが高速に処理されるようになります。
  データウェアハウスなどの大量のデータの入れ替えが発生するシステムでは多めに設定した方が良いでしょう。
  </td>
</tr>
<tr>
  <td>min_wal_size</td>
  <td>
  ディスク上に保持するWALの最小サイズを指定します。
  WALファイルはデータ正常にディスクに書き込まれた後に再利用するため、常にこのパラメータで指定しているサイズは保持されます。
  </td>
</tr>
<tr>
  <td>max_wal_size</td>
  <td>
  <p>
  WALがこのサイズを超えた場合、チェックポイント間隔以下でもチェックポイントが実行されます。
  この値はソフトリミットで、ディスクの負荷状況によってはWALがこのサイズを上回る可能性があります。
  </p>
  チェックポイントは非常にI/Oコストが大きい処理です。
  そのため、データウェアハウスのような大量のデータを一度に流し込むような用途ではこのパラメータを十分に大きくします。
  </td>
</tr>
<tr>
  <td>checkpoint_timeout</td>
  <td>
  <p>
  自動チェックポイントを発動させる間隔を指定します。この設定値が小さいと頻繁にチェックポイントが走るようになるため書き込みの性能が劣化します。
  </p>
  <p>
  一般的には<code>30min</code>以上を設定します。
  </p>
</tr>
<tr>
  <td>checkpoint_completion_target</td>
  <td>
  <p>
  あるチェックポイントまでに完了したトランザクションデータは次のチェックポイントまでの間で均等にならされてディスクに書き込まれます。
  これは、チェックポイント直後のI/O処理のバーストを防ぐための措置です。
  </p>
  その書き込みの際に、チェックポイント間隔のどのくらいの割合でならしながら書き込むかを指定します。
  </td>
</tr>
<tr>
  <td>wal_buffers</td>
  <td>
  WALレコードをディスクに書き込む際のバッファ量を指定します。
  </td>
</tr>
<tr>
  <td>random_page_cost</td>
  <td>
  プランナに対して使用しているディスク装置のランダムにアクセスする際のコストを指定するものです。
  HDDであれば<code>4.0</code>、SSDであれば<code>1.1</code>を指定します。
  根拠はよく分かりません。
  </td>
</tr>
<tr>
  <td>max_worker_processes</td>
  <td>
  バックグラウンドワーカープロセスの最大数を指定します。
  データベース専用機であれば一般的にコア当たりのスレッド数×コア数×ソケット数を指定します。
  </td>
</tr>
<tr>
  <td>max_parallel_workers_per_gather</td>
  <td>
  結合処理の際に並列で稼働させる最大のワーカー数を指定します。
  ワーカープロセスは<code>max_worker_processes</code>で指定したワーカープールから取り出されて使用されるため、<code>max_worker_processes</code>以上に指定しても意味がありません。
  </td>
</tr>
<tr>
  <td>max_parallel_workers</td>
  <td>
  パラレルクエリ操作用に使用されるワーカーの最大数を指定します。
  大体は<code>max_worker_processes</code>と同じです。
  </td>
</tr>
<tr>
  <td>max_parallel_maintenance_workers</td>
  <td>
  ユーティリティコマンドで使用できる最大のワーカー数を設定します。
  が、パラレルワーカーを使えるユーティリティコマンドは<code>CREATE INDEX</code>位なので、まぁ、その
  </td>
</tr>
<tr>
  <td>default_statistics_target</td>
  <td>
  <p>
  デフォルトの統計対象を指定します。
  大きな値を設定すると、ANALYZEに時間が掛かるようになりますが、よりプランナの予測品質が向上します。
  </p>
  DWHのような読み取り主体のワークロードであれば、デフォルト値よりも大きくしても良いかもしれません。
  </td>
</tr>
</table>

## 設定例

このセクションでは、以下のハードウェアとワークロード傾向におけるチューニング例と、ベンチマーク結果について提示します。

### ハードウェアとワークロード傾向

今回想定するハードウェアは以下の通りとなります。
また、今回のワークロードは読み取りが主体かつ、複雑なクエリを実行する事が予想されるためDWH寄りの傾向を想定しています。

| 項目             | 値                                            |
| :--------------- | :-------------------------------------------- |
| OS               | Windows 10 2004（19041.264）                  |
| Postgres         | EDB社製ディストリビューション バージョン11.12 |
| CPU              | Intel(R) Core(TM) i3-6100U CPU @ 2.30GB       |
| メモリ           | 8.0GB                                         |
| ストレージ       | SSD 128GB                                     |
| ワークロード傾向 | DWH                                           |

### チューニングパラメータ一覧

今回は以下のチューニングを行っています。

| 項目                             | 値            | 備考                                                                                |
| :------------------------------- | :------------ | :---------------------------------------------------------------------------------- |
| listen_addresses                 | *             |                                                                                     |
| port                             | 5432          |                                                                                     |
| password_encryption              | scram-sha-256 |                                                                                     |
| shared_buffers                   | 2GB           | 物理メモリの1/4。                                                                   |
| work_mem                         | 31MB          |                                                                                     |
| maintenance_work_mem             | 768MB         | ワークロードがDWH寄りなので多めにする。                                             |
| max_worker_processes             | 2             | 2コアなので。                                                                       |
| max_parallel_maintenance_workers | 1             |                                                                                     |
| max_parallel_workers_per_gather  | 1             |                                                                                     |
| max_parallel_workers             | 2             |                                                                                     |
| wal_buffers                      | 16MB          | <code>shared_buffers</code>を増やしているので合わせて増やす。                       |
| max_wal_size                     | 6GB           | ワークロードがDWH寄りなので多めにする。                                             |
| min_wal_size                     | 2GB           |                                                                                     |
| checkpoint_completion_target     | 0.9           |                                                                                     |
| random_page_cost                 | 1.1           | SSDなので。                                                                         |
| effective_cache_size             | 4GB           |                                                                                     |
| default_statistics_target        | 500           | DWHなので、アナライズに時間を掛けてもトータルのクエリコストがペイ出来るため増やす。 |

### ベンチマーク

ワークロードはDWH寄りなので、それに応じたベンチマーク規格としてTPC-Hを実施します。

| 条件             | 値 |
| :--------------- | :- |
| スケールファクタ | 1  |
| 同時接続数       | 1  |

また、ベンチマークツールとしてHammerDBのバージョン4.2を使用しています。

条件を変えてテストした訳ではないため厳密性には欠けますが、デフォルト値とチューニング済みでは以下の差異が見られました。

|                  |                                  |
| :--------------- | :------------------------------- |
| デフォルト設定   | 2.1秒/クエリ（各クエリの平均値） |
| チューニング済み | 1.1秒/クエリ（各クエリの平均値） |

おわり
