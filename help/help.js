// 도움말 공용 스크립트. scripts/build_help.py가 docs/help/help.js로 복사한다.
// 주제 페이지: 이 주제에서 찾기(절 단위, rows 절은 표의 행까지), 명령 복사 단추, 목차의 지금 절 표시.
// 첫 페이지: 모든 주제에서 찾기(window.HELP_INDEX), 옛 주소(help/#fix)를 그 절이 있는 주제 페이지로 보낸다.
// JS가 없으면 찾기 칸만 숨은 채로 두고 본문은 그대로 보인다.
(() => {
  const hub = document.body.dataset.page === 'hub';
  const box = document.getElementById('searchbox'), q = document.getElementById('q');
  const info = document.getElementById('qinfo');
  const low = (s) => s.toLowerCase();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const params = new URLSearchParams(location.search);
  box.hidden = false;
  const cur = document.querySelector('.topics [aria-current]');
  if (cur) cur.parentElement.scrollLeft = cur.offsetLeft - cur.parentElement.offsetLeft - 16;   // 폰에서 한 줄로 민 주제 칩 중 지금 주제를 보인다

  if (hub) {
    const index = window.HELP_INDEX || [];
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && !document.getElementById(hash)) {
      const hit = index.find((s) => s.id === hash);
      if (hit) { location.replace(hit.p + '#' + hit.id); return; }
    }
    const results = document.getElementById('results'), cards = document.getElementById('cards');
    const texts = index.map((s) => low(s.h + ' ' + s.x));
    const snippet = (x, v) => {
      const i = low(x).indexOf(v);
      if (i < 0) return esc(x.slice(0, 140)) + (x.length > 140 ? ' …' : '');
      const a = Math.max(0, i - 60), b = Math.min(x.length, i + v.length + 80);
      return (a > 0 ? '… ' : '') + esc(x.slice(a, i)) + '<mark>' + esc(x.slice(i, i + v.length)) + '</mark>' + esc(x.slice(i + v.length, b)) + (b < x.length ? ' …' : '');
    };
    const run = () => {
      const raw = q.value.trim(), v = low(raw);
      if (!v) { results.hidden = true; cards.hidden = false; info.textContent = ''; return; }
      const hits = index.filter((_, i) => texts[i].includes(v));
      results.innerHTML = hits.slice(0, 40).map((s) =>
        `<li><small>${esc(s.t)} · ${s.n}절</small><a href="${s.p}?q=${encodeURIComponent(raw)}#${s.id}">${esc(s.h)}</a><p>${snippet(s.x, v)}</p></li>`).join('')
        || '<li>찾는 말이 도움말에 없다. 다른 말로 찾아본다.</li>';
      results.hidden = false; cards.hidden = true;
      info.textContent = hits.length ? `· ${hits.length}개 절` : '· 없음';
    };
    q.addEventListener('input', run);
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; run(); q.blur(); } });
    if (params.get('q')) { q.value = params.get('q'); run(); }
  } else {
    const empty = document.getElementById('qempty'), all = document.getElementById('qall');
    const secs = [...document.querySelectorAll('main > section')];
    const links = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.hash.slice(1), a]));
    const texts = secs.map((s) => low(s.textContent));
    const rows = secs.map((s) => s.classList.contains('rows') ? [...s.querySelectorAll('tbody tr')].map((r) => [r, low(r.textContent)]) : null);
    const run = () => {
      const raw = q.value.trim(), v = low(raw);
      let n = 0;
      secs.forEach((s, i) => {
        let hit = !v || texts[i].includes(v);
        if (rows[i]) {
          let k = 0;
          rows[i].forEach(([r, t]) => { const h = !v || t.includes(v); r.hidden = !h; k += h; });
          hit = !v || k > 0;
        }
        s.hidden = !hit;
        if (hit && v) n++;
        const a = links.get(s.id);
        if (a) a.classList.toggle('dim', !hit);
      });
      empty.hidden = !v || n > 0;
      info.textContent = v ? (n ? `· ${n}개 절에 있다` : '· 없다') : '';
      all.href = v ? './?q=' + encodeURIComponent(raw) : './';
    };
    q.addEventListener('input', run);
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; run(); q.blur(); } });
    if (params.get('q')) {
      q.value = params.get('q'); run();
      const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView();
    }

    // 명령 블록마다 복사 단추. 클립보드를 못 쓰면 글자를 선택해 둔다.
    document.querySelectorAll('pre.cmd').forEach((pre) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'copy'; b.textContent = '복사';
      b.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        try { await navigator.clipboard.writeText(code.innerText); b.textContent = '복사함'; }
        catch (_) {
          const r = document.createRange(); r.selectNodeContents(code);
          const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = '선택함';
        }
        setTimeout(() => { b.textContent = '복사'; }, 1400);
      });
      pre.appendChild(b);
    });

    // 지금 읽는 절을 목차에 표시한다.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) links.forEach((a, id) => a.classList.toggle('on', id === e.target.id)); });
      }, { rootMargin: '-10% 0px -80% 0px' });
      secs.forEach((s) => io.observe(s));
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== q && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); q.focus(); }
  });
})();
