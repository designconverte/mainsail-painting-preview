/* Mainsail Painting · page behavior (vanilla, no dependencies). Everything works without this file:
   links, the form's no-JS post, the services list (scrollable), the comparators at 50% and the FAQ. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
  // automated browsers (crawlers, test runners) skip the decorative video: the player answers them with a bot check
  var automated = navigator.webdriver === true;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- services dropdown (hover, click, Esc, click outside) ---------- */
  $$('[data-drop]').forEach(function (drop) {
    var btn = $('[data-drop-btn]', drop);
    var panel = $('[data-drop-panel]', drop);
    if (!btn || !panel) return;
    var hoverable = window.matchMedia('(hover: hover)').matches;
    var closedByUser = false;
    var hovering = false;
    function setOpen(open) {
      drop.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      var open = !drop.classList.contains('is-open');
      closedByUser = !open && hovering;
      setOpen(open);
    });
    if (hoverable) {
      drop.addEventListener('mouseenter', function () { hovering = true; if (!closedByUser) setOpen(true); });
      drop.addEventListener('mouseleave', function () { hovering = false; closedByUser = false; setOpen(false); });
    }
    drop.addEventListener('focusout', function (e) {
      if (!drop.contains(e.relatedTarget)) setOpen(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !drop.classList.contains('is-open')) return;
      var hadFocus = drop.contains(doc.activeElement);
      closedByUser = hovering;
      setOpen(false);
      if (hadFocus) btn.focus();
    });
    doc.addEventListener('click', function (e) {
      if (!drop.contains(e.target) && drop.classList.contains('is-open')) setOpen(false);
    });
  });

  /* ---------- mobile menu (dialog: focus kept inside, Esc closes, page behind is inert) ---------- */
  var menu = $('[data-menu]');
  var opener = $('[data-menu-open]');
  if (menu && opener) {
    var closer = $('[data-menu-close]', menu);
    var outside = $$('body > *').filter(function (el) { return el !== menu && el.tagName !== 'SCRIPT'; });
    var openMenu = function () {
      menu.hidden = false;
      root.classList.add('menu-open');
      opener.setAttribute('aria-expanded', 'true');
      outside.forEach(function (el) { el.inert = true; });
      closer.focus();
    };
    var closeMenu = function (returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      root.classList.remove('menu-open');
      opener.setAttribute('aria-expanded', 'false');
      outside.forEach(function (el) { el.inert = false; });
      if (returnFocus !== false) opener.focus();
    };
    opener.addEventListener('click', openMenu);
    closer.addEventListener('click', function () { closeMenu(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
      if (e.key !== 'Tab' || menu.hidden) return;
      var focusables = $$('a[href], button:not([disabled])', menu).filter(function (el) { return el.offsetParent !== null; });
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100) closeMenu(false); });
  }

  /* ---------- background videos (Vimeo player in background mode) ----------
     Never with reduced motion or Save-Data / 2G. The hero starts after `load`; the award video when it is near the
     viewport. The iframe stays at opacity .01 until the player reports `play`; the photo underneath is the LCP. */
  var PLAYER_ORIGIN = 'https://player.vimeo.com';
  var players = [];

  function post(p, method, value) {
    if (!p.iframe || !p.iframe.contentWindow) return;
    var msg = { method: method };
    if (value !== undefined) msg.value = value;
    p.iframe.contentWindow.postMessage(JSON.stringify(msg), PLAYER_ORIGIN);
  }

  function setToggle(p) {
    if (!p.toggle) return;
    var paused = p.userPaused;
    p.toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    var use = $('use', p.toggle);
    if (use) use.setAttribute('href', paused ? '#i-play' : '#i-pause');
    var label = $('[data-video-label]', p.toggle);
    if (label) label.textContent = paused ? 'Play background video' : 'Pause background video';
  }

  function mountVideo(p) {
    if (p.iframe) return;
    var id = p.host.getAttribute('data-vimeo');
    var iframe = doc.createElement('iframe');
    iframe.src = PLAYER_ORIGIN + '/video/' + encodeURIComponent(id) + '?background=1&autoplay=1&loop=1&muted=1&dnt=1&autopause=0';
    iframe.title = p.host.getAttribute('data-vimeo-title') || 'Background video';
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('loading', 'eager');
    p.iframe = iframe;
    iframe.addEventListener('load', function () {
      post(p, 'addEventListener', 'play');
      post(p, 'addEventListener', 'pause');
    });
    p.host.appendChild(iframe);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== PLAYER_ORIGIN) return;
    var data = e.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (err) { return; }
    }
    if (!data || typeof data !== 'object') return;
    players.forEach(function (p) {
      if (!p.iframe || e.source !== p.iframe.contentWindow) return;
      if (data.event === 'ready') {
        post(p, 'addEventListener', 'play');
        post(p, 'addEventListener', 'pause');
      }
      if (data.event === 'play') {
        p.iframe.classList.add('is-playing');
        if (p.toggle) p.toggle.hidden = false;
        if (p.userPaused || !p.inView) post(p, 'pause');
      }
    });
  });

  if (!reduceMotion && !saveData && !automated) {
    $$('[data-vimeo]').forEach(function (host) {
      var section = host.closest('section');
      var p = { host: host, section: section, toggle: section ? $('[data-video-toggle]', section) : null, iframe: null, userPaused: false, inView: true, lazy: host.hasAttribute('data-vimeo-lazy') };
      players.push(p);
      if (p.toggle) {
        p.toggle.addEventListener('click', function () {
          p.userPaused = !p.userPaused;
          post(p, p.userPaused ? 'pause' : 'play');
          setToggle(p);
        });
      }
      if ('IntersectionObserver' in window && section) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            p.inView = entry.isIntersecting;
            if (p.inView && p.lazy && p.armed) mountVideo(p);
            if (!p.iframe) return;
            if (!p.inView) post(p, 'pause');
            else if (!p.userPaused) post(p, 'play');
          });
        }, { rootMargin: '200px 0px' }).observe(section);
      }
    });
    var arm = function () {
      players.forEach(function (p) {
        p.armed = true;
        if (!p.lazy || p.inView) mountVideo(p);
      });
    };
    var start = function () { setTimeout(arm, 600); };
    if (doc.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    // lazy players start "in view" only once the observer says so
    players.forEach(function (p) { if (p.lazy) p.inView = false; });
  }

  /* ---------- services carousel arrows (the track itself is native scroll-snap) ---------- */
  $$('[data-carousel]').forEach(function (track) {
    var section = track.closest('section');
    var nav = section && $('[data-carousel-nav]', section);
    if (!nav) return;
    var prev = $('[data-carousel-prev]', nav);
    var next = $('[data-carousel-next]', nav);
    nav.hidden = false;
    function step() {
      var card = track.firstElementChild;
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- before / after comparators ---------- */
  $$('[data-ba]').forEach(function (fig) {
    var frame = $('.ba__frame', fig);
    var range = $('.ba__range', fig);
    if (!frame || !range) return;
    var set = function () { frame.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    set();
  });

  /* ---------- map facade: the Google embed loads only on request ---------- */
  $$('[data-map]').forEach(function (box) {
    var btn = $('[data-map-load]', box);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var iframe = doc.createElement('iframe');
      iframe.src = box.getAttribute('data-map-src');
      iframe.title = 'Mainsail Painting on Google Maps';
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.setAttribute('allowfullscreen', '');
      box.appendChild(iframe);
      var face = $('.mapf__face', box);
      if (face) face.hidden = true;
      iframe.focus();
    });
  });

  /* ---------- request summary on the last step ---------- */
  $$('form[data-cs-form]').forEach(function (form) {
    var step3 = $('[data-cs-step="3"]', form);
    var summary = $('[data-summary]', form);
    if (!step3 || !summary) return;
    var fill = function () {
      $$('[data-sum]', summary).forEach(function (dd) {
        var name = dd.getAttribute('data-sum');
        var field = form.elements[name];
        if (!field) return;
        var value = field.tagName === 'SELECT' ? (field.value ? field.options[field.selectedIndex].text : '') : field.value;
        dd.textContent = (value || '').trim() || '-';
      });
    };
    new MutationObserver(function () { if (!step3.hidden) fill(); }).observe(step3, { attributes: true, attributeFilter: ['hidden'] });
  });

  /* ---------- mobile bar: after the hero call button scrolls away, hidden while the form is on screen ---------- */
  var mbar = $('[data-mbar]');
  if (mbar && 'IntersectionObserver' in window) {
    var heroCta = $('[data-hero-cta]');
    var formSection = $('#schedule');
    var pastHero = !heroCta;
    var formVisible = false;
    var render = function () { mbar.classList.toggle('is-visible', pastHero && !formVisible); };
    if (heroCta) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        render();
      }).observe(heroCta);
    }
    if (formSection) {
      new IntersectionObserver(function (entries) {
        formVisible = entries[0].isIntersecting;
        render();
      }, { threshold: 0.15 }).observe(formSection);
    }
    render();
  }
})();
