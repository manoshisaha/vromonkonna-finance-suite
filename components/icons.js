/**
 * components/icons.js
 *
 * Replaces every `<i class="ti ti-{name}">` placeholder in the DOM with
 * inline SVG, matching Tabler's icon set closely enough for our purposes.
 * This removes the app's only remaining external CDN dependency for
 * icons (previously a webfont link, which is one more thing that can
 * fail — wrong URL, CDN outage, ad-blocker, restrictive network). Inline
 * SVG has none of those failure modes.
 *
 * Usage: call initIcons() once per page (already wired into js/app.js's
 * initShell(), so every page gets this automatically). A MutationObserver
 * keeps watching afterward, so icons rendered later (e.g. table rows
 * added after an API call resolves) or whose class changes at runtime
 * (e.g. Trip History's sort-direction arrow) are handled automatically —
 * no need to call anything again elsewhere.
 */

const ICON_SVGS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 17v4h12v-4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 13.7 4.7L20 15.5M20 20v-4.5h-4.5"/></svg>',
  'alert-triangle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 9v5M12 17v.01"/></svg>',
  'chevron-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  'chevron-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  'arrows-sort': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"/></svg>',
  'sort-ascending': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v16M6 7l3-3 3 3M15 8h6M15 12h4M15 16h2"/></svg>',
  'sort-descending': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v16M6 17l3 3 3-3M15 8h2M15 12h4M15 16h6"/></svg>',
  'file-type-csv': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/></svg>',
  'file-spreadsheet': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h8M11 13v7"/></svg>',
  'file-type-pdf': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 17v-4h1.5a1.5 1.5 0 0 1 0 3H8M13 17v-4h2M13 15h1.5M18 17v-4h2"/></svg>',
  'info-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5v.01"/></svg>',
};

/** Fills a single `<i class="ti ti-{name}">` element with its matching inline SVG. */
function applyIcon(el) {
  for (const cls of el.classList) {
    if (cls.startsWith('ti-')) {
      const name = cls.slice(3);
      if (ICON_SVGS[name]) {
        el.innerHTML = ICON_SVGS[name];
        return;
      }
    }
  }
}

/**
 * Processes every existing `.ti` icon under `root`, then keeps watching
 * for new icons added later and for class changes on existing ones
 * (covers dynamically-rendered rows and icons whose class is swapped at
 * runtime, e.g. a sort-direction indicator).
 * @param {Element} [root]
 */
export function initIcons(root = document.body) {
  root.querySelectorAll('i.ti').forEach(applyIcon);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target.classList && mutation.target.classList.contains('ti')) {
        applyIcon(mutation.target);
      }
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('i.ti')) applyIcon(node);
          if (node.querySelectorAll) node.querySelectorAll('i.ti').forEach(applyIcon);
        });
      }
    });
  });

  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
