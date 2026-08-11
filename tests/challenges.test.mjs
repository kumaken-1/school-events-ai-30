import assert from "node:assert/strict";
import test from "node:test";

import { CATEGORIES, challenges } from "../js/challenges.js";
import { BLANK_MARKER, HELP_TEXTS, SEND_TYPES } from "../js/view-model.js";

const EXPECTED_CATEGORY_COUNTS = {
  start: 6,
  decide: 6,
  participate: 6,
  rethink: 6,
  reflect: 6,
};

const countBlanks = (text) => String(text).split(BLANK_MARKER).length - 1;
const stepText = (item) => item.send.steps.map(({ text }) => text).join("\n");

test("30件が1から30まで重複なく並ぶ", () => {
  assert.equal(challenges.length, 30);
  assert.deepEqual(challenges.map(({ id }) => id), [...Array(30)].map((_, i) => i + 1));
  const titles = challenges.map(({ title }) => title);
  assert.equal(new Set(titles).size, 30, "題名が重複している");
});

test("カテゴリーは5つの群で、各6件", () => {
  assert.deepEqual(CATEGORIES.map(({ id }) => id), Object.keys(EXPECTED_CATEGORY_COUNTS));
  assert.ok(CATEGORIES.every(({ name }) => name.length > 0));
  const counts = {};
  for (const item of challenges) counts[item.category] = (counts[item.category] ?? 0) + 1;
  assert.deepEqual(counts, EXPECTED_CATEGORY_COUNTS);
});

test("表示に必要なデータがそろっている", () => {
  const keys = ["id", "category", "title", "intro", "send", "reply", "followUp"];
  for (const item of challenges) {
    // deepen（3回目）は任意。持つ回だけ増える。
    const expected = item.deepen ? [...keys, "deepen"] : keys;
    assert.deepEqual(Object.keys(item).sort(), [...expected].sort(), `id ${item.id}`);
    assert.ok(item.title.length >= 6, `id ${item.id} の題名が短すぎる`);
    assert.ok(item.intro.length >= 40, `id ${item.id} の紹介文が短すぎる`);
    const sendKeys = item.send.type === "fill"
      ? ["hint", "prompt", "steps", "type"]
      : ["prompt", "steps", "type"];
    assert.deepEqual(Object.keys(item.send).sort(), sendKeys, `id ${item.id}`);
    assert.ok(SEND_TYPES[item.send.type], `id ${item.id} の送り方が不正`);
    assert.ok(item.send.prompt.length > 0);
    assert.ok(item.send.steps.length >= 2, `id ${item.id} の手順が少なすぎる`);
    assert.deepEqual(Object.keys(item.followUp).sort(), ["hints", "template"], `id ${item.id}`);
  }
});

test("題名は場面の説明で、命令形を使わない", () => {
  for (const item of challenges) {
    assert.doesNotMatch(item.title, /せよ$|え$|よ$/, `id ${item.id}: ${item.title}`);
  }
});

test("紹介文は2文以上で、読み手の場面から入る", () => {
  for (const item of challenges) {
    assert.ok(item.intro.includes("\n"), `id ${item.id} の紹介文が1行しかない`);
  }
});

// 空欄をうめて送る回では、送る文の空欄が自分の見立ての置き場所になる。
// 記入欄を別に立てないので、空欄に何を入れるかは例で示す。
test("空欄をうめて送る回だけ、空欄に入れる語の例を持つ", () => {
  for (const item of challenges) {
    if (item.send.type === "fill") {
      assert.ok(item.send.hint?.trim().length > 0, `id ${item.id} に例がない`);
      assert.doesNotMatch(item.send.hint, /てください。?$|。$/, `id ${item.id} の例に文末表現がある`);
    } else {
      assert.equal(item.send.hint, undefined, `id ${item.id} に不要な例がある`);
    }
  }
});

test("2通目は空欄ひとつと例3つを持ち、言い回しが偏らない", () => {
  const templates = [];
  for (const item of challenges) {
    const { template, hints } = item.followUp;
    assert.equal(countBlanks(template), 1, `id ${item.id} の空欄が1つでない`);
    assert.equal(hints.length, 3, `id ${item.id} の例が3つでない`);
    for (const hint of hints) {
      assert.ok(hint.trim().length > 0);
      assert.doesNotMatch(hint, /てください。?$|。$/, `id ${item.id} の例に文末表現がある`);
    }
    templates.push(template);
  }
  assert.equal(new Set(templates).size, 30, "2通目の文が重複している");
  const leading = templates.filter((t) => t.startsWith("私は")).length;
  assert.ok(leading <= 12, `「私は」で始まる文が多すぎる: ${leading}`);
});

test("回答を読む場面が、毎回その回のねらいとして書かれている", () => {
  const replies = challenges.map(({ reply }) => reply);
  for (const [index, reply] of replies.entries()) {
    assert.match(reply, /^回答が来ます/, `id ${index + 1}`);
    assert.ok(reply.length >= 20, `id ${index + 1} の一行が短すぎる`);
  }
  assert.equal(new Set(replies).size, 30, "回答の一行が使い回されている");
});

test("手順は送信の回数と、同じメッセージであることを明示する", () => {
  for (const item of challenges) {
    const text = stepText(item);
    assert.match(text, /送信|送りま/, `id ${item.id} に送信の手順がない`);
    // 空欄をうめて送る回は資料も自分の文も足さないため、まとめて送る注意は要らない。
    if (item.send.type === "paste" || item.send.type === "attach") {
      assert.match(
        text,
        /同じメッセージ|同じ入力欄|まとめて/,
        `id ${item.id} で添付・貼り付けと文章が同じ送信だと分からない`,
      );
      assert.match(text, /1回/, `id ${item.id} に送信が1回だと書かれていない`);
    }
  }
});

// 空欄をうめて送る回では、その空欄が「送る前の自分の考え」の置き場所になる。
// 2か所に分けると同じことを2回書かせることになるため、ちょうど1個に限る。
test("空欄をうめて送る回だけ、1回目の文に空欄がちょうど1つある", () => {
  for (const item of challenges) {
    const blanks = countBlanks(item.send.prompt);
    if (item.send.type === "fill") {
      assert.equal(blanks, 1, `id ${item.id} の1回目の空欄が1つでない`);
    } else {
      assert.equal(blanks, 0, `id ${item.id} の1回目に空欄がある`);
    }
  }
});

test("補足は共通の4本だけを参照し、1件につき2個までにする", () => {
  const allowed = Object.keys(HELP_TEXTS);
  assert.deepEqual(allowed.sort(), ["attach", "newmsg", "once", "paste"]);
  for (const item of challenges) {
    const used = item.send.steps.filter(({ help }) => help).map(({ help }) => help);
    assert.ok(used.length <= 2, `id ${item.id} の補足が多すぎる: ${used.length}`);
    for (const help of used) {
      assert.ok(allowed.includes(help), `id ${item.id} に未知の補足 ${help}`);
    }
  }
});

// 全30回が、自分の学校の記録・一覧・場面を材料にする。
// 自分の材料が入らない回は、学年も学校も設定されない一般論になる。
test("送り方の配分がかたよらない", () => {
  const counts = {};
  for (const item of challenges) counts[item.send.type] = (counts[item.send.type] ?? 0) + 1;
  assert.ok((counts.asis ?? 0) <= 2, `そのままコピーが多すぎる: ${counts.asis ?? 0}`);
  assert.ok(counts.fill >= 14, `空欄をうめて送る回が ${counts.fill} 件`);
  assert.ok(counts.paste >= 5, `貼り付けが ${counts.paste} 件`);
  // 資料を用意する手間で止まる人が出るため、添付は少なめに保つ。
  assert.ok(counts.attach >= 2 && counts.attach <= 6, `添付が ${counts.attach} 件`);
});

test("資料を渡す回は、子どもが分かる情報を外す手順を含む", () => {
  for (const item of challenges.filter((c) => c.send.type === "attach" || c.send.type === "paste")) {
    const text = stepText(item);
    assert.match(
      text,
      /名前|個人|置き換え|外し/,
      `id ${item.id} に、個人が分かる情報を外す手順がない`,
    );
  }
});

// 好きな回から始められるようにするため、回どうしを番号で参照しない。
test("ゲーム由来の語と、回どうしの参照を残さない", () => {
  const source = challenges.flatMap((item) => [
    item.title,
    item.intro,
    item.reply,
    item.send.prompt,
    item.send.hint ?? "",
    item.followUp.template,
    ...item.followUp.hints,
    ...item.send.steps.map(({ text }) => text),
  ]).join("\n");
  for (const word of ["クエスト", "ポイント", "称号", "レベル", "クリア", "７つの力", "7つの力"]) {
    assert.ok(!source.includes(word), `ゲーム由来の語が残っている: ${word}`);
  }
  assert.doesNotMatch(source, /第\s*\d+\s*回/, "回どうしを番号で参照している");
  assert.doesNotMatch(source, /チャレンジ\s*\d+/, "旧版の呼び方が残っている");
});

test("入力例に個人情報を求めない", () => {
  const source = challenges.flatMap((item) => [
    item.send.prompt,
    item.send.hint ?? "",
    item.followUp.template,
    ...item.followUp.hints,
  ]).join("\n");
  for (const forbidden of ["児童名", "保護者名", "職員名", "実名", "成績を", "健康情報", "顔写真"]) {
    assert.ok(!source.includes(forbidden), `個人情報の語が含まれる: ${forbidden}`);
  }
});

// AIに指導要領や理論を尋ねると、存在しない記述を作る。
// 入力は教師が持っている材料に限り、AIに求めるのは視点・反論・整理だけにする。
test("AIに外部の知識を尋ねる回がない", () => {
  for (const item of challenges) {
    const source = `${item.send.prompt}\n${item.followUp.template}`;
    for (const word of ["学習指導要領", "文部科学省", "解説書", "先行研究", "教育学"]) {
      assert.ok(!source.includes(word), `id ${item.id} が外部の知識を尋ねている: ${word}`);
    }
  }
});

// この巻の対象は「授業の外の学校生活」。発問や授業展開はⅢ・Ⅳの担当なので、
// 授業技術そのものに寄った回を持ち込まない。
test("授業展開・発問そのものを扱う回がない", () => {
  const forbidden = ["発問の仕方", "板書計画", "指導案", "授業展開"];
  for (const item of challenges) {
    const source = `${item.title}\n${item.intro}\n${item.send.prompt}`;
    for (const word of forbidden) {
      assert.ok(!source.includes(word), `id ${item.id} が授業技術そのものを扱っている: ${word}`);
    }
  }
});

// 願望形（〜したい）は、すでにその状態を望んでいる人の声で、
// 「あ、これ困ってる」で入る読者の言葉ではない。
test("題名が願望形になっていない", () => {
  for (const item of challenges) {
    assert.doesNotMatch(item.title, /したい$|たい$/, `id ${item.id} の題名が願望形: ${item.title}`);
  }
});

// implementation_rules: 「主体性」「自治」「合意形成」「参画」などの教育用語を
// カードタイトルの前面に出さない。
test("教育用語がタイトルの前面に出ていない", () => {
  const forbidden = ["主体性", "自治", "合意形成", "参画", "意思決定"];
  for (const item of challenges) {
    for (const word of forbidden) {
      assert.ok(!item.title.includes(word), `id ${item.id} のタイトルに教育用語が出ている: ${word}`);
    }
  }
});

// 仕様の禁じ手: 子どもの内面・性格をAIに断定させない。
test("子どもの性格や内面を断定させる求め方がない", () => {
  const forbidden = ["性格を判定", "内面を分析", "診断してください", "家庭環境を推測"];
  for (const item of challenges) {
    const source = `${item.send.prompt}\n${item.followUp.template}${item.deepen ? `\n${item.deepen.template}` : ""}`;
    for (const word of forbidden) {
      assert.ok(!source.includes(word), `id ${item.id} が性格・内面の断定をAIに求めている: ${word}`);
    }
  }
});

// 仕様の禁じ手: 生成AIは答えを決める役ではない。AIに最終決定・優劣の評価をさせない。
test("AIに最終決定や優劣の評価をさせる求め方がない", () => {
  const forbidden = ["結論を出してください", "正しいか判定してください", "順位をつけてください", "評価してください", "採点してください"];
  for (const item of challenges) {
    const source = `${item.send.prompt}\n${item.followUp.template}${item.deepen ? `\n${item.deepen.template}` : ""}`;
    for (const word of forbidden) {
      assert.ok(!source.includes(word), `id ${item.id} がAIに最終決定・評価を求めている: ${word}`);
    }
  }
});

// 仕様の禁じ手: 少数意見は多数決や完成度で消してよいものではない。
test("少数意見を無視・禁止する言い回しがない", () => {
  const forbidden = ["少数意見は無視", "反対意見を禁止", "多数決がすべて", "少数派を説得"];
  for (const item of challenges) {
    const source = `${item.send.prompt}\n${item.followUp.template}`;
    for (const word of forbidden) {
      assert.ok(!source.includes(word), `id ${item.id} が少数意見を消す言い回しを持っている: ${word}`);
    }
  }
});

// 群C（みんな、どう参加する？）は、発言・代表・司会・完成物の出来だけで
// 参加を判断しない視点を持つ核。子ども自身の関わり方に触れていなければならない。
test("参加の群は、子ども自身の関わり方を扱っている", () => {
  const participationWords = /子ども|役割|参加|関わ|任せ/;
  for (const item of challenges.filter((c) => c.category === "participate")) {
    assert.match(
      `${item.title}\n${item.intro}\n${item.send.prompt}`,
      participationWords,
      `id ${item.id} が子どもの参加のお題になっていない`,
    );
  }
});

// 仕様の禁じ手: 行事の成功と、子どもの学びを同一視しない。
// 群D（この行事、本当にこれでいい？）は、完成度や評判だけでなく
// 子ども側の視点（学び・経験・変化・考え）に触れていなければならない。
test("行事を問い直す群は、完成度だけでなく子ども側の視点を扱っている", () => {
  const childPerspective = /子ども|学び|経験|変化|考え/;
  for (const item of challenges.filter((c) => c.category === "rethink")) {
    assert.match(
      `${item.title}\n${item.intro}\n${item.send.prompt}`,
      childPerspective,
      `id ${item.id} が完成度・評判だけで完結している`,
    );
  }
});

// 3回目は任意。持つ回だけを、2回目と同じ形で検査する。
// 決めたことをAIに試させる回なので、AIに判断を委ねる言い回しが混ざっていないかも見る。
test("3回目を持つ回は、2回目と同じ形でそろっている", () => {
  const withDeepen = challenges.filter((item) => item.deepen);
  assert.ok(withDeepen.length >= 1, "3回目を持つ回がない");
  assert.ok(withDeepen.length <= 10, `3回目が多すぎる: ${withDeepen.length}`);
  const templates = [];
  for (const item of withDeepen) {
    assert.deepEqual(
      Object.keys(item.deepen).sort(),
      ["hints", "reply", "template"],
      `id ${item.id} の3回目の項目`,
    );
    assert.equal(countBlanks(item.deepen.template), 1, `id ${item.id} の3回目の空欄が1つでない`);
    assert.equal(item.deepen.hints.length, 3, `id ${item.id} の3回目の例が3つでない`);
    for (const hint of item.deepen.hints) {
      assert.doesNotMatch(hint, /てください。?$|。$/, `id ${item.id} の3回目の例に文末表現がある`);
    }
    assert.match(item.deepen.reply, /^回答が来ます/, `id ${item.id} の3回目の前の一行`);
    templates.push(item.deepen.template);
  }
  assert.equal(new Set(templates).size, withDeepen.length, "3回目の文が重複している");
});

// 3回目は「決めるのは人、試すのがAI」。AIに背中を押させると吟味にならない。
test("3回目は、AIに判断させず反証だけを求める", () => {
  for (const item of challenges.filter((c) => c.deepen)) {
    assert.match(
      item.deepen.template,
      /ことにしました|にします|ことにします/,
      `id ${item.id} の3回目で、自分が決めたことを言っていない`,
    );
    assert.match(
      item.deepen.template,
      /しないでください|書かないでください/,
      `id ${item.id} の3回目に、AIを止める禁止がない`,
    );
  }
});

// implementation_rules: 最後は大改革案ではなく「次に一つだけ変えるなら」に着地する。
test("巻の締めくくり（id30）は、一つだけ変える着地になっている", () => {
  const last = challenges.find((item) => item.id === 30);
  assert.ok(last.deepen, "id 30 に3回目がない");
  assert.match(last.deepen.template, /一つだけ/, "id 30 の3回目が一つだけ変える形になっていない");
});

// 改善する一点が絞られていること。1回に複数の課題を詰め込まない。
test("1回で扱う判断が絞られている", () => {
  for (const item of challenges) {
    const asks = (item.send.prompt.match(/ください/g) ?? []).length;
    assert.ok(asks <= 4, `id ${item.id} でAIに頼んでいることが多すぎる: ${asks}`);
  }
});
