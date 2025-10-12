---
title: PostgreSQL 18 の uuidv7 関数は単調増加が保証されているから安心だねってお話
description: PostgreSQL 18 の uuidv7 関数で生成されるUUIDv7は単調増加します。
date: 2025-10-12
lastModified: 2025-10-12
tags: 
  - postgres
---

# 長いので先にまとめ

- UUIDv7は[RFC9562](https://datatracker.ietf.org/doc/html/rfc9562)上ではミリ秒精度のタイムスタンプを持つことを要求している
- しかし、オプショナルとしてrand_a及びrand_bの生成方法を工夫して単調増加を保証しても良いとされている
- PostgreSQL 18 の`uuidv7()`関数はRFC9562のSection 6.2 Method 3で提案されているタイムスタンプをサブミリ秒まで拡張する方法で単調増加を保証している
  - サブミリ秒レベルでタイムスタンプが衝突した場合は、最小精度でインクリメントすることでタイムスタンプの衝突を回避している

# はじめに

最近リリースされたPostgreSQL 18 で UUIDv7 の生成がサポートされました。

個人的にはUUIDが生成順にソート可能になるうれしさがよく分からないのですが、いざ使うことになった際に困らないように調べてみることにしました。

# UUIDv7

そもそも、UUIDv7はどのような構造をしているのでしょうか。

[5.7. UUID Version 7](https://datatracker.ietf.org/doc/html/rfc9562#name-uuid-version-7)からビットレイアウトを引用して確認してみましょう。

```txt
    0                   1                   2                   3
    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                           unix_ts_ms                          |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |          unix_ts_ms           |  ver  |       rand_a          |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |var|                        rand_b                             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                            rand_b                             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

                   Figure 11: UUIDv7 Field and Bit Layout
```

バージョン（`ver`）とバリアント（`var`）を除くと、以下の要素から構成されていることが分かります。

|フィールド|説明|
|:-|:-|
|`unix_ts_ms`|48ビットで表現されたミリ秒精度のUnixエポックタイムスタンプ|
|`rand_a`|12ビットのランダムフィールド|
|`rand_b`|62ビットのランダムフィールド|

RFCが最低限求めている仕様では、タイムスタンプはミリ秒精度となっています。
そのため、同一ミリ秒内で複数回UUIDが生成された場合、生成された順序の並べ替えを保証出来なくなってしまいます。

そのため、[6.2. Monotonicity and Counters](https://datatracker.ietf.org/doc/html/rfc9562#name-monotonicity-and-counters)では、高頻度でのUUIID生成環境下での単調増加性を保証するための方法が提案されています。

# PostgreSQL 18 の UUIDv7

PostgreSQL 18 の`uuidv7()`関数はミリ秒タイムスタンプ + サブミリ秒タイムスタンプ + ランダム値で計算されていることが[ドキュメントに記載されています。](https://www.postgresql.org/docs/18/functions-uuid.html#FUNC_UUID_GEN_TABLE)

具体的には`uuid.c`の以下の`generate_uuidv7`関数で実装されています。

```c
/*
 * Generate UUID version 7 per RFC 9562, with the given timestamp.
 *
 * UUID version 7 consists of a Unix timestamp in milliseconds (48 bits) and
 * 74 random bits, excluding the required version and variant bits. To ensure
 * monotonicity in scenarios of high-frequency UUID generation, we employ the
 * method "Replace Leftmost Random Bits with Increased Clock Precision (Method 3)",
 * described in the RFC. This method utilizes 12 bits from the "rand_a" bits
 * to store a 1/4096 (or 2^12) fraction of sub-millisecond precision.
 *
 * unix_ts_ms is a number of milliseconds since start of the UNIX epoch,
 * and sub_ms is a number of nanoseconds within millisecond. These values are
 * used for time-dependent bits of UUID.
 *
 * NB: all numbers here are unsigned, unix_ts_ms cannot be negative per RFC.
 */
static pg_uuid_t *
generate_uuidv7(uint64 unix_ts_ms, uint32 sub_ms)
{
	pg_uuid_t  *uuid = palloc(UUID_LEN);
	uint32		increased_clock_precision;

	/* Fill in time part */
	uuid->data[0] = (unsigned char) (unix_ts_ms >> 40);
	uuid->data[1] = (unsigned char) (unix_ts_ms >> 32);
	uuid->data[2] = (unsigned char) (unix_ts_ms >> 24);
	uuid->data[3] = (unsigned char) (unix_ts_ms >> 16);
	uuid->data[4] = (unsigned char) (unix_ts_ms >> 8);
	uuid->data[5] = (unsigned char) unix_ts_ms;

	/*
	 * sub-millisecond timestamp fraction (SUBMS_BITS bits, not
	 * SUBMS_MINIMAL_STEP_BITS)
	 */
	increased_clock_precision = (sub_ms * (1 << SUBMS_BITS)) / NS_PER_MS;

	/* Fill the increased clock precision to "rand_a" bits */
	uuid->data[6] = (unsigned char) (increased_clock_precision >> 8);
	uuid->data[7] = (unsigned char) (increased_clock_precision);

	/* fill everything after the increased clock precision with random bytes */
	if (!pg_strong_random(&uuid->data[8], UUID_LEN - 8))
		ereport(ERROR,
				(errcode(ERRCODE_INTERNAL_ERROR),
				 errmsg("could not generate random values")));

#if SUBMS_MINIMAL_STEP_BITS == 10

	/*
	 * On systems that have only 10 bits of sub-ms precision,  2 least
	 * significant are dependent on other time-specific bits, and they do not
	 * contribute to uniqueness. To make these bit random we mix in two bits
	 * from CSPRNG. SUBMS_MINIMAL_STEP is chosen so that we still guarantee
	 * monotonicity despite altering these bits.
	 */
	uuid->data[7] = uuid->data[7] ^ (uuid->data[8] >> 6);
#endif

	/*
	 * Set magic numbers for a "version 7" (pseudorandom) UUID and variant,
	 * see https://www.rfc-editor.org/rfc/rfc9562#name-version-field
	 */
	uuid_set_version(uuid, 7);

	return uuid;
}
```

詳しくは実装を読んでもらえればと思いますが、`rand_a`フィールドの12bitにナノ秒（Linux）を埋め込むか、マイクロ秒 + ランダム値（Windows・mac）を埋め込んでいます。

また、現在時刻を供給している`get_real_time_ns_ascending`関数内で、前回との時刻の差分が`rand_a`フィールドに埋め込むタイムスタンプの精度以下の場合は、最小精度（Linuxの場合は245マイクロ秒）を加算することでサブミリ秒内でタイムスタンプが衝突することを防いでいます。

```c
/*
 * Get the current timestamp with nanosecond precision for UUID generation.
 * The returned timestamp is ensured to be at least SUBMS_MINIMAL_STEP greater
 * than the previous returned timestamp (on this backend).
 */
static inline int64
get_real_time_ns_ascending()
{
	static int64 previous_ns = 0;
	int64		ns;

	/* Get the current real timestamp */

#ifdef	_MSC_VER
	struct timeval tmp;

	gettimeofday(&tmp, NULL);
	ns = tmp.tv_sec * NS_PER_S + tmp.tv_usec * NS_PER_US;
#else
	struct timespec tmp;

	/*
	 * We don't use gettimeofday(), instead use clock_gettime() with
	 * CLOCK_REALTIME where available in order to get a high-precision
	 * (nanoseconds) real timestamp.
	 *
	 * Note while a timestamp returned by clock_gettime() with CLOCK_REALTIME
	 * is nanosecond-precision on most Unix-like platforms, on some platforms
	 * such as macOS it's restricted to microsecond-precision.
	 */
	clock_gettime(CLOCK_REALTIME, &tmp);
	ns = tmp.tv_sec * NS_PER_S + tmp.tv_nsec;
#endif

	/* Guarantee the minimal step advancement of the timestamp */
	if (previous_ns + SUBMS_MINIMAL_STEP_NS >= ns)
		ns = previous_ns + SUBMS_MINIMAL_STEP_NS;
	previous_ns = ns;

	return ns;
}
```

そのため、実用的かどうかと言われるとｱﾚですが、`uuidv7()`関数で生成されたUUIDv7からサブミリ秒のタイムスタンプを抽出することが出来ます。

```rust
// サブミリ秒が12ビットで供給されている環境用
fn uuidv7_to_timestamp(uuidv7: &str) -> (i64, i64) {
    let uuid = uuidv7.replace("-", "");
    let uuid = u128::from_str_radix(&*uuid, 16).unwrap();
    let ms = (uuid >> 80) as i64;

    let uuid = uuid.to_be_bytes();
    let increased_clock_precision = (((uuid[6] & 0x0fu8) as i64) << 8) | uuid[7] as i64;
    let ns = increased_clock_precision * SUBMS_MINIMAL_STEP_NS;

    (ms, ns)
}
```

[jyuch/pg-uuidv7-to-timestamp](https://github.com/jyuch/pg-uuidv7-to-timestamp)

# PostgreSQL 18 でのUUIDv7生成例

最後に実際に`uuidv7()`関数を使ってUUIDv7を生成して、単調増加しているかを確認してみましょう。

以下のようなテーブルを作成したうえで、

```sql
create table uuidv7_test_table
(
    i     int,
    clock timestamp,
    value uuid
);
```

以下のクエリで全力でUUIDv7を生成します。

```sql
begin transaction;
do
$do$
  begin
    for i in 1..1000000
      loop
        insert into uuidv7_test_table(i, clock, value) 
        values (i, clock_timestamp(), uuidv7());
      end loop;
    end
$do$;
end;
```

すると、以下のような結果となります。
上記の`uuidv7_to_timestamp()`の結果を併記しています。

```sql
select i, value, uuid_extract_timestamp(value), clock
from uuidv7_test_table
order by value;
```

|i|value|uuid_extract_timestamp|clock|uuidv7_to_timestamp|
|:-|:-|:-|:-|:-|
|1|0199d67d-81a7-713d-aed5-6bbd22a476c2|2025-10-12 03:36:13.479000 +00:00|2025-10-12 03:36:13.479071|2025-10-12 03:36:13.479 UTC 77665|
|2|0199d67d-81a7-7be4-ba18-b1d95ac5835f|2025-10-12 03:36:13.479000 +00:00|2025-10-12 03:36:13.479741|2025-10-12 03:36:13.479 UTC 745780|
|3|0199d67d-81a7-7c31-9ca1-df81b59c2e69|2025-10-12 03:36:13.479000 +00:00|2025-10-12 03:36:13.479762|2025-10-12 03:36:13.479 UTC 764645|
|4|0199d67d-81a7-7c45-b183-8ebf38326e24|2025-10-12 03:36:13.479000 +00:00|2025-10-12 03:36:13.479766|2025-10-12 03:36:13.479 UTC 769545|
|5|0199d67d-81a7-7c55-893a-c1685851f5f7|2025-10-12 03:36:13.479000 +00:00|2025-10-12 03:36:13.479770|2025-10-12 03:36:13.479 UTC 773465|

`uuid_extract_timestamp`関数がミリ秒までの精度しか返していませんが、仕様上はミリ秒精度があれば良いとされていることと、外部で生成されたUUIDv7でも対応できるようにこのようになっています。

おわり
