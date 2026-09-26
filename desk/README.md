# Investor Desk — enquiries and test payments

確認済みFAQから出典付きの回答を返す窓口。生成AIへの接続はない。
未掲載の実績や個別条件は代表へのメール下書きへ案内する。
開発相談は認証後に保存し、代表だけが個別見積もりを承認・提示する。
お客様の同意→Stripeテスト決済→代表のテスト納品確認→別途同意した月額保守。
実課金・自動着手は行わない。Stripeの外部疎通は未検証。

## ローカル実行

```sh
npm ci
npm test
npm run preview:desk
```

`http://127.0.0.1:18848/investors/` を開き、`preview@example.test` で認証。
コードは画面に表示される。メール配信と外向き通信はモックに置換し、
実メール・実シークレットは使用しない。テストデータは再起動で破棄する。
デモサーバーはループバック限定。コード表示はローカルサーバーだけの処理で、
本番Workerにはコードを返すAPIを設けていない。

## 検証済み（2026-09-26）

- `npm test`: 14件成功、失敗0。
- 実workerd/SQLiteでOTP一回限り、誤入力5回、Cookie署名・ログアウト失効、
  Origin/入力サイズ/同意チェック、再送制限、Gmail別名正規化を確認。
- 異なる質問110件の同時実行で100件受理・10件429。
- 同一requestIdの同時再送12件は1回分。同じIDで異なる質問は409。
- 時計制御のクラス単体テストでOTP期限、日次リセット、メール上限、
  セッション間の回数共有、失敗コード無効化、非アクティブ記録削除を確認。
- Playwrightでja/en × 320/390/768/1440pxの8条件成功。
  認証→FAQ→未回答のメール下書き、再読込時の認証保持、応答消失後の再送、
  ログアウト、CSP、横はみ出しなし、言語切替を確認。
- ブラウザ検証スクリプトと証拠は作業ツリーの親 `T/sente/` 内:
  `verify-investor-desk.mjs` / `investor-desk-verification.json` /
  `investor-desk-{ja,en}-{390,1440}.png`。
- スクリーンショットの目視評価は未実施（実行モデルが画像入力非対応）。
- 受託API: 所有者分離、権限偽装拒否、見積もりの本人承認、二重送信防止、
  同時Checkoutの冪等性、Stripe応答の金額・metadata照合、納品前保守拒否を確認。
  Stripeはモック。通知再試行・10回失敗後の状態保持はクラス単体試験。
- `node T/sente/verify-investor-orders.mjs`: 日英×4幅の8条件成功。
  日本語3,000文字相談、応答消失後の再送、管理者の見積もり、税込総額、
  未設定テストキーの拒否、再読込・ログアウト・横はみ出しなし・JS例外0。
- Workerは `wrangler deploy --dry-run --config desk/wrangler.jsonc` 成功。

## 静的ページ公開の検証（2026-09-26）

- main反映: `b245d14afb8739c5c2dde0a5e9877d1dfd8c5a82`。
- [Fly配備](https://github.com/yukihamada/enablerhq/actions/runs/36236413928)成功。
  https://enablerhq.com/investors/ のHTML/CSS/JS計5ファイルはローカルとSHA-256一致。
  `/health`はHTTP200・本文`ok`。
- `node T/sente/verify-investor-production.mjs`: 日英×4幅の8条件成功。
  CSP、言語切替、横はみ出しなし、JS例外0、API未設定時の案内とメールリンクを確認。
- [Investor Desk検証](https://github.com/yukihamada/enablerhq/actions/runs/36236413929)は
  14テスト・dry-run成功。deploy jobはskippedであり、Worker配備の証拠ではない。
- `/api/investors/session`はHTTP200・text/html。未認証JSON 401ではなくAPIは未稼働。
  公開ページでは窓口利用不可の案内を表示。実メール・実Stripe往復は未検証。

## ペルソナレビューと改善（2026-09-26）

対象は、初めて訪れる投資・開発委託の意思決定者。以下は実ユーザー調査ではなく、
実装・文面とブラウザ検証に基づく自己評価。100点到達を示すものではない。

| 評価軸 | 得点 | 根拠・残る不足 |
| --- | --- | --- |
| 事業の明快さ | 14/15 | 対象業務・Sente/teaiの役割・収益モデルを冒頭で説明。優先顧客像はまだ広い |
| 信頼性 | 13/15 | 製品・実演・代表の出典を提示。お客様の導入成果の裏付けは未掲載 |
| 投資判断材料 | 7/20 | 確認論点と未決定条件を明示。売上・継続率・採算・調達計画は未掲載 |
| 受託条件 | 13/15 | 料金・作業枠・超過・実費・見積もり順序を明示。個別範囲と契約条件は未確定 |
| 問い合わせ導線 | 9/10 | 登録不要のメール下書き、公開FAQ。オンライン受付APIは未稼働 |
| 使いやすさ | 13/15 | 日英4幅・キーボードFAQ・JS無効時の導線を検証。目視と実利用者評価は未実施 |
| 日英表現品質 | 9/10 | タイトル・説明・メール下書き・状態表示を日英化。第三者の言語レビューは未実施 |
| 合計 | **78/100** | 財務等の原資料と開示判断、導入実績、目視・実利用者確認が必要 |

- 事業説明→製品の根拠→投資判断材料の順に再構成し、開発相談を独立した導線に変更。
- API未配備時は認証フォームと認証への誘導を隠し、メール相談へ案内。
- `npm test`14件、`verify-investor-desk.mjs`と`verify-investor-orders.mjs`各8条件成功。
- `verify-investor-production.mjs --local`8条件とoffline/503/401・JS無効の4条件成功。
  同一IDの重複なし、内部リンク、日英メール下書き、CSP、横はみ出しなし、JS例外0を確認。
- 本版の本番反映はこの記録時点では未確認。前節の配備証拠は初版のもの。
- 指定文案チェッカーはローカルに存在せず未実施。

## 受付APIを有効化するための残作業

本人の公開・保存・通知・月2,000円以内の追加インフラ・Stripe test-mode承認は取得済み。
Worker未作成、migration未適用。Cloudflareログインのみ確認済み。
公開時のGitHub Secrets一覧は`FLY_API_TOKEN`のみで、以下の5項目は未登録。

1. Cloudflareの現契約・料金とDNSのプロキシ有効を確認する。
2. GitHub Secretsに以下を登録（値をチャットやコミットへ貼らない）。
   - `CLOUDFLARE_API_TOKEN`: Worker/DO配備と対象zoneルート編集権限
   - `CLOUDFLARE_ACCOUNT_ID`
   - `INVESTOR_AUTH_SECRET`: 新規ランダム値32文字以上。変更すると既存の所有者IDも変わるため維持する。
   - `INVESTOR_RESEND_API_KEY`: `info@enablerdao.com`から送信可能なキー
   - `INVESTOR_STRIPE_TEST_SECRET_KEY`: `sk_test_`または必要権限の`rk_test_`
3. mainの`investor-desk.yml`を`deploy=true`で実行。
   Worker/SQLite DO作成→runtime secrets登録→未認証401確認。
   静的ページは既存`deploy.yml`のmain push→Fly配備。
4. 本人宛の実OTP・受付通知を確認。Stripe test checkoutとbilling portalの
   設定を確認し、開発支払→納品→保守→解約を実サービスで検証する。

`investor-desk.yml`はfeature branch pushでAPI試験とbundle検証のみ実行する。
期限切れCheckout・23時間を超えた不明な作成結果は再発行せず運営確認が必要。
保守の継続請求・解約の同期Webhookは未実装。記録のpaidは初回のテスト支払のみを示す。

メール認証は本人確認ではない。100回は正規化済みメールアドレス単位で、
別メールアドレスを使う同一人物まで識別する仕組みではない。
Workerの本番インフラ、実メール、実ユーザー負荷、画像の見た目は未検証。
