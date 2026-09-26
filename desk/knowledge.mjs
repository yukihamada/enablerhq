// Reviewed public facts only. No generated claims, private documents or visitor history.
export const checkedAt = '2026-09-26';
export const topics = [
  {
    id: 'terms', match: /調達|出資|投資|株|企業価値|バリュエーション|リターン|配当|募集|valuation|invest|equity|fundrais|financing|dividend|return|shares|round|cap table/i,
    title: { ja: '出資・調達条件', en: 'Investment and financing terms' },
    text: { ja: '調達額・企業価値・投資手段・時期は未決定です。このページは事業説明の検討案で、株式の申込受付ではありません。個別条件は濱田優貴への面談でご相談ください。', en: 'Target raise, valuation, financing instrument and timeline have not been set. This page is a discussion draft, not a subscription offer. Please discuss individual terms directly with Yuki Hamada.' },
    source: '/investors/#contact', handoff: true,
  },
  {
    id: 'financials', match: /売上|利益|粗利|顧客数|利用者数|ユーザー数|継続率|成長率|資金繰り|原価|黒字|赤字|ランウェイ|revenue|profit|margin|customer count|user count|retention|growth rate|runway|mrr|arr|traction/i,
    title: { ja: '財務・利用実績', en: 'Financial and usage performance' },
    text: { ja: 'このページには財務実績や利用者数・継続率を掲載していません。プロダクトが公開されていることと、収益・成長の実績は別です。確認したい指標・対象期間を添えて、代表にお問い合わせください。', en: 'Financial results, user counts and retention metrics are not presented on this page. Product availability is separate from evidence of revenue or growth. Contact the founder with the metric and reporting period you need.' },
    source: '/investors/#contact', handoff: true,
  },
  {
    id: 'cp', match: /\bcp\b|貢献|ポイント|灰|ash|トークン|token|contribution/i,
    title: { ja: '貢献ポイントと出資', en: 'Contribution points and investment' },
    text: { ja: '貢献ポイント（CP）と出資は別制度です。CPは現金・株式へ交換できず、株式を取得する権利も付与しません。', en: 'Contribution points (CP) and investment are separate. CP cannot be exchanged for cash or shares and do not grant rights to equity.' },
    source: '/investors/#contact',
  },
  {
    id: 'sente', match: /sente|先手|メール|要約|コード|仕事|作業|料金|価格|月額|pricing|price|cost|email|summari|coding|task|work/i,
    title: { ja: 'Sente — 仕事の入口', en: 'Sente — a workspace for AI' },
    text: { ja: 'Senteはメール下書き・資料要約・コード修正などに使うAIの作業環境です。ブラウザでの文章作業や、ターミナルでのローカルファイル操作に対応。確認時点のSente Proは月額1,480円、毎月25,000クレジット付きで、使い放題ではありません。最新の料金と条件は出典をご確認ください。', en: 'Sente is an AI workspace for drafting emails, summarizing documents and working on code, through the browser or terminal. At the review date, Sente Pro was ¥1,480/month with 25,000 credits per month, not unlimited usage. Check the source for current pricing and terms.' },
    source: 'https://teai.io/sente',
  },
  {
    id: 'teai', match: /teai|api|モデル|基盤|請求|byok|model|gateway|billing|infrastructure/i,
    title: { ja: 'teai — モデル接続の基盤', en: 'teai — model access infrastructure' },
    text: { ja: 'teaiは複数のAIモデルを共通APIで利用し、利用量・請求を管理するサービスです。OpenAI互換・Anthropic Messages API互換の接続口とBYOKを提供。課金はモデル・入出力量などで変わります。詳細な接続方法と条件は公開ドキュメントをご覧ください。', en: 'teai provides a common API for multiple AI models, with usage and billing management. It offers OpenAI-compatible and Anthropic Messages-compatible interfaces and BYOK. Charges depend on the model and usage. See the public documentation for integration details and terms.' },
    source: 'https://teai.io/docs',
  },
  {
    id: 'company', match: /イネブラ|enabler|会社|代表|経歴|濱田|創業|company|founder|hamada|mercari|メルカリ|not a hotel/i,
    title: { ja: '会社・代表', en: 'Company and founder' },
    text: { ja: '事業主体は株式会社イネブラ（Enabler Inc.）、代表取締役CEOは濱田優貴です。元メルカリ取締役CPO、NOT A HOTEL共同創業者。ソフトウェア・ハードウェアの開発・運営、AIプロダクトのコンサルティング・技術提供を行っています。', en: 'Enabler Inc. is led by founder and CEO Yuki Hamada, former Director and CPO at Mercari and co-founder of NOT A HOTEL. The company develops and operates software and hardware and provides AI consulting and technology.' },
    source: 'https://enablerhq.com/#company',
  },
  {
    id: 'plan', match: /使い道|資金活用|計画|今後|戦略|差別化|強み|why|plan|strategy|moat|priorit|use of funds|different/i,
    title: { ja: '次の検証と資金活用案', en: 'Proposed priorities' },
    text: { ja: 'この案ではSente・teaiを中心に、実仕事の完了、継続利用、推論原価を含めた採算を次の検証軸にしています。資金活用は実行の安定性・導入支援・採算検証を検討中で、配分や成果を確約するものではありません。', en: 'This draft focuses on Sente and teai, with completed tasks, repeat use and economics including inference costs as validation priorities. Reliability, onboarding and economic validation are proposed uses of resources; allocations and outcomes are not committed.' },
    source: '/investors/#next',
  },
  {
    id: 'contact', match: /面談|相談|連絡|会いたい|日程|協業|提携|meeting|contact|partnership|appointment|schedule/i,
    title: { ja: '代表への相談', en: 'Contact the founder' },
    text: { ja: '関心領域と希望時期を添えて mail@yukihamada.jp へご相談ください。下の「この質問を代表に相談する」でメールの下書きを開けます。送信はご自身で行うため、この窓口で面談予約や条件合意は確定しません。', en: 'Email mail@yukihamada.jp with your area of interest and preferred timing. “Ask the founder about this” opens an email draft for you to send. This desk does not confirm appointments or agree terms.' },
    source: 'https://enablerhq.com/#contact', handoff: true,
  },
];

export function answerQuestion(question, language = 'ja') {
  const lang = language === 'en' ? 'en' : 'ja';
  const matches = topics.filter(topic => topic.match.test(question));
  const results = matches.slice(0, 3).map(topic => ({ id: topic.id, title: topic.title[lang], text: topic.text[lang], source: topic.source }));
  return {
    mode: 'reviewed-faq', checkedAt, results,
    handoff: !results.length || matches.some(topic => topic.handoff),
    note: results.length
      ? (lang === 'ja' ? '質問に関連する確認済みの案内です。個別の推測や条件合意は行いません。' : 'Reviewed information related to your question. No individual claims or terms are inferred.')
      : (lang === 'ja' ? 'この質問に答えられる確認済み情報がありません。下のメールで代表にご相談ください。' : 'No reviewed answer is available for this question. Please contact the founder using the email link below.'),
  };
}
