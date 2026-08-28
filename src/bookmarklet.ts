// Bookmarklet constants — extracted from the component so tests can import them.
//
// The bookmark is a tiny LOADER: it injects the real logic from /bookmarklet.js
// on GitHub Pages. Small URL = no truncation/encoding issues, and logic updates
// reach every user without re-dragging the bookmark.
export const BOOKMARKLET_SCRIPT =
  '(function(){var s=document.createElement("script");s.src="https://codeswithrobi.github.io/sec-leave-planner/bookmarklet.js?v=1";s.onerror=function(){alert("SEC Attendance: could not load script from GitHub Pages. Check your internet connection.");};document.body.appendChild(s);})();'

// URL-encoded for maximum browser compatibility.
// NOTE: render this via ref.setAttribute(), never as a JSX href prop —
// React 19 rewrites javascript: href props to a thrown security error.
export const BOOKMARKLET_URL = 'javascript:' + encodeURIComponent(BOOKMARKLET_SCRIPT)