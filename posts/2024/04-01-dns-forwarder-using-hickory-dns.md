---
title: RustでもHickory DNSを使ってDNS Forwarderを実装したい
description: RustからHickory DNSを使用してDNS Forwarderを実装する方法を確認します
date: 2024-04-01
lastModified: 2024-06-03
tags: 
  - rust
  - dns
---

# はじめに

DNSは春の季語なので、[Hickory DNS](https://github.com/hickory-dns/hickory-dns)を使用してDNS Forwarderを実装する方法を確認してみました。

とにかくドキュメントの整備が追い付いていないので、困ったらソースコードを読みましょう。これがオープンソースの強みですね（）


# とりあえず適当な値を返す

Hickory DNSでのサーバ実装は`hickory_server`クレートで実装されています。

`hickory_server`でのアクセスの受付は`ServerFuture`に実装されています。
`ServerFuture::new`で`RequestHandler`トレイトを受け取るので、このトレイトを実装すればとりあえずなんらかの値は返せそうです。

と思って[docs.rsで当該トレイトのドキュメント](https://docs.rs/hickory-server/latest/hickory_server/server/trait.RequestHandler.html)を見ると、面妖なシグネチャが現れます。

```rust
pub trait RequestHandler: Send + Sync + Unpin + 'static {
    // Required method
    fn handle_request<'life0, 'life1, 'async_trait, R>(
        &'life0 self,
        request: &'life1 Request,
        response_handle: R
    ) -> Pin<Box<dyn Future<Output = ResponseInfo> + Send + 'async_trait>>
       where R: 'async_trait + ResponseHandler,
             Self: 'async_trait,
             'life0: 'async_trait,
             'life1: 'async_trait;
}
```

まぁ、この手のシグネチャは大体`#[async_trait::async_trait]`で生成されているパターンが多いので、落ち着いて実装を覗いてみると以下の感じになってます。

```rust
/// Trait for handling incoming requests, and providing a message response.
#[async_trait::async_trait]
pub trait RequestHandler: Send + Sync + Unpin + 'static {
    /// Determines what needs to happen given the type of request, i.e. Query or Update.
    ///
    /// # Arguments
    ///
    /// * `request` - the requested action to perform.
    /// * `response_handle` - handle to which a return message should be sent
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        response_handle: R,
    ) -> ResponseInfo;
}
```

`hickory_server`では`Catalog`がデフォルトの実装なので、そのコードを参考に決め打ちのIPを返すように実装します。

```rust
struct StubRequestHandler {}

impl StubRequestHandler {
    pub fn new() -> Self {
        StubRequestHandler {}
    }
}

#[async_trait::async_trait]
impl RequestHandler for StubRequestHandler {
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        mut response_handle: R,
    ) -> ResponseInfo {
        let result = match request.message_type() {
            MessageType::Query => match request.op_code() {
                OpCode::Query => {
                    let a = A::new(203, 0, 113, 1);
                    let rd = RData::A(a);
                    let r =
                        Record::from_rdata(request.query().name().into_name().unwrap(), 3600, rd);
                    let response = MessageResponseBuilder::from_message_request(request);
                    let response =
                        response.build(*request.header(), vec![&r], vec![], vec![], vec![]);
                    response_handle.send_response(response).await
                }
                _op => {
                    let response = MessageResponseBuilder::from_message_request(request);
                    response_handle
                        .send_response(response.error_msg(request.header(), ResponseCode::NotImp))
                        .await
                }
            },
            MessageType::Response => {
                let response = MessageResponseBuilder::from_message_request(request);
                response_handle
                    .send_response(response.error_msg(request.header(), ResponseCode::NotImp))
                    .await
            }
        };

        result.unwrap_or_else(|_e| {
            let mut header = Header::new();
            header.set_response_code(ResponseCode::ServFail);
            header.into()
        })
    }
}
```

`QUERY`にのみ反応し、それ以外は`NOTIMP`を返しています。

あとは、いい感じに`main`を実装してあげます。

```rust
#[derive(Parser, Debug)]
struct Cli {
    /// Bind address
    #[clap(long)]
    bind: SocketAddr,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let opt = Cli::parse();

    let socket = UdpSocket::bind(&opt.bind).await?;
    let handler = StubRequestHandler::new();
    let mut server = ServerFuture::new(handler);
    server.register_socket(socket);
    server.block_until_done().await?;

    Ok(())
}
```

```sh
❯ dig @192.168.2.32 www.jyuch.dev
;; Warning: query response not set

; <<>> DiG 9.18.18-0ubuntu2.1-Ubuntu <<>> @192.168.2.32 www.jyuch.dev
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 37403
;; flags: rd ad; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0
;; WARNING: recursion requested but not available

;; QUESTION SECTION:
;www.jyuch.dev.                 IN      A

;; ANSWER SECTION:
www.jyuch.dev.          3600    IN      A       203.0.113.1

;; Query time: 0 msec
;; SERVER: 192.168.2.32#53(192.168.2.32) (UDP)
;; WHEN: Sun Mar 31 19:52:46 JST 2024
;; MSG SIZE  rcvd: 47
```


# DNS Fordingする

DNSのクライアント側の実装は`hickory_client`クレートにあります。

せっかくtokioを使ってるので、上流に問い合わせるためのクライアントとして`AsyncClient`を使ってみます。

<!--
と、この記事を書いている今になって気が付いたのですが、`AsyncClient`は`Send + Sync`でした。つらい
-->

```rust
struct StubRequestHandler {
    upstream: Arc<Mutex<AsyncClient>>,
}

impl StubRequestHandler {
    pub fn new(upstream: Arc<Mutex<AsyncClient>>) -> Self {
        StubRequestHandler { upstream }
    }
}

#[async_trait::async_trait]
impl RequestHandler for StubRequestHandler {
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        response_handle: R,
    ) -> ResponseInfo {
        let result = match request.message_type() {
            MessageType::Query => match request.op_code() {
                OpCode::Query => {
                    let upstream = &mut *self.upstream.lock().await;
                    forward_to_upstream(upstream, request, response_handle).await
                }
                _op => server_not_implement(request, response_handle).await,
            },
            MessageType::Response => server_not_implement(request, response_handle).await,
        };

        result.unwrap_or_else(|_e| {
            let mut header = Header::new();
            header.set_response_code(ResponseCode::ServFail);
            header.into()
        })
    }
}

async fn forward_to_upstream<R: ResponseHandler>(
    upstream: &mut AsyncClient,
    request: &Request,
    mut response_handle: R,
) -> anyhow::Result<ResponseInfo> {
    let response = upstream
        .query(
            request.query().name().into_name().unwrap(),
            request.query().query_class(),
            request.query().query_type(),
        )
        .await?;

    let response_builder = MessageResponseBuilder::from_message_request(request);
    let response = response_builder.build(
        *request.header(),
        response.answers(),
        vec![],
        vec![],
        vec![],
    );
    let response_info = response_handle.send_response(response).await?;

    Ok(response_info)
}

async fn server_not_implement<R: ResponseHandler>(
    request: &Request,
    mut response_handle: R,
) -> anyhow::Result<ResponseInfo> {
    let response = MessageResponseBuilder::from_message_request(request);
    let response_info = response_handle
        .send_response(response.error_msg(request.header(), ResponseCode::NotImp))
        .await?;

    Ok(response_info)
}
```

あとはいい感じに`AsyncClient`を構築して`StubRequestHandler`に渡してあげればOKです。

```rust
#[derive(Parser, Debug)]
struct Cli {
    /// Bind address
    #[clap(long)]
    bind: SocketAddr,

    /// Upstream address
    #[clap(long)]
    upstream: SocketAddr,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let opt = Cli::parse();

    let conn = UdpClientStream::<UdpSocket>::new(opt.upstream);
    let (upstream, background) = AsyncClient::connect(conn).await?;
    let _handle = tokio::spawn(background);
    let handler = StubRequestHandler::new(Arc::new(Mutex::new(upstream)));

    let socket = UdpSocket::bind(&opt.bind).await?;
    let mut server = ServerFuture::new(handler);
    server.register_socket(socket);
    server.block_until_done().await?;

    Ok(())
}
```

```sh
❯ dig @192.168.2.32 www.jyuch.dev
;; Warning: query response not set

; <<>> DiG 9.18.18-0ubuntu2.1-Ubuntu <<>> @192.168.2.32 www.jyuch.dev
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 7791
;; flags: rd ad; QUERY: 1, ANSWER: 5, AUTHORITY: 0, ADDITIONAL: 0
;; WARNING: recursion requested but not available

;; QUESTION SECTION:
;www.jyuch.dev.                 IN      A

;; ANSWER SECTION:
www.jyuch.dev.          300     IN      CNAME   jyuch.github.io.
jyuch.github.io.        3600    IN      A       185.199.111.153
jyuch.github.io.        3600    IN      A       185.199.109.153
jyuch.github.io.        3600    IN      A       185.199.108.153
jyuch.github.io.        3600    IN      A       185.199.110.153

;; Query time: 28 msec
;; SERVER: 192.168.2.32#53(192.168.2.32) (UDP)
;; WHEN: Sun Mar 31 20:31:41 JST 2024
;; MSG SIZE  rcvd: 124
```

# 追記その１

リクエストヘッダをそのままレスポンスヘッダとして打ち返していましたが、そうするとsystemd-resolvedが受け取り拒否します。
Windowsはあんまり気にしていないみたいですけど。

正しくは以下の感じですね。

```rust
let response_header = Header::response_from_request(request.header());
let response_builder = MessageResponseBuilder::from_message_request(request);
let response = response_builder.build(
    response_header,
    dns_response.as_ref().map(|it| it.answers()).unwrap_or(&[]),
    &[],
    &[],
    &[],
```

digの結果の一行目に警告が載ってましたね・・・

```text
;; Warning: query response not set
```

# 追記その２

単純に`Header::response_from_request`するとレスポンスヘッダに再起フラグが立たないので、上位DNSからのレスポンスヘッダに再起フラグが立っていたら立ててあげる必要があるようです。

```rust
let mut response_header = Header::response_from_request(request.header());
response_header.set_recursion_available(response.recursion_available());
```

でないとこんな警告がでます。というか出てましたね。ちゃんと読めよ

```text
;; WARNING: recursion requested but not available
```

おわり
