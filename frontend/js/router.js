// js/router.js — Client-side page router
const Router = {
  currentPage: 'home',
  pages: ['home','about','services','results','news','gallery','team',
          'events','faq','downloads','contact','login','admin','privacy'],

  init() {
    // Read hash on load. 'adminlogin' is a hidden entry point to the portal
    // login page — it's not linked anywhere in the public nav/footer/search,
    // reachable only by visiting the URL directly.
    const hash = window.location.hash.replace('#', '') || 'home';
    const resolved = hash === 'adminlogin' ? 'login' : hash;
    this.navigate(this.pages.includes(resolved) ? resolved : 'home', false);

    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '');
      const resolvedPage = page === 'adminlogin' ? 'login' : page;
      if (this.pages.includes(resolvedPage)) this.navigate(resolvedPage, false);
    });
  },

  navigate(pageId, updateHash = true) {
    // Guard admin page
    if (pageId === 'admin' && !Auth.isAdmin()) {
      this.navigate('login');
      return;
    }

    // Close any open modal so it can't get left stuck on top of the next
    // page (also stops any embedded video/audio still playing inside it).
    document.querySelectorAll('.modal-overlay.open, .gallery-modal.open').forEach(m => {
      m.classList.remove('open');
      const iframe = m.querySelector('iframe');
      if (iframe) iframe.src = '';
    });

    // Hide all sections
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

    const section = document.getElementById('page-' + pageId);
    if (!section) return;

    section.classList.add('active');
    this.currentPage = pageId;

    // The admin portal is a standalone screen — hide the public site's
    // navbar/ticker so it isn't a mix of "public site + admin panel".
    const isAdminPage = pageId === 'admin';
    const navbar = document.getElementById('navbar');
    const ticker = document.querySelector('.news-ticker');
    if (navbar) navbar.style.display = isAdminPage ? 'none' : '';
    if (ticker) ticker.style.display = isAdminPage ? 'none' : '';
    document.body.classList.toggle('admin-mode', isAdminPage);

    if (updateHash) window.location.hash = pageId;

    // Update nav active state
    document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
      a.classList.toggle('active', a.dataset.page === pageId);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger page load function if exists
    const loaderFn = window[`load_${pageId}`];
    if (typeof loaderFn === 'function') loaderFn();
  },
};

// js/auth.js — Auth state management
const Auth = {
  TOKEN_KEY: 'kosiec_token',
  USER_KEY:  'kosiec_user',

  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  getUser()  {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY)); }
    catch { return null; }
  },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin()    {
    const u = this.getUser();
    return u && ['super_admin', 'admin', 'staff'].includes(u.role);
  },
  isSuperAdmin() {
    const u = this.getUser();
    return u && u.role === 'super_admin';
  },

  async login(email, password) {
    const res = await api.auth.login({ email, password });
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    return res.user;
  },

  async logout() {
    try { await api.auth.logout(); } catch (e) { /* non-blocking */ }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    Router.navigate('home');
    renderNavForRole();
  },
};

// ── Nav rendering based on login state ──────────────────────
function renderNavForRole() {
  const user = Auth.getUser();
  const adminLink = document.getElementById('nav-admin-link');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const loginBtn  = document.getElementById('nav-login-btn');

  if (user && Auth.isAdmin()) {
    if (adminLink)  adminLink.style.display = 'inline-flex';
    if (logoutBtn)  logoutBtn.style.display = 'inline-flex';
    if (loginBtn)   loginBtn.style.display  = 'none';
  } else {
    if (adminLink)  adminLink.style.display = 'none';
    if (logoutBtn)  logoutBtn.style.display = 'none';
    if (loginBtn)   loginBtn.style.display  = 'inline-flex';
  }
}

window.Router = Router;
window.Auth   = Auth;
window.renderNavForRole = renderNavForRole;
