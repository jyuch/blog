// 404ページに表示するクイズの問題と、各選択肢の解説

export interface Choice {
	/** URLに使うID（/404/{id}/） */
	id: string;
	/** 選択肢の記号 */
	label: string;
	/** 選択肢の本文 */
	text: string;
	/** 対応するHTTPステータスコード */
	status: string;
	/** 解説 */
	explanation: string[];
}

export const QUESTION = '問1　Webサーバが返すHTTPのステータスコードのうち、404が示す内容として、適切なものはどれか。';

export const CORRECT_CHOICE_ID = 'i';

export const CHOICES: Choice[] = [
	{
		id: 'a',
		label: 'ア',
		text: 'アクセス権がないので、リソースへのアクセスが拒否された。',
		status: '403 Forbidden',
		explanation: [
			'403 Forbiddenの説明です。サーバはリクエストの内容を理解したものの、アクセス権がないなどの理由で処理を拒否したことを示します。',
			'似たものに401 Unauthorizedがありますが、こちらは認証が必要であるか、認証に失敗したことを示します。',
		],
	},
	{
		id: 'i',
		label: 'イ',
		text: '要求されたリソースが見つからなかった。',
		status: '404 Not Found',
		explanation: [
			'404 Not Foundの説明です。要求されたURLに対応するリソースが、サーバ上に見つからなかったことを示します。URLの入力ミスや、ページの削除・移動などで発生します。',
			'なお、リソースの存在自体を知られたくない場合に、403 Forbiddenの代わりに404 Not Foundを返すことも認められています。',
		],
	},
	{
		id: 'u',
		label: 'ウ',
		text: 'リソースが対応していないメソッドで要求が行われた。',
		status: '405 Method Not Allowed',
		explanation: [
			'405 Method Not Allowedの説明です。リソース自体は存在するものの、リクエストに使われたメソッド（GET、POSTなど）にそのリソースが対応していないことを示します。',
			'このとき、サーバはAllowヘッダで対応しているメソッドの一覧を返す必要があります。',
		],
	},
	{
		id: 'e',
		label: 'エ',
		text: 'ティーポットにコーヒーを入れるよう要求された。',
		status: '418 I\'m a teapot',
		explanation: [
			'418 I\'m a teapotの説明です。1998年のエイプリルフールに公開されたジョークRFCであるRFC 2324（HTCPCP: Hyper Text Coffee Pot Control Protocol）で定義されたもので、ティーポットにコーヒーを入れさせようとしたときに返されます。',
			'現在のHTTPの仕様（RFC 9110）では、418は使われていない番号として予約されています。',
		],
	},
];
