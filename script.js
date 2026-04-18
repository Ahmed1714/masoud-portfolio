/**
 * ═══════════════════════════════════════════════════════════
 *  MASOUD PORTFOLIO — SCRIPT.JS
 *  Handles: Custom Cursor · Nav Scroll · Hero Animations
 *           Scroll Reveal · Skill Bars · Counters
 *           Portfolio Filter · Back-to-top · Mobile Menu
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

/* ────────────────────────────────────────
   UTILITY
──────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

/* ────────────────────────────────────────
   1. CUSTOM CURSOR
──────────────────────────────────────── */
(function initCursor() {
  if (isTouch()) return;

  const cursor   = $('#cursor');
  const follower = $('#cursorFollower');
  if (!cursor || !follower) return;

  let mx = -200, my = -200; // start off-screen
  let fx = -200, fy = -200;
  let raf;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
  });

  // Smooth follower via lerp
  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    fx = lerp(fx, mx, 0.14);
    fy = lerp(fy, my, 0.14);
    follower.style.left = fx + 'px';
    follower.style.top  = fy + 'px';
    raf = requestAnimationFrame(tick);
  }

  tick();

  // Hover effect on interactive elements
  const hoverTargets = 'a, button, .project-card, .service-card, .pill, .social-link, .email-link, .play-btn, .btn';

  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverTargets)) {
      cursor.classList.add('cursor--hover');
      follower.classList.add('cursor-follower--hover');
    }
  });

  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverTargets)) {
      cursor.classList.remove('cursor--hover');
      follower.classList.remove('cursor-follower--hover');
    }
  });

  // Hide when leaving window
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    follower.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    follower.style.opacity = '1';
  });
})();

/* ────────────────────────────────────────
   2. NAVIGATION SCROLL STATE
──────────────────────────────────────── */
(function initNav() {
  const nav = $('#nav');
  if (!nav) return;

  let lastY = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('nav--scrolled', y > 40);
    lastY = y;
  }, { passive: true });
})();

/* ────────────────────────────────────────
   3. MOBILE MENU
──────────────────────────────────────── */
(function initMobileMenu() {
  const hamburger  = $('#hamburger');
  const mobileMenu = $('#mobileMenu');
  const mobileLinks = $$('.mobile-link');
  if (!hamburger || !mobileMenu) return;

  let isOpen = false;

  function toggleMenu(state) {
    isOpen = typeof state === 'boolean' ? state : !isOpen;
    hamburger.classList.toggle('is-open', isOpen);
    mobileMenu.classList.toggle('is-open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  hamburger.addEventListener('click', () => toggleMenu());

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) toggleMenu(false);
  });
})();

/* ────────────────────────────────────────
   4. HERO NAME — LETTER SPLIT & STAGGER
──────────────────────────────────────── */
(function initHeroName() {
  const line = $('#heroNameLine');
  if (!line) return;

  const name = 'Masoud';
  const fragment = document.createDocumentFragment();

  name.split('').forEach((char, i) => {
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = char;
    // Stagger delay per letter
    span.style.animationDelay = (0.1 + i * 0.07) + 's';
    fragment.appendChild(span);
  });

  line.appendChild(fragment);
})();

/* ────────────────────────────────────────
   5. INTERSECTION OBSERVER — SCROLL REVEAL
──────────────────────────────────────── */
(function initReveal() {
  const targets = $$('.reveal-up, .reveal-left, .reveal-right');
  if (!targets.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px'
  });

  targets.forEach(el => observer.observe(el));
})();

/* ────────────────────────────────────────
   6. ANIMATED COUNTERS (Hero Stats)
──────────────────────────────────────── */
(function initCounters() {
  const statNums = $$('[data-count]');
  if (!statNums.length) return;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el) {
    const target   = parseInt(el.dataset.count, 10);
    const duration = 1800;
    let startTime  = null;

    function step(ts) {
      if (!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.textContent = Math.round(easeOut(progress) * target);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNums.forEach(el => observer.observe(el));
})();

/* ────────────────────────────────────────
   7. SKILL BARS (animate width on reveal)
──────────────────────────────────────── */
(function initSkillBars() {
  const fills = $$('.skill-fill');
  if (!fills.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const width = entry.target.dataset.width || '0';
        // Small delay so the transition feels intentional
        setTimeout(() => {
          entry.target.style.width = width + '%';
        }, 200);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  fills.forEach(el => observer.observe(el));
})();

/* ────────────────────────────────────────
   8. PORTFOLIO FILTER
──────────────────────────────────────── */
(function initPortfolioFilter() {
  const pills = $$('.pill');
  const cards = $$('.project-card');
  if (!pills.length || !cards.length) return;

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.dataset.filter;

      // Update active pill
      pills.forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');

      // Show / hide cards with a fade
      cards.forEach(card => {
        const category = card.dataset.category;

        if (filter === 'all' || category === filter) {
          card.removeAttribute('data-hidden');
          // Trigger re-reveal animation
          card.classList.remove('revealed');
          card.style.opacity = '0';
          card.style.transform = 'translateY(30px)';

          requestAnimationFrame(() => {
            setTimeout(() => {
              card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 50);
          });
        } else {
          card.setAttribute('data-hidden', 'true');
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
        }
      });
    });
  });
})();

/* ────────────────────────────────────────
   9. SHOWREEL PLAY BUTTON (click effect)
──────────────────────────────────────── */
(function initShowreel() {
  const placeholder = $('#showreelPlaceholder');
  const playBtn     = $('#playBtn');
  if (!placeholder || !playBtn) return;

  /**
   * REPLACE THIS FUNCTION with actual video logic.
   * 
   * Option A — Vimeo embed on click:
   *   placeholder.innerHTML = `
   *     <iframe src="https://player.vimeo.com/video/YOUR_ID?autoplay=1"
   *       frameborder="0" allow="autoplay; fullscreen" allowfullscreen
   *       style="position:absolute;inset:0;width:100%;height:100%"></iframe>`;
   * 
   * Option B — YouTube embed on click:
   *   placeholder.innerHTML = `
   *     <iframe src="https://www.youtube.com/embed/YOUR_ID?autoplay=1"
   *       frameborder="0" allow="autoplay; encrypted-media" allowfullscreen
   *       style="position:absolute;inset:0;width:100%;height:100%"></iframe>`;
   * 
   * Option C — self-hosted video:
   *   const video = document.createElement('video');
   *   video.src = 'videos/showreel.mp4';
   *   video.controls = true;
   *   video.autoplay = true;
   *   video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
   *   placeholder.innerHTML = '';
   *   placeholder.appendChild(video);
   */
  placeholder.addEventListener('click', () => {
    // Pulse animation to signal click was registered
    playBtn.style.transform = 'scale(0.9)';
    setTimeout(() => { playBtn.style.transform = ''; }, 150);

    // TODO: Replace the block below with your embed code (see comments above)
    const msg = document.createElement('div');
    msg.style.cssText = `
      position:absolute; inset:0; display:flex; align-items:center; 
      justify-content:center; background:rgba(8,8,8,.9);
      font-family:'DM Mono',monospace; font-size:12px; letter-spacing:.2em;
      text-transform:uppercase; color:rgba(255,255,255,.4); z-index:10;
    `;
    msg.textContent = '▶  Replace with your Vimeo / YouTube embed';
    placeholder.appendChild(msg);
    setTimeout(() => msg.remove(), 2800);
  });
})();

/* ────────────────────────────────────────
   10. BACK TO TOP BUTTON
──────────────────────────────────────── */
(function initBackTop() {
  const btn = $('#backTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 600);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ────────────────────────────────────────
   11. FOOTER YEAR
──────────────────────────────────────── */
(function setYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
})();

/* ────────────────────────────────────────
   12. SMOOTH ANCHOR SCROLL (fallback for
       browsers without native smooth scroll)
──────────────────────────────────────── */
(function initSmoothScroll() {
  $$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id = anchor.getAttribute('href');
      if (id === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = $('#nav')?.offsetHeight || 70;
      const top  = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ────────────────────────────────────────
   13. PARALLAX — HERO GLOWS
       (subtle parallax on mouse move)
──────────────────────────────────────── */
(function initParallax() {
  if (isTouch()) return;

  const glows = $$('.hero-glow');
  if (!glows.length) return;

  const speeds = [0.015, 0.025, 0.02];

  document.addEventListener('mousemove', e => {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    glows.forEach((glow, i) => {
      const s = speeds[i] || 0.02;
      glow.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
    });
  });
})();

/* ────────────────────────────────────────
   14. ACTIVE NAV LINK (highlight on scroll)
──────────────────────────────────────── */
(function initActiveNav() {
  const sections = $$('section[id]');
  const navLinks = $$('.nav-links a');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          const active = link.getAttribute('href') === `#${id}`;
          link.style.color = active ? 'var(--white)' : '';
        });
      }
    });
  }, {
    threshold: 0.35
  });

  sections.forEach(s => observer.observe(s));
})();

/* ────────────────────────────────────────
   15. PAGE LOAD — initial reveal for
       hero elements (no IntersectionObserver
       needed, just run after DOM ready)
──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Trigger hero's .reveal-up items immediately (they're above the fold)
  const heroReveals = $$('.hero .reveal-up');
  // Small stagger to let CSS animations breathe
  heroReveals.forEach((el, i) => {
    setTimeout(() => el.classList.add('revealed'), 800 + i * 100);
  });
});
