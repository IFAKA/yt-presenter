// Key takeaways card — shown at the end of the transcript

window.YTPresenter = window.YTPresenter || {};

(function() {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.YTPresenter.showTakeaways = function(container, takeaways, endscreenVideos) {
    container.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'ytpres-takeaways';

    const items = (takeaways || [])
      .map(t => `<li class="ytpres-takeaway-item">${escapeHtml(t)}</li>`)
      .join('');

    // Read Next section from endscreen videos
    let readNextHtml = '';
    if (endscreenVideos && endscreenVideos.length > 0) {
      const cards = endscreenVideos.slice(0, 3).map(v => {
        const url = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
        const thumbStyle = v.thumbnail ? `background-image: url(${escapeHtml(v.thumbnail)})` : '';
        return `
          <a class="ytpres-readnext-card" href="${escapeHtml(url)}" target="_self">
            <div class="ytpres-readnext-thumb" style="${thumbStyle}"></div>
            <div class="ytpres-readnext-title">${escapeHtml(v.title)}</div>
          </a>
        `;
      }).join('');

      readNextHtml = `
        <div class="ytpres-readnext">
          <div class="ytpres-readnext-label">Read Next</div>
          <div class="ytpres-readnext-grid">${cards}</div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="ytpres-takeaways-title">Key Takeaways</div>
      <ul class="ytpres-takeaways-list">${items}</ul>
      <div class="ytpres-takeaways-copy" id="ytpres-copy-takeaways">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        Copy to clipboard
      </div>
      ${readNextHtml}
    `;

    container.appendChild(el);

    el.querySelector('#ytpres-copy-takeaways').addEventListener('click', () => {
      const text = takeaways.map((t, i) => `${i + 1}. ${t}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        const copyEl = el.querySelector('#ytpres-copy-takeaways');
        copyEl.textContent = 'Copied!';
        setTimeout(() => {
          copyEl.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            Copy to clipboard
          `;
        }, 2000);
      });
    });
  };
})();
