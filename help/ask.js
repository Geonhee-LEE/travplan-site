// 질문으로 찾기. scripts/build_help.py가 docs/help/ask.js로 복사한다(claude.ai 게시본도 같은 파일을 쓴다).
// 색인은 scripts/build_search_index.py가 만드는 docs/assets/search_index.json이다(조각마다 k 종류, d 문서, t 절 제목, c 카드 이름(있을 때), u 주소, x 글자).
// 검색은 그 스크립트의 Search와 같은 식이다: 질문의 의문사·어미·영문 기능어를 빼고, 한글은 낱말 안 두 글자 묶음, 영문·숫자는 낱말, 제목·카드 이름 4배,
// BM25(k1 1.2, b 0.75) × 질문 낱말을 덮은 비율의 제곱 × 도움말 1.5. 한쪽을 바꾸면 다른 쪽도 바꾼다.
(() => {
  const K1 = 1.2, B = 0.75, TITLE_W = 4, HELP_W = 1.5;
  const WORD = /[0-9a-z가-힣]+/g, HANGUL = /[가-힣]/;
  const SENT = /(?<=[.?!다])\s+(?=\S)/;
  // 질문에만 쓰는 낱말과 어미. 질문 쪽에서만 빼거나 자른다(build_search_index.py의 STOP·SUFFIX와 같다).
  const STOP = new Set(['어디', '어디서', '어디에', '어떻게', '무엇', '무엇을', '무엇이', '뭐', '뭔가', '왜', '언제', '누가', '어느', '얼마나',
    '있나요', '하나요', '되나요', '인가요', '알려', '주세요', '궁금', '방법', '법',
    'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'as', 'by', 'via', 'with', 'from', 'using', 'the', 'an', 'is', 'are']);
  const SUFFIX = ['하나요', '되나요', '있나요', '인가요', '나요', '까요', '는지', '는가', '은가', '어요', '에요', '해요'];
  const wordTokens = (w) => HANGUL.test(w)
    ? Array.from({ length: Math.max(0, w.length - 1) }, (_, i) => w.slice(i, i + 2))
    : (w.length > 1 || /^\d+$/.test(w) ? [w] : []);
  const words = (s) => s.toLowerCase().match(WORD) || [];
  const tokens = (s) => words(s).flatMap(wordTokens);
  const queryWords = (q) => words(q).filter((w) => !STOP.has(w)).map((w) => {
    const suf = HANGUL.test(w) && SUFFIX.find((x) => w.endsWith(x) && w.length > x.length);
    return suf ? w.slice(0, -suf.length) : w;
  });
  const count = (ts, w = 1, m = new Map()) => { for (const t of ts) m.set(t, (m.get(t) || 0) + w); return m; };

  class Index {
    constructor(items) {
      this.items = items;
      this.tf = items.map((it) => count(tokens(it.t + ' ' + (it.c || '')), TITLE_W, count(tokens(it.x))));
      this.len = this.tf.map((c) => { let n = 0; for (const v of c.values()) n += v; return n; });
      this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(1, this.len.length);
      const df = new Map();
      for (const c of this.tf) for (const t of c.keys()) df.set(t, (df.get(t) || 0) + 1);
      const n = items.length;
      this.idf = new Map([...df].map(([t, d]) => [t, Math.log(1 + (n - d + 0.5) / (d + 0.5))]));
    }

    // 절(주소)마다 가장 높은 조각 하나만 남긴 상위 n개. {item, score}
    search(q, n = 5) {
      const ws = queryWords(q).map((w) => [...new Set(wordTokens(w))]).filter((w) => w.length);
      if (!ws.length) return [];
      const qs = [...new Set(ws.flat())];
      const scored = [];
      this.tf.forEach((c, i) => {
        let s = 0;
        for (const t of qs) {
          const f = c.get(t);
          if (f) s += this.idf.get(t) * f * (K1 + 1) / (f + K1 * (1 - B + B * this.len[i] / this.avg));
        }
        if (s > 0) {
          const cover = ws.filter((w) => 2 * w.filter((t) => c.has(t)).length >= w.length).length / ws.length;
          s *= cover * cover * (this.items[i].k === 'help' ? HELP_W : 1);
        }
        if (s > 0) scored.push([s, i]);   // 질문 낱말을 하나도 덮지 못한 조각은 뺀다
      });
      scored.sort((a, b) => b[0] - a[0]);   // 안정 정렬: 동점은 색인 순서(Python과 같다)
      const seen = new Set(), out = [];
      for (const [s, i] of scored) {
        const it = this.items[i];
        if (seen.has(it.u)) continue;
        seen.add(it.u);
        out.push({ item: it, score: s });
        if (out.length === n) break;
      }
      return out;
    }
  }

  // 조각에서 질문과 가장 많이 겹치는 문장 k개를 원래 순서로.
  function sentences(x, q, k = 2) {
    const qs = new Set(queryWords(q).flatMap(wordTokens));   // 의문사·어미는 세지 않는다
    const ss = x.split(SENT);
    const sc = ss.map((s, i) => {
      const ts = new Set(tokens(s));
      let m = 0;
      for (const t of qs) m += ts.has(t);
      return [m / Math.sqrt(4 + ts.size), i];
    }).filter(([m]) => m > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, i]) => i).sort((a, b) => a - b);
    return (sc.length ? sc : [0]).map((i) => ss[i]);
  }

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 질문 낱말(한글은 끝 글자 하나를 뗀 줄기까지)을 <mark>로 감싼 HTML. 영문·숫자는 낱말 전체만(ame가 operatorname에 걸리지 않게).
  function highlight(s, q) {
    const stems = [...new Set(queryWords(q).flatMap((w) => (HANGUL.test(w) && w.length >= 3 ? [w, w.slice(0, -1)] : [w])).filter((w) => w.length >= 2))]
      .sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .map((w) => (HANGUL.test(w) ? w : '(?<![0-9a-z])' + w + '(?![0-9a-z])'));
    if (!stems.length) return esc(s);
    const re = new RegExp('(' + stems.join('|') + ')', 'gi');
    return s.split(re).map((p, i) => (i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p))).join('');
  }

  let pending = null;
  function load(url) {
    if (!pending) {
      pending = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); })
        .then((items) => new Index(items))
        .catch((e) => { pending = null; throw e; });
    }
    return pending;
  }

  // 결과 한 줄의 제목: 절 제목, 카드가 있으면 '절 › 카드'.
  const label = (it) => (it.c ? it.t + ' › ' + it.c : it.t);

  window.HelpAsk = { Index, load, sentences, highlight, esc, tokens, label };
})();
