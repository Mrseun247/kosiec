// pages/home.js  — loads settings, countdown, chairman, news preview, testimonials
window.load_home = async function () {
  let settings = {};
  try {
    // Load public settings (ticker, countdown target, stats)
    const response = await api.settings.getPublic();
    settings = response.data || {};
  } catch (err) {
    console.warn('[home] Settings load failed, using countdown fallback.', err.message);
  }

  // ── Countdown ──────────────────────────────────────────
  const countdownSection = document.getElementById('countdown-section');
  if (settings.next_election_active === false) {
    if (countdownSection) countdownSection.style.display = 'none';
  } else {
    if (countdownSection) countdownSection.style.display = '';
    if (settings.next_election_date) {
      startCountdown(new Date(settings.next_election_date), settings.next_election_label || 'Next Election');
    } else {
      // Default fallback: 17 October 2026
      startCountdown(new Date(2026, 9, 17, 0, 0, 0), '17 October 2026');
    }
  }

  // ── Live stream ────────────────────────────────────────
  const liveSection = document.getElementById('live-stream-section');
  const liveFrame = document.getElementById('live-stream-frame');
  if (liveSection && liveFrame) {
    if (settings.live_stream_active && settings.live_stream_url) {
      liveSection.style.display = '';
      liveFrame.src = toEmbedUrl(settings.live_stream_url);
      setText('live-stream-title', settings.live_stream_title || 'Election Monitoring Live Stream');
    } else {
      liveSection.style.display = 'none';
      liveFrame.src = '';
    }
  }

  try {
    // ── Ticker ─────────────────────────────────────────────
    if (settings.ticker_messages) {
      const inner = document.getElementById('ticker-inner');
      if (inner) {
        inner.innerHTML = settings.ticker_messages
          .map(m => `<span>${m}</span>`).join('');
      }
    }

    // ── Stats ──────────────────────────────────────────────
    if (settings.commission_stats) {
      const s = settings.commission_stats;
      setText('stat-lgas',  s.lgas);
      setText('stat-year',  s.yearEstablished);
      setText('stat-staff', s.staffCount + '+');
    }
  } catch (err) {
    console.warn('[home] Additional settings rendering failed.', err.message);
  }

  try {
    // ── News preview (latest 3) ────────────────────────────
    const newsRes = await api.news.getPublished('?limit=3');
    renderHomeNews(newsRes.data || []);
  } catch (err) {
    console.warn('[home] Load error:', err.message);
  }
};

function renderHomeNews(articles) {
  const grid = document.getElementById('home-news-grid');
  if (!grid) return;
  if (!articles.length) { grid.innerHTML = '<p class="empty-state">No news published yet.</p>'; return; }
  grid.innerHTML = articles.map(a => newsCard(a)).join('');
}

// ── Countdown timer ────────────────────────────────────────
let countdownInterval;
function startCountdown(target, label) {
  if (countdownInterval) clearInterval(countdownInterval);
  const labelEl = document.getElementById('countdown-label');
  if (labelEl && label) labelEl.textContent = label;

  const tick = () => {
    const diff = target - new Date();
    if (diff <= 0) {
      clearInterval(countdownInterval);
      setText('cd-days', 0); setText('cd-hours', '00'); setText('cd-mins', '00'); setText('cd-secs', '00');
      if (labelEl) labelEl.textContent = 'Election Day Has Arrived';
      return;
    }
    setText('cd-days',  Math.floor(diff / 86400000));
    setText('cd-hours', String(Math.floor((diff % 86400000) / 3600000)).padStart(2,'0'));
    setText('cd-mins',  String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0'));
    setText('cd-secs',  String(Math.floor((diff % 60000) / 1000)).padStart(2,'0'));
  };
  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ============================================================
// pages/results.js
// ============================================================
window.load_results = async function () {
  const grid = document.getElementById('results-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading results…</div>';
  try {
    const { data } = await api.results.getPublished();
    if (!data.length) { grid.innerHTML = '<p class="empty-state">No results published yet.</p>'; return; }
    grid.innerHTML = data.map(r => resultCard(r)).join('');
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load results. ${err.message}</p>`;
  }
};

function resultCard(r) {
  const entries = (r.voteEntries || []).sort((a,b) => b.votes - a.votes);
  const maxVotes = entries[0]?.votes || 1;
  return `
    <div class="result-card">
      <div class="result-lga">${r.lga?.name || '—'} LGA</div>
      <div class="result-title">${r.election?.year || ''} ${r.position === 'chairman' ? 'Chairmanship' : 'Councillorship'} Election</div>
      ${entries.map((e,i) => `
        <div class="candidate-row">
          <div class="candidate-name">${e.candidateName} (${e.party})</div>
          <div class="candidate-bar-wrap">
            <div class="candidate-bar ${i > 0 ? 'runner' : ''}" style="width:${Math.round((e.votes/maxVotes)*100)}%"></div>
          </div>
          <div class="candidate-votes">${e.votes.toLocaleString()}</div>
        </div>`).join('')}
      ${r.winnerName ? `<div class="result-winner"><span class="winner-badge">WINNER</span> <span class="winner-name">${r.winnerName} (${r.winnerParty})</span></div>` : ''}
    </div>`;
}

// ============================================================
// pages/news.js
// ============================================================
window.load_news = async function () {
  const grid = document.getElementById('news-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading news…</div>';
  try {
    const { data } = await api.news.getPublished();
    if (!data.length) { grid.innerHTML = '<p class="empty-state">No articles published yet.</p>'; return; }
    grid.innerHTML = data.map(a => newsCard(a)).join('');
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load news. ${err.message}</p>`;
  }
};

function newsCard(a) {
  const emoji = { official_notice:'📋', civic_education:'🎓', election_news:'🗳️',
    press_release:'📢', announcement:'📣', registration:'📋', results:'📊',
    training:'🎓', partnership:'🤝', other:'📰' };
  return `
    <div class="news-card" onclick="openArticle('${a.slug}')">
      <div class="news-img">${a.featuredImage ? `<img src="${a.featuredImage}" alt="${a.title}">` : (emoji[a.category] || '📰')}</div>
      <div class="news-body">
        <div class="news-tag">${(a.category || 'news').replace(/_/g,' ')}</div>
        <h3>${a.title}</h3>
        <p>${a.excerpt || ''}</p>
        <div class="news-date">📅 ${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-NG', {day:'numeric',month:'long',year:'numeric'}) : ''}</div>
      </div>
    </div>`;
}

window.openArticle = async function(slug) {
  try {
    const { data: article } = await api.news.getOne(slug);
    const modal = document.getElementById('article-modal');
    if (!modal) return;
    document.getElementById('modal-title').textContent   = article.title;
    document.getElementById('modal-content').innerHTML   = article.content;
    document.getElementById('modal-date').textContent    =
      article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-NG',{dateStyle:'long'}) : '';
    modal.classList.add('open');
  } catch (err) { alert('Could not load article: ' + err.message); }
};

window.closeArticleModal = function () {
  const modal = document.getElementById('article-modal');
  if (modal) modal.classList.remove('open');
  // Clear the content so any embedded video/audio (iframe) actually stops
  // playing instead of continuing muted-off-screen in the background.
  const content = document.getElementById('modal-content');
  if (content) content.innerHTML = '';
};

// ============================================================
// pages/team.js
// ============================================================
window.load_team = async function () {
  const grid = document.getElementById('team-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading team…</div>';
  try {
    const { data } = await api.team.getAll();
    if (!data.length) { grid.innerHTML = '<p class="empty-state">Team information coming soon.</p>'; return; }

    // Chairman first
    const chairman = data.find(m => m.isChairman);
    const rest = data.filter(m => !m.isChairman);

    let html = '';
    if (chairman) {
      html += `
        <div class="chairman-full-card" id="chairman-full">
          <div class="chairman-photo-wrap large">
            ${chairman.photo
              ? `<img src="${chairman.photo}" alt="${chairman.fullName}" class="chairman-photo large">`
              : `<div class="chairman-photo-placeholder large">${getInitials(chairman.fullName)}</div>`}
          </div>
          <div class="chairman-full-info">
            <div class="eyebrow">Commission Chairman</div>
            <h2>${chairman.title ? chairman.title + ' ' : ''}${chairman.fullName}</h2>
            <div class="chairman-role-badge">${chairman.role}</div>
            <p>${chairman.bio || ''}</p>
            <div class="chairman-details">
              ${chairman.email ? `<div>📧 ${chairman.email}</div>` : ''}
              ${chairman.phone ? `<div>📞 ${chairman.phone}</div>` : ''}
              ${chairman.appointedDate ? `<div>📅 Appointed: ${new Date(chairman.appointedDate).getFullYear()}</div>` : ''}
            </div>
            <button class="btn-primary" style="margin-top:18px" onclick="Router.navigate('chairman')">View Full Profile →</button>
          </div>
        </div>`;
    }

    html += `<div class="team-grid-inner">${rest.map(m => teamCard(m)).join('')}</div>`;
    grid.innerHTML = html;
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load team. ${err.message}</p>`;
  }
};

function teamCard(m) {
  const photoHTML = m.photo
    ? `<img src="${m.photo}" alt="${m.fullName}" class="team-photo-img">`
    : `<div class="team-photo">${getInitials(m.fullName)}</div>`;
  return `
    <div class="team-card">
      <div class="team-photo-wrap">${photoHTML}</div>
      <h3>${m.title ? m.title + ' ' : ''}${m.fullName}</h3>
      <div class="team-role">${m.role}</div>
      <p>${m.bio || ''}</p>
    </div>`;
}

// ============================================================
// pages/chairman.js
// ============================================================
window.load_chairman = async function () {
  const el = document.getElementById('chairman-profile-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading chairman profile…</div>';
  try {
    const { data: chairman } = await api.team.getChairman();
    if (!chairman) { el.innerHTML = '<p class="empty-state">Chairman profile coming soon.</p>'; return; }

    const photoHTML = chairman.photo
      ? `<img src="${chairman.photo}" alt="${chairman.fullName}" class="chairman-photo large">`
      : `<div class="chairman-photo-placeholder large">${getInitials(chairman.fullName)}</div>`;

    const bioParagraphs = (chairman.bio || '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p}</p>`)
      .join('');

    const qualificationsHTML = (chairman.qualifications && chairman.qualifications.length)
      ? `<div class="chairman-details" style="margin-top:20px">
           <div style="font-weight:700;color:var(--gold-light);text-transform:uppercase;font-size:12px;letter-spacing:.5px;margin-bottom:8px">Qualifications</div>
           ${chairman.qualifications.map(q => `<div>🎓 ${q}</div>`).join('')}
         </div>`
      : '';

    el.innerHTML = `
      <div class="section-header"><div class="header-box"><div class="eyebrow">Leadership Profile</div><h2>${chairman.title ? chairman.title + ' ' : ''}${chairman.fullName}</h2></div></div>
      <div class="chairman-full-card" style="align-items:start;margin-bottom:0">
        <div class="chairman-photo-wrap large">${photoHTML}</div>
        <div class="chairman-full-info">
          <div class="eyebrow">Commission Chairman</div>
          <div class="chairman-role-badge">${chairman.role} — KOSIEC</div>
          ${bioParagraphs}
          ${qualificationsHTML}
          <div class="chairman-details" style="margin-top:16px">
            ${chairman.email ? `<div>📧 ${chairman.email}</div>` : ''}
            ${chairman.phone ? `<div>📞 ${chairman.phone}</div>` : ''}
            ${chairman.appointedDate ? `<div>📅 Appointed Chairman: ${new Date(chairman.appointedDate).toLocaleDateString('en-NG',{month:'long',year:'numeric'})}</div>` : ''}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="error-state">Could not load chairman profile. ${err.message}</p>`;
  }
};

// ============================================================
// pages/events.js
// ============================================================
window.load_events = async function () {
  const grid = document.getElementById('events-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading events…</div>';
  try {
    const { data } = await api.events.getAll();
    if (!data.length) { grid.innerHTML = '<p class="empty-state">No events scheduled yet.</p>'; return; }
    grid.innerHTML = data.map(ev => eventCard(ev)).join('');
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load events. ${err.message}</p>`;
  }
};

function eventCard(ev) {
  const d = new Date(ev.eventDate);
  return `
    <div class="event-card">
      <div class="event-date-block">
        <div class="event-day">${d.getDate()}</div>
        <div class="event-month">${d.toLocaleString('default',{month:'short'})}</div>
      </div>
      <div class="event-info">
        <div class="event-tag">${(ev.category||'').replace(/_/g,' ')}</div>
        <h3>${ev.title}</h3>
        <p>${ev.description || ''}</p>
        ${ev.venue ? `<div class="event-venue">📍 ${ev.venue}</div>` : ''}
        ${ev.time  ? `<div class="event-time">🕐 ${ev.time}</div>`  : ''}
      </div>
    </div>`;
}

// ============================================================
// pages/gallery.js
// ============================================================
const defaultGalleryItems = [
  {
    _id: 'cloudinary-dai-1',
    title: 'KOSIEC partnering with DAI',
    description: 'KOSIEC partnering with DAI, an European Union body that is concerned with Local Council Elections in Nigeria.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782941761/WhatsApp_Image_2026-06-30_at_6.37.48_AM_b0w7rp.jpg',
  },
  {
    _id: 'cloudinary-dai-2',
    title: 'KOSIEC partnering with DAI',
    description: 'KOSIEC partnering with DAI, an European Union body that is concerned with Local Council Elections in Nigeria.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782941761/WhatsApp1_Image_2026-06-30_at_6.37.47_AM_unzk4o.jpg',
  },
  {
    _id: 'cloudinary-dai-3',
    title: 'KOSIEC partnering with DAI',
    description: 'KOSIEC partnering with DAI, an European Union body that is concerned with Local Council Elections in Nigeria.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782941760/WhatsApp_Image_2026-06-30_at_6.37.46_AM_o8jzw2.jpg',
  },
  {
    _id: 'cloudinary-dai-4',
    title: 'KOSIEC partnering with DAI',
    description: 'KOSIEC partnering with DAI, an European Union body that is concerned with Local Council Elections in Nigeria.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782941758/WhatsApp_Image_2026-06-30_at_6.37.47_AM_j8ivwu.jpg',
  },
  {
    _id: 'cloudinary-dai-5',
    title: 'KOSIEC partnering with DAI',
    description: 'KOSIEC partnering with DAI, an European Union body that is concerned with Local Council Elections in Nigeria.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782941757/WhatsApp_2Image_2026-06-30_at_6.37.47_AM_ri99y6.jpg',
  },
  {
    _id: 'cloudinary-ebira-1',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943445/WhatsApp5_Image_2026-06-30_at_6.41.36_AM_usrw89.jpg',
  },
  {
    _id: 'cloudinary-ebira-2',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943448/WhatsApp4_Image_2026-06-30_at_6.41.35_AM_dkm6wx.jpg',
  },
  {
    _id: 'cloudinary-ebira-3',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943447/WhatsApp12_Image_2026-06-30_at_6.41.41_AM_emcih4.jpg',
  },
  {
    _id: 'cloudinary-ebira-4',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943446/WhatsApp2_Image_2026-06-30_at_6.41.33_AM_czzuxh.jpg',
  },
  {
    _id: 'cloudinary-ebira-5',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943446/WhatsApp11_Image_2026-06-30_at_6.41.40_AM_qtmuyg.jpg',
  },
  {
    _id: 'cloudinary-ebira-6',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943446/WhatsApp10_Image_2026-06-30_at_6.41.38_AM_dcjuvd.jpg',
  },
  {
    _id: 'cloudinary-ebira-7',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943446/WhatsApp8_Image_2026-06-30_at_6.41.37_AM_cyfet3.jpg',
  },
  {
    _id: 'cloudinary-ebira-8',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943443/WhatsApp_Image_2026-06-30_at_6.41.32_AM_hkgppj.jpg',
  },
  {
    _id: 'cloudinary-ebira-9',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943444/WhatsApp3_Image_2026-06-30_at_6.41.33_AM_ya5udp.jpg',
  },
  {
    _id: 'cloudinary-ebira-10',
    title: 'Courtesy Visit to the Ohinoyi of Ebira Land',
    description: 'A courtesy visit to the Palace of the Ohinoyi of Ebira land during the Sensitisation campaigns.',
    mediaType: 'photo',
    filePath: 'https://res.cloudinary.com/dcjveb2al/image/upload/v1782943442/WhatsApp1_Image_2026-06-30_at_6.41.32_AM_y3xaoe.jpg',
  },
  ...[
    ['v1783258207','WhatsApp_Image_2026-06-30_at_6.57.43_AM_ek54tc'],
    ['v1783258476','WhatsApp_Image_2026-06-30_at_6.57.44_AM_mbdxyy'],
    ['v1783258207','WhatsApp_Image_2026-06-30_at_6.57.46_AM_zdcjfl'],
    ['v1783258208','WhatsApp_Image_2026-06-30_at_6.57.49_AM_wi5dqz'],
    ['v1783258210','WhatsApp_Image_2026-06-30_at_6.57.57_AM_tq0znc'],
    ['v1783258211','WhatsApp_Image_2026-06-30_at_6.57.59_AM_wnkfce'],
    ['v1783258213','WhatsApp_Image_2026-06-30_at_6.58.00_AM_c0mlom'],
    ['v1783258214','WhatsApp_Image_2026-06-30_at_6.58.02_AM_lvdl89'],
    ['v1783258216','WhatsApp_Image_2026-06-30_at_6.58.05_AM_suje2t'],
    ['v1783258217','WhatsApp_Image_2026-06-30_at_6.58.08_AM_qrxout'],
    ['v1783258218','WhatsApp_Image_2026-06-30_at_6.58.09_AM_pda72l'],
    ['v1783258220','WhatsApp_Image_2026-06-30_at_6.58.10_AM_p5by6f'],
    ['v1783258222','WhatsApp_Image_2026-06-30_at_6.58.11_AM_mzcjl8'],
    ['v1783258224','WhatsApp_Image_2026-06-30_at_6.58.12_AM_qkyp3m'],
    ['v1783258226','WhatsApp_Image_2026-06-30_at_6.58.15_AM_h406xe'],
    ['v1783258227','WhatsApp_Image_2026-06-30_at_6.58.19_AM_tn6r96'],
  ].map(([version, publicId], i) => ({
    _id: `cloudinary-retreat-${i + 1}`,
    title: 'Retreat for Stakeholders',
    description: 'Retreat for Stakeholders concerning Reforms Injected in the Electoral Act 2026.',
    mediaType: 'photo',
    filePath: `https://res.cloudinary.com/dcjveb2al/image/upload/${version}/${publicId}.jpg`,
  })),
];

function isVideoGalleryItem(item) {
  const url = item?.videoUrl || item?.filePath || '';
  return item?.mediaType === 'video' || !!item?.videoUrl || /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

function getGalleryMediaMarkup(item) {
  if (isVideoGalleryItem(item)) {
    const src = item.videoUrl || item.filePath || '';
    const title = item.title || 'Video';
    const youtubeMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
    if (youtubeMatch) {
      return `<iframe class="gallery-media-frame" src="https://www.youtube.com/embed/${youtubeMatch[1]}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }

    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch) {
      return `<iframe class="gallery-media-frame" src="https://player.vimeo.com/video/${vimeoMatch[1]}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }

    const safeTitle = title.replace(/"/g, '&quot;');
    const safeSrc = src.replace(/'/g, '%27');
    return `<iframe class="gallery-media-frame" srcdoc="<video controls playsinline preload='metadata' style='width:100%;height:100%;object-fit:cover;background:#0e2e1e;' src='${safeSrc}'></video>" title="${safeTitle}" loading="lazy"></iframe>`;
  }

  if (item?.filePath) {
    return `<img src="${item.filePath}" alt="${item.title || 'Gallery item'}">`;
  }

  return `<div class="gallery-placeholder">📷<br><small>${item?.title || 'Gallery item'}</small></div>`;
}

function computeGalleryColumns(itemCount, maxCols = 5, minCols = 2) {
  let best = maxCols, bestGap = Infinity;
  for (let c = maxCols; c >= minCols; c--) {
    const rem = itemCount % c;
    const gap = rem === 0 ? 0 : c - rem;
    if (gap < bestGap) { bestGap = gap; best = c; }
    if (gap === 0) break;
  }
  return best;
}

window.load_gallery = async function () {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading gallery…</div>';
  try {
    const { data } = await api.gallery.getAll();
    const apiItems = Array.isArray(data) ? data : [];
    const galleryItems = [
      ...defaultGalleryItems,
      ...apiItems.filter(item => !defaultGalleryItems.some(defaultItem => defaultItem.filePath === item.filePath)),
    ];

    if (!galleryItems.length) { grid.innerHTML = '<p class="empty-state">Gallery coming soon. Photos will be uploaded here.</p>'; return; }

    const groupedItems = galleryItems.reduce((groups, item) => {
      const key = item.description || item.title || 'Featured Moments';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
    const groupEntries = Object.entries(groupedItems);

    grid.innerHTML = `
      ${groupEntries.map(([caption, items], groupIdx) => `
        <div class="gallery-group">
          <div class="gallery-group-header" onclick="toggleGalleryGroup(this)">
            <span>📸 ${caption}</span>
            <span class="gallery-toggle">▾</span>
          </div>
          <div class="gallery-group-body" data-cols="${computeGalleryColumns(items.length, 5)}" data-cols-md="${computeGalleryColumns(items.length, 3)}" data-cols-sm="${computeGalleryColumns(items.length, 2)}">
            ${items.map((item, itemIdx) => `
              <div class="gallery-item ${isVideoGalleryItem(item) ? 'video-item' : ''}" onclick="openGalleryItem(${groupIdx}, ${itemIdx})">
                ${getGalleryMediaMarkup(item)}
              </div>`).join('')}
          </div>
        </div>`).join('')}`;
    renderGalleryModal(groupEntries.map(([, items]) => items));
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load gallery. ${err.message}</p>`;
  }
};

window.toggleGalleryGroup = function(header) {
  const group = header.parentElement;
  if (!group) return;
  group.classList.toggle('open');
};

function renderGalleryModal(groups) {
  window.__galleryGroups = groups;
  if (document.getElementById('gallery-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'gallery-modal';
  modal.className = 'gallery-modal';
  modal.innerHTML = `
    <button class="gallery-modal-nav gallery-modal-prev" onclick="galleryModalNav(-1)" aria-label="Previous image">‹</button>
    <button class="gallery-modal-nav gallery-modal-next" onclick="galleryModalNav(1)" aria-label="Next image">›</button>
    <div class="gallery-modal-box">
      <button class="gallery-modal-close" onclick="closeGalleryModal()" aria-label="Close">✕</button>
      <div class="gallery-modal-body">
        <img id="gallery-modal-image" class="gallery-modal-image" src="" alt="">
        <h3 id="gallery-modal-title" class="gallery-modal-title"></h3>
        <p id="gallery-modal-caption" class="gallery-modal-caption"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'gallery-modal') closeGalleryModal();
  });
  document.addEventListener('keydown', (e) => {
    const m = document.getElementById('gallery-modal');
    if (!m || !m.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') galleryModalNav(-1);
    else if (e.key === 'ArrowRight') galleryModalNav(1);
    else if (e.key === 'Escape') closeGalleryModal();
  });
}

function getGalleryModalMediaMarkup(item) {
  const safeTitle = (item.title || 'Video').replace(/"/g, '&quot;');
  if (isVideoGalleryItem(item)) {
    const src = item.videoUrl || item.filePath || '';
    const youtubeMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/i);
    if (youtubeMatch) {
      return `<iframe id="gallery-modal-image" class="gallery-modal-image" src="https://www.youtube.com/embed/${youtubeMatch[1]}" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (vimeoMatch) {
      return `<iframe id="gallery-modal-image" class="gallery-modal-image" src="https://player.vimeo.com/video/${vimeoMatch[1]}" title="${safeTitle}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    const safeSrc = src.replace(/'/g, '%27');
    return `<iframe id="gallery-modal-image" class="gallery-modal-image" srcdoc="<video controls playsinline preload='metadata' style='width:100%;height:100%;object-fit:cover;background:#0e2e1e;' src='${safeSrc}'></video>" title="${safeTitle}" loading="lazy"></iframe>`;
  }
  return `<img id="gallery-modal-image" class="gallery-modal-image" src="${item.filePath || ''}" alt="${(item.title || 'Gallery item').replace(/"/g, '&quot;')}">`;
}

function showGalleryItem(groupIdx, itemIdx) {
  const groups = window.__galleryGroups || [];
  const group = groups[groupIdx];
  const item = group && group[itemIdx];
  if (!item) return;

  window.__galleryCurrentGroupIdx = groupIdx;
  window.__galleryCurrentItemIdx = itemIdx;

  const modal = document.getElementById('gallery-modal');
  const title = document.getElementById('gallery-modal-title');
  const caption = document.getElementById('gallery-modal-caption');
  const mediaEl = document.getElementById('gallery-modal-image');
  if (!modal || !title || !caption || !mediaEl) return;

  mediaEl.outerHTML = getGalleryModalMediaMarkup(item);
  title.textContent = item.title || 'Gallery item';
  caption.textContent = item.description || item.title || '';

  const showNav = group.length > 1;
  const prevBtn = modal.querySelector('.gallery-modal-prev');
  const nextBtn = modal.querySelector('.gallery-modal-next');
  if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
  if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';

  modal.classList.add('open');
}

window.openGalleryItem = function(groupIdx, itemIdx) {
  showGalleryItem(groupIdx, itemIdx);
};

window.galleryModalNav = function(direction) {
  const groups = window.__galleryGroups || [];
  const group = groups[window.__galleryCurrentGroupIdx];
  if (!group) return;
  let newIdx = window.__galleryCurrentItemIdx + direction;
  if (newIdx < 0) newIdx = group.length - 1;
  if (newIdx >= group.length) newIdx = 0;
  showGalleryItem(window.__galleryCurrentGroupIdx, newIdx);
};

window.closeGalleryModal = function() {
  const modal = document.getElementById('gallery-modal');
  if (modal) modal.classList.remove('open');
  // Stop any playing video by clearing the iframe's src
  const mediaEl = document.getElementById('gallery-modal-image');
  if (mediaEl && mediaEl.tagName === 'IFRAME') mediaEl.src = '';
};

// ============================================================
// pages/downloads.js
// ============================================================
window.load_downloads = async function () {
  const grid = document.getElementById('downloads-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading documents…</div>';
  try {
    const { data } = await api.downloads.getAll();
    if (!data.length) { grid.innerHTML = '<p class="empty-state">No documents available yet.</p>'; return; }
    const icons = { pdf:'📄', docx:'📝', xlsx:'📊', image:'🖼️' };
    grid.innerHTML = data.map(d => `
      <div class="download-card">
        <div class="dl-icon">${icons[d.fileType] || '📄'}</div>
        <div class="dl-info">
          <h4>${d.title}</h4>
          <p>${d.description || ''}</p>
          ${d.fileSize ? `<span class="dl-size">${d.fileSize} · ${d.downloadCount} views</span>` : ''}
          <button type="button" class="dl-btn" onclick='viewDocument(${jsAttr(d._id)}, ${jsAttr(d.title)}, ${jsAttr(d.filePath)})'>👁 View Document</button>
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<p class="error-state">Could not load documents. ${err.message}</p>`;
  }
};

window.viewDocument = async function(id, title, path) {
  const modal = document.getElementById('doc-modal');
  const frame = document.getElementById('doc-modal-frame');
  const titleEl = document.getElementById('doc-modal-title');
  if (!modal || !frame) return;
  titleEl.textContent = title || 'Document';
  // Most mobile browsers (iOS Safari, mobile Chrome) have no built-in PDF
  // renderer for iframes — a direct #toolbar=0 embed only works on desktop
  // browsers with a native PDF plugin (Chrome/Edge). Google's viewer renders
  // the PDF as a web page instead, so it works consistently on every device.
  frame.src = `https://docs.google.com/viewer?url=${encodeURIComponent(path)}&embedded=true`;
  modal.classList.add('open');
  try { await api.downloads.trackGet(id); } catch {}
};

window.closeDocViewer = function() {
  const modal = document.getElementById('doc-modal');
  const frame = document.getElementById('doc-modal-frame');
  if (modal) modal.classList.remove('open');
  if (frame) frame.src = ''; // stop loading / free memory once closed
};

// ============================================================
// pages/faq.js — accordion (static + can load from settings)
// ============================================================
window.load_faq = async function () {
  // FAQ accordion is static HTML — just ensure toggles work
  document.querySelectorAll('.faq-q').forEach(q => {
    q.onclick = function() {
      const item = this.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    };
  });
};

// ============================================================
// pages/contact.js
// ============================================================
window.load_contact = async function () {
  // Populate LGA dropdown from API
  try {
    const { data: lgas } = await api.lgas.getAll();
    const sel = document.getElementById('contact-lga-select');
    if (sel && lgas.length) {
      sel.innerHTML = '<option value="">-- Select LGA (optional) --</option>' +
        lgas.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    }
  } catch {}
};

window.submitContactForm = async function () {
  const btn = document.getElementById('contact-submit-btn');
  const success = document.getElementById('contact-success');
  const error   = document.getElementById('contact-error');

  const data = {
    fullName: document.getElementById('contact-name')?.value?.trim(),
    phone:    document.getElementById('contact-phone')?.value?.trim(),
    email:    document.getElementById('contact-email')?.value?.trim(),
    lga:      document.getElementById('contact-lga-select')?.value || undefined,
    subject:  document.getElementById('contact-subject')?.value,
    message:  document.getElementById('contact-message')?.value?.trim(),
  };

  if (!data.fullName || !data.message) {
    if (error) { error.textContent = 'Name and message are required.'; error.style.display = 'block'; }
    return;
  }

  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await api.inquiries.submit(data);
    if (success) success.style.display = 'block';
    if (error)   error.style.display   = 'none';
    document.getElementById('contact-form-el')?.reset();
  } catch (err) {
    if (error) { error.textContent = err.message; error.style.display = 'block'; }
  } finally {
    btn.disabled = false; btn.textContent = 'Send Inquiry →';
  }
};

// ============================================================
// pages/login.js
// ============================================================
window.load_login = function () {
  if (Auth.isLoggedIn() && Auth.isAdmin()) {
    Router.navigate('admin');
  }
};

window.submitLogin = async function () {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Email and password are required.'; errEl.style.display = 'block'; }
    return;
  }

  btn.disabled = true; btn.textContent = 'Logging in…';
  try {
    const user = await Auth.login(email, password);
    renderNavForRole();
    if (errEl) errEl.style.display = 'none';
    Router.navigate(Auth.isAdmin() ? 'admin' : 'home');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Invalid credentials.'; errEl.style.display = 'block'; }
  } finally {
    btn.disabled = false; btn.textContent = 'Login →';
  }
};

// ============================================================
// pages/admin.js
// ============================================================
// Admin panel is single-page-with-tabs: only one .admin-panel is shown at a
// time (picked via the sidebar), instead of one long scrolling page.
window.showAdminPanel = function (panelId, linkId) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.admin-sidebar a[id^="sidebar-link-"]').forEach(a => a.classList.remove('active'));
  const link = document.getElementById(linkId);
  if (link) link.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // On mobile the sidebar is a full-screen overlay — selecting a panel closes it
  document.getElementById('admin-sidebar')?.classList.remove('open');
};

window.toggleAdminSidebar = function () {
  document.getElementById('admin-sidebar')?.classList.toggle('open');
};

window.load_admin = async function () {
  if (!Auth.isAdmin()) { Router.navigate('login'); return; }

  const user = Auth.getUser();
  setText('admin-username', user?.fullName || 'Admin');

  applyRoleBasedAdminVisibility();

  // Land on Dashboard for super_admin, or the first panel an admin/staff
  // account actually has access to.
  if (Auth.isSuperAdmin()) {
    showAdminPanel('admin-dashboard-wrap', 'sidebar-link-dashboard');
  } else {
    showAdminPanel('admin-panel-chairman', 'sidebar-link-chairman');
  }

  // Inquiries inbox is visible to admin and staff too, so it's loaded
  // independently rather than inside the super_admin-only stats below.
  loadInquiriesTab('inbox', 1);

  // Load photo upload UI for chairman
  loadChairmanPhotoUpload();

  // Load ticker messages
  loadTickerAdmin();

  // Load election countdown settings
  loadElectionCountdownAdmin();

  // Load live stream settings
  loadLiveStreamAdmin();

  // Load gallery management list
  loadAdminGalleryList();

  // Load publications & news/notice management lists
  loadAdminDownloadsList();
  loadAdminNewsList();

  if (Auth.isSuperAdmin()) {
    // Dashboard stats (elections/results counts — super_admin only section)
    try {
      const [electionsRes, resultsRes, newsRes] = await Promise.all([
        api.elections.getAll(),
        api.results.getAll(),
        api.news.getAll(),
      ]);
      setText('admin-stat-elections', electionsRes.count || 0);
      setText('admin-stat-results',   resultsRes.count   || 0);
      setText('admin-stat-news',      newsRes.count      || 0);
    } catch (err) {
      console.warn('[admin] Dashboard stats load error:', err.message);
    }

    // Elections/candidates/results management UI
    initPartyDropdown();
    loadLGAsIntoAdminSelects();
    loadAdminElections();
    loadAdminResultsList();

    // Manage admin accounts
    loadAdminUsersList();

    // Admin activity / login log
    applyActivityLogVisibility();
    loadAdminLogSummary();
    loadAdminLogTable();
  }
};

function applyRoleBasedAdminVisibility() {
  const isSuper = Auth.isSuperAdmin();
  const superOnlyIds = [
    'admin-elections-wrap', 'admin-dashboard-wrap', 'admin-security-wrap', 'admin-manage-users-wrap',
    'sidebar-link-elections', 'sidebar-link-dashboard', 'sidebar-link-security', 'sidebar-link-manage-admins',
  ];
  superOnlyIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSuper ? '' : 'none';
  });
}

// ============================================================
// Admin — Manage Admin Accounts (super_admin only)
// ============================================================
window.createAdminUser = async function () {
  const msg = document.getElementById('newadmin-msg');
  const reveal = document.getElementById('newadmin-password-reveal');
  const editId = document.getElementById('newadmin-edit-id').value;
  const fullName = document.getElementById('newadmin-name').value.trim();
  const email = document.getElementById('newadmin-email').value.trim();
  const password = document.getElementById('newadmin-password').value;
  const role = document.getElementById('newadmin-role').value;

  if (reveal) reveal.style.display = 'none';

  if (!fullName || !email) { if (msg) msg.textContent = '❌ Name and email are required.'; return; }
  if (!editId && !password) { if (msg) msg.textContent = '❌ Password is required for a new account.'; return; }
  if (password && password.length < 8) { if (msg) msg.textContent = '❌ Password must be at least 8 characters.'; return; }

  try {
    if (editId) {
      if (msg) msg.textContent = 'Updating…';
      await api.auth.updateUser(editId, { fullName, email, role, password: password || undefined });
      if (msg) msg.textContent = '✅ Account updated.';
      if (password && reveal) {
        // Passwords are bcrypt-hashed and can never be read back from storage —
        // this is the only moment it's shown, so it can be copied down now.
        reveal.style.display = 'block';
        reveal.innerHTML = `🔑 New password for <strong>${email}</strong>: <code>${password}</code><br><span style="font-size:11px;">Save this now — it cannot be retrieved again later.</span>`;
      }
      cancelAdminUserEdit();
    } else {
      if (msg) msg.textContent = 'Creating…';
      await api.auth.register({ fullName, email, password, role });
      if (msg) msg.textContent = '✅ Account created.';
      if (reveal) {
        reveal.style.display = 'block';
        reveal.innerHTML = `🔑 Password for <strong>${email}</strong>: <code>${password}</code><br><span style="font-size:11px;">Save this now — it cannot be retrieved again later.</span>`;
      }
      document.getElementById('newadmin-name').value = '';
      document.getElementById('newadmin-email').value = '';
      document.getElementById('newadmin-password').value = '';
      document.getElementById('newadmin-role').value = 'admin';
    }
    loadAdminUsersList();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff', voter: 'Voter' };
let adminUsersCache = [];

async function loadAdminUsersList() {
  const el = document.getElementById('admin-users-list');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading accounts…</div>';
  try {
    const { data: users } = await api.auth.users();
    adminUsersCache = users;
    const me = Auth.getUser();
    el.innerHTML = `
      <h4 style="font-family:var(--font-display);color:var(--green);margin-bottom:10px">Existing Accounts</h4>
      <div class="admin-table">
        <div class="admin-table-head" style="grid-template-columns:1.1fr 1.5fr .8fr .7fr 1.6fr;"><div>Name</div><div>Email</div><div>Role</div><div>Status</div><div>Actions</div></div>
        ${users.map(u => `
          <div class="admin-table-row" style="grid-template-columns:1.1fr 1.5fr .8fr .7fr 1.6fr;">
            <div>${u.fullName}${u._id === me?._id ? ' (you)' : ''}</div>
            <div style="font-size:12px;">${u.email}</div>
            <div>${ROLE_LABELS[u.role] || u.role}</div>
            <div><span class="${u.isActive ? 'badge-active' : 'badge-pending'}">${u.isActive ? 'active' : 'disabled'}</span></div>
            <div>
              <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="editAdminUser('${u._id}')">Edit</button>
              ${u._id === me?._id ? '' : `<button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:6px;" onclick="toggleUserActive('${u._id}')">${u.isActive ? 'Disable' : 'Enable'}</button>`}
              ${u.lockUntil && new Date(u.lockUntil) > new Date() ? `<button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:6px;" onclick="unlockUserAccount('${u._id}')">Unlock</button>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="error-state">Could not load accounts. ${err.message}</p>`;
  }
}

window.editAdminUser = function (id) {
  const u = adminUsersCache.find(x => x._id === id);
  if (!u) return;
  document.getElementById('newadmin-edit-id').value = id;
  document.getElementById('newadmin-name').value = u.fullName || '';
  document.getElementById('newadmin-email').value = u.email || '';
  document.getElementById('newadmin-role').value = u.role || 'admin';
  document.getElementById('newadmin-password').value = '';
  document.getElementById('newadmin-password').placeholder = 'Leave blank to keep current password';
  document.getElementById('newadmin-password-label').textContent = 'New Password (optional)';
  document.getElementById('newadmin-submit-btn').textContent = 'Update Account';
  document.getElementById('newadmin-cancel-btn').style.display = 'inline-flex';
  document.getElementById('newadmin-password-reveal').style.display = 'none';
  document.getElementById('newadmin-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelAdminUserEdit = function () {
  document.getElementById('newadmin-edit-id').value = '';
  document.getElementById('newadmin-name').value = '';
  document.getElementById('newadmin-email').value = '';
  document.getElementById('newadmin-password').value = '';
  document.getElementById('newadmin-password').placeholder = 'Min. 8 characters';
  document.getElementById('newadmin-password-label').textContent = 'Password';
  document.getElementById('newadmin-role').value = 'admin';
  document.getElementById('newadmin-submit-btn').textContent = 'Create Account';
  document.getElementById('newadmin-cancel-btn').style.display = 'none';
};

window.toggleUserActive = async function (id) {
  try {
    await api.auth.toggleUser(id);
    loadAdminUsersList();
  } catch (err) {
    alert('Could not update account: ' + err.message);
  }
};

window.unlockUserAccount = async function (id) {
  try {
    await api.auth.unlockUser(id);
    loadAdminUsersList();
  } catch (err) {
    alert('Could not unlock account: ' + err.message);
  }
};

// ============================================================
// Admin — Publications upload
// ============================================================
let adminDownloadsCache = [];

window.uploadPublication = async function () {
  const msg = document.getElementById('pub-msg');
  const editId = document.getElementById('pub-edit-id').value;
  const title = document.getElementById('pub-title').value.trim();
  const fileInput = document.getElementById('pub-file');
  if (!title) { if (msg) msg.textContent = '❌ Title is required.'; return; }
  if (!editId && !fileInput.files.length) { if (msg) msg.textContent = '❌ Please select a file.'; return; }

  try {
    if (editId) {
      if (msg) msg.textContent = 'Updating…';
      await api.downloads.update(editId, {
        title,
        description: document.getElementById('pub-description').value.trim(),
        category: document.getElementById('pub-category').value,
      });
      if (msg) msg.textContent = '✅ Publication updated.';
      cancelPublicationEdit();
    } else {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', document.getElementById('pub-description').value.trim());
      fd.append('category', document.getElementById('pub-category').value);
      fd.append('document', fileInput.files[0]);
      if (msg) msg.textContent = 'Uploading…';
      await api.downloads.create(fd);
      if (msg) msg.textContent = '✅ Publication uploaded.';
      document.getElementById('pub-title').value = '';
      document.getElementById('pub-description').value = '';
      fileInput.value = '';
    }
    loadAdminDownloadsList();
  } catch (err) {
    if (msg) msg.textContent = '❌ ' + (editId ? 'Update' : 'Upload') + ' failed: ' + err.message;
  }
};

async function loadAdminDownloadsList() {
  const el = document.getElementById('pub-list');
  if (!el) return;
  try {
    const { data } = await api.downloads.getAll();
    adminDownloadsCache = data;
    if (!data.length) { el.innerHTML = '<p class="empty-state">No publications uploaded yet.</p>'; return; }
    el.innerHTML = `
      <h4 style="font-family:var(--font-display);color:var(--green);margin-bottom:10px">Existing Publications</h4>
      <div class="admin-table">
        <div class="admin-table-head"><div>Title</div><div>Category</div><div>Size</div><div>Actions</div></div>
        ${data.map(d => `
          <div class="admin-table-row">
            <div>${d.title}</div>
            <div>${(d.category || '').replace(/_/g, ' ')}</div>
            <div>${d.fileSize || '—'}</div>
            <div>
              <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="editPublication('${d._id}')">Edit</button>
              <button class="btn-danger" style="margin-left:6px" onclick="deletePublicationAdmin('${d._id}')">Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    console.warn('[admin] Could not load publications:', err.message);
  }
}

window.editPublication = function (id) {
  const d = adminDownloadsCache.find(x => x._id === id);
  if (!d) return;
  document.getElementById('pub-edit-id').value = id;
  document.getElementById('pub-title').value = d.title || '';
  document.getElementById('pub-description').value = d.description || '';
  document.getElementById('pub-category').value = d.category || 'other';
  document.getElementById('pub-file-hint').textContent = '(leave blank to keep the existing file)';
  document.getElementById('pub-submit-btn').textContent = 'Update Publication';
  document.getElementById('pub-cancel-btn').style.display = 'inline-flex';
  document.getElementById('pub-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelPublicationEdit = function () {
  document.getElementById('pub-edit-id').value = '';
  document.getElementById('pub-title').value = '';
  document.getElementById('pub-description').value = '';
  document.getElementById('pub-category').value = 'other';
  document.getElementById('pub-file').value = '';
  document.getElementById('pub-file-hint').textContent = '';
  document.getElementById('pub-submit-btn').textContent = 'Upload Publication';
  document.getElementById('pub-cancel-btn').style.display = 'none';
};

window.deletePublicationAdmin = async function (id) {
  if (!confirm('Delete this publication? This cannot be undone.')) return;
  try {
    await api.downloads.delete(id);
    loadAdminDownloadsList();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

// ============================================================
// Admin — Gallery photo groups
// ============================================================
let adminGalleryCache = [];

window.uploadGalleryGroup = async function () {
  const msg = document.getElementById('gal-msg');
  const title = document.getElementById('gal-title').value.trim();
  const category = document.getElementById('gal-category').value;
  const filesInput = document.getElementById('gal-files');
  if (!title) { if (msg) msg.textContent = '❌ Group title is required.'; return; }
  if (!filesInput.files.length) { if (msg) msg.textContent = '❌ Select at least one photo.'; return; }

  const files = [...filesInput.files];
  let uploaded = 0;
  try {
    for (const file of files) {
      msg.textContent = `Uploading ${uploaded + 1} of ${files.length}…`;
      const fd = new FormData();
      fd.append('title', title);
      fd.append('category', category);
      fd.append('mediaType', 'photo');
      fd.append('galleryImage', file);
      await api.gallery.create(fd);
      uploaded++;
    }
    if (msg) msg.textContent = `✅ Uploaded ${uploaded} photo(s) to "${title}".`;
    document.getElementById('gal-title').value = '';
    filesInput.value = '';
    loadAdminGalleryList();
  } catch (err) {
    if (msg) msg.textContent = `❌ Uploaded ${uploaded} of ${files.length} before failing: ${err.message}`;
    loadAdminGalleryList();
  }
};

async function loadAdminGalleryList() {
  const el = document.getElementById('gal-list');
  if (!el) return;
  try {
    const { data } = await api.gallery.getAll();
    adminGalleryCache = data;
    if (!data.length) { el.innerHTML = '<p class="empty-state">No gallery photos uploaded yet.</p>'; return; }

    const groups = data.reduce((acc, item) => {
      const key = item.description || item.title || 'Untitled';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    el.innerHTML = `
      <h4 style="font-family:var(--font-display);color:var(--green);margin-bottom:10px">Existing Photo Groups</h4>
      <div class="admin-table">
        <div class="admin-table-head"><div>Group Title</div><div>Category</div><div>Photos</div><div>Actions</div></div>
        ${Object.entries(groups).map(([title, items]) => `
          <div class="admin-table-row">
            <div>${title}</div>
            <div>${(items[0].category || '').replace(/_/g, ' ')}</div>
            <div>${items.length}</div>
            <div>
              <button class="btn-danger" onclick='deleteGalleryGroup(${jsAttr(title)})'>Delete Group</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    console.warn('[admin] Could not load gallery list:', err.message);
  }
}

window.deleteGalleryGroup = async function (title) {
  const items = adminGalleryCache.filter(i => (i.description || i.title || 'Untitled') === title);
  if (!items.length) return;
  if (!confirm(`Delete all ${items.length} photo(s) in "${title}"? This cannot be undone.`)) return;
  try {
    await Promise.all(items.map(i => api.gallery.delete(i._id)));
    loadAdminGalleryList();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

// ============================================================
// Admin — Post News / Notice
// ============================================================
let adminNewsCache = [];

window.extractNoticeFromLink = async function () {
  const status = document.getElementById('notice-link-status');
  const url = document.getElementById('notice-link-url').value.trim();
  if (!url) { if (status) status.textContent = '❌ Paste a link first.'; return; }

  const btn = document.getElementById('notice-extract-btn');
  btn.disabled = true; btn.textContent = 'Extracting…';
  if (status) status.textContent = '';

  try {
    const { data } = await api.news.extractLink(url);

    if (data.title) document.getElementById('notice-title').value = data.title;
    if (data.excerpt) document.getElementById('notice-excerpt').value = data.excerpt;

    if (data.isVideo) {
      document.getElementById('notice-video-url').value = data.videoUrl || url;
      const safeTitle = (data.title || 'Video').replace(/"/g, '&quot;');
      const youtubeMatch = (data.videoUrl || url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
      const vimeoMatch = (data.videoUrl || url).match(/vimeo\.com\/(\d+)/i);
      let embed = '';
      if (youtubeMatch) {
        embed = `<div style="position:relative;padding-top:56.25%;height:0;overflow:hidden;border-radius:8px;margin-bottom:16px;"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" title="${safeTitle}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      } else if (vimeoMatch) {
        embed = `<div style="position:relative;padding-top:56.25%;height:0;overflow:hidden;border-radius:8px;margin-bottom:16px;"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" title="${safeTitle}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      }
      document.getElementById('notice-content').value = embed + (data.excerpt ? `<p>${data.excerpt}</p>` : '');
    } else {
      let hostname = '';
      try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      document.getElementById('notice-content').value =
        `<p>${data.excerpt || ''}</p><p>📰 <strong>Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${hostname}</a></p><p><a class="btn-primary" href="${url}" target="_blank" rel="noopener noreferrer">Read Full Story →</a></p>`;
    }

    const preview = document.getElementById('notice-link-preview');
    const previewImg = document.getElementById('notice-link-preview-img');
    document.getElementById('notice-extracted-image').value = data.image || '';
    if (data.image) {
      previewImg.src = data.image;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }

    if (status) status.textContent = '✅ Extracted — review the fields below before posting.';
  } catch (err) {
    if (status) status.textContent = '❌ Extraction failed: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Extract';
  }
};

window.postNotice = async function () {
  const msg = document.getElementById('notice-msg');
  const editId = document.getElementById('notice-edit-id').value;
  const title = document.getElementById('notice-title').value.trim();
  const content = document.getElementById('notice-content').value.trim();
  if (!title) { if (msg) msg.textContent = '❌ Title is required.'; return; }
  if (!content) { if (msg) msg.textContent = '❌ Content is required.'; return; }

  const fd = new FormData();
  fd.append('title', title);
  fd.append('excerpt', document.getElementById('notice-excerpt').value.trim());
  fd.append('content', content);
  fd.append('category', document.getElementById('notice-category').value);
  fd.append('status', document.getElementById('notice-publish-now').checked ? 'published' : 'draft');
  const imgInput = document.getElementById('notice-image');
  const extractedImage = document.getElementById('notice-extracted-image').value;
  if (imgInput.files.length) {
    fd.append('featuredImage', imgInput.files[0]);
  } else if (extractedImage) {
    fd.append('featuredImage', extractedImage);
  }

  try {
    if (editId) {
      if (msg) msg.textContent = 'Updating…';
      await api.news.update(editId, fd);
      if (msg) msg.textContent = '✅ Notice updated.';
      cancelNoticeEdit();
    } else {
      if (msg) msg.textContent = 'Posting…';
      await api.news.create(fd);
      if (msg) msg.textContent = '✅ Notice posted.';
      document.getElementById('notice-title').value = '';
      document.getElementById('notice-excerpt').value = '';
      document.getElementById('notice-content').value = '';
      imgInput.value = '';
      document.getElementById('notice-link-url').value = '';
      document.getElementById('notice-extracted-image').value = '';
      document.getElementById('notice-video-url').value = '';
      document.getElementById('notice-link-preview').style.display = 'none';
      document.getElementById('notice-link-status').textContent = '';
    }
    loadAdminNewsList();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

async function loadAdminNewsList() {
  const el = document.getElementById('notice-list');
  if (!el) return;
  try {
    const { data } = await api.news.getAll();
    adminNewsCache = data;
    if (!data.length) { el.innerHTML = '<p class="empty-state">No news/notices posted yet.</p>'; return; }
    el.innerHTML = `
      <h4 style="font-family:var(--font-display);color:var(--green);margin-bottom:10px">Existing News & Notices</h4>
      <div class="admin-table">
        <div class="admin-table-head"><div>Title</div><div>Category</div><div>Status</div><div>Actions</div></div>
        ${data.map(a => `
          <div class="admin-table-row">
            <div>${a.title}</div>
            <div>${(a.category || '').replace(/_/g, ' ')}</div>
            <div><span class="${a.status === 'published' ? 'badge-active' : 'badge-pending'}">${a.status}</span></div>
            <div>
              <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="editNotice('${a._id}')">Edit</button>
              ${a.status !== 'published' ? `<button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:6px;" onclick="publishNoticeAdmin('${a._id}')">Publish</button>` : ''}
              <button class="btn-danger" style="margin-left:6px" onclick="deleteNoticeAdmin('${a._id}')">Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    console.warn('[admin] Could not load news list:', err.message);
  }
}

window.editNotice = async function (id) {
  const msg = document.getElementById('notice-msg');
  try {
    const { data: a } = await api.news.getOneById(id);
    document.getElementById('notice-edit-id').value = id;
    document.getElementById('notice-title').value = a.title || '';
    document.getElementById('notice-category').value = a.category || 'announcement';
    document.getElementById('notice-excerpt').value = a.excerpt || '';
    document.getElementById('notice-content').value = a.content || '';
    document.getElementById('notice-publish-now').checked = a.status === 'published';
    document.getElementById('notice-submit-btn').textContent = 'Update Notice';
    document.getElementById('notice-cancel-btn').style.display = 'inline-flex';
    document.getElementById('notice-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    if (msg) msg.textContent = '❌ Could not load article: ' + err.message;
  }
};

window.cancelNoticeEdit = function () {
  document.getElementById('notice-edit-id').value = '';
  document.getElementById('notice-title').value = '';
  document.getElementById('notice-excerpt').value = '';
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-image').value = '';
  document.getElementById('notice-category').value = 'announcement';
  document.getElementById('notice-publish-now').checked = true;
  document.getElementById('notice-submit-btn').textContent = 'Post Notice';
  document.getElementById('notice-cancel-btn').style.display = 'none';
  document.getElementById('notice-link-url').value = '';
  document.getElementById('notice-extracted-image').value = '';
  document.getElementById('notice-video-url').value = '';
  document.getElementById('notice-link-preview').style.display = 'none';
  document.getElementById('notice-link-status').textContent = '';
};

window.publishNoticeAdmin = async function (id) {
  try {
    await api.news.publish(id);
    loadAdminNewsList();
  } catch (err) {
    alert('Could not publish: ' + err.message);
  }
};

window.deleteNoticeAdmin = async function (id) {
  if (!confirm('Delete this article? This cannot be undone.')) return;
  try {
    await api.news.delete(id);
    loadAdminNewsList();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

// ============================================================
// Admin — Elections, Candidates & Results Management
// ============================================================
// NOTE: This list reflects INEC's major registered parties as of recent
// records. Party registration changes over time — verify against INEC's
// current published list before an actual election; use "Other" for
// anything not listed here.
const NIGERIAN_PARTIES = [
  ['APC', 'All Progressives Congress (APC)'],
  ['PDP', 'Peoples Democratic Party (PDP)'],
  ['LP', 'Labour Party (LP)'],
  ['NNPP', 'New Nigeria Peoples Party (NNPP)'],
  ['APGA', 'All Progressives Grand Alliance (APGA)'],
  ['SDP', 'Social Democratic Party (SDP)'],
  ['ADC', 'African Democratic Congress (ADC)'],
  ['YPP', 'Young Progressives Party (YPP)'],
  ['A', 'Accord (A)'],
  ['AA', 'Action Alliance (AA)'],
  ['APP', 'Action Peoples Party (APP)'],
  ['AAC', 'African Action Congress (AAC)'],
  ['APM', 'Allied Peoples Movement (APM)'],
  ['BP', 'Boot Party (BP)'],
  ['NRM', 'National Rescue Movement (NRM)'],
  ['PRP', 'Peoples Redemption Party (PRP)'],
  ['ZLP', 'Zenith Labour Party (ZLP)'],
];

function initPartyDropdown() {
  const sel = document.getElementById('cand-party');
  if (!sel || sel.dataset.loaded) return;
  sel.innerHTML = NIGERIAN_PARTIES.map(([code, label]) => `<option value="${code}">${label}</option>`).join('')
    + '<option value="OTHER">Other (specify)</option>';
  sel.dataset.loaded = 'true';
}

window.togglePartyOther = function (selectId, wrapId) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === 'OTHER' ? 'block' : 'none';
};

async function loadLGAsIntoAdminSelects() {
  const candSel = document.getElementById('cand-lga');
  const resSel = document.getElementById('res-lga');
  if (!candSel && !resSel) return;
  try {
    const { data } = await api.lgas.getAll();
    const options = data.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    if (candSel && !candSel.dataset.loaded) { candSel.innerHTML += options; candSel.dataset.loaded = 'true'; }
    if (resSel && !resSel.dataset.loaded) { resSel.innerHTML += options; resSel.dataset.loaded = 'true'; }
  } catch (err) {
    console.warn('[admin] Could not load LGAs:', err.message);
  }
}

window.toggleCandidateFields = function () {
  const position = document.getElementById('cand-position').value;
  document.getElementById('cand-ward-wrap').style.display = position === 'councillor' ? 'block' : 'none';
  document.getElementById('cand-running-mate-wrap').style.display = position === 'chairman' ? 'block' : 'none';
};

window.toggleResultFields = function () {
  const position = document.getElementById('res-position').value;
  document.getElementById('res-ward-wrap').style.display = position === 'councillor' ? 'block' : 'none';
};

let adminSelectedElectionId = '';

let adminElectionsCache = [];

async function loadAdminElections() {
  const sel = document.getElementById('el-select');
  const listEl = document.getElementById('el-list');
  if (!sel && !listEl) return;
  try {
    const { data } = await api.elections.getAll();
    adminElectionsCache = data;

    if (sel) {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— Select an election —</option>'
        + data.map(e => `<option value="${e._id}">${e.title} (${e.year})</option>`).join('');
      if (data.some(e => e._id === currentVal)) sel.value = currentVal;
    }

    if (listEl) {
      if (!data.length) {
        listEl.innerHTML = '<p class="empty-state">No elections created yet.</p>';
      } else {
        listEl.innerHTML = `
          <div class="admin-table">
            <div class="admin-table-head"><div>Title</div><div>Type</div><div>Date</div><div>Actions</div></div>
            ${data.map(e => `
              <div class="admin-table-row">
                <div>${e.title}</div>
                <div>${(e.type || '').replace(/_/g, ' ')}</div>
                <div>${new Date(e.electionDate).toLocaleDateString('en-NG')}</div>
                <div>
                  <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="editElection('${e._id}')">Edit</button>
                  <button class="btn-danger" style="margin-left:6px" onclick="deleteElectionAdmin('${e._id}')">Delete</button>
                </div>
              </div>`).join('')}
          </div>`;
      }
    }
  } catch (err) {
    console.warn('[admin] Could not load elections:', err.message);
  }
}

window.createElection = async function () {
  const msg = document.getElementById('el-msg');
  const editId = document.getElementById('el-edit-id').value;
  const title = document.getElementById('el-title').value.trim();
  const year = document.getElementById('el-year').value;
  const electionDate = document.getElementById('el-date').value;
  if (!title || !year || !electionDate) { if (msg) msg.textContent = '❌ Title, year, and election date are required.'; return; }

  const fd = new FormData();
  fd.append('title', title);
  fd.append('type', document.getElementById('el-type').value);
  fd.append('year', year);
  fd.append('electionDate', electionDate);
  fd.append('isStatewideElection', document.getElementById('el-statewide').checked);

  try {
    if (editId) {
      if (msg) msg.textContent = 'Updating…';
      await api.elections.update(editId, fd);
      if (msg) msg.textContent = '✅ Election updated.';
      cancelElectionEdit();
    } else {
      if (msg) msg.textContent = 'Creating…';
      await api.elections.create(fd);
      if (msg) msg.textContent = '✅ Election created.';
      document.getElementById('el-title').value = '';
      document.getElementById('el-year').value = '';
      document.getElementById('el-date').value = '';
    }
    loadAdminElections();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

window.editElection = function (id) {
  const e = adminElectionsCache.find(x => x._id === id);
  if (!e) return;
  document.getElementById('el-edit-id').value = id;
  document.getElementById('el-title').value = e.title || '';
  document.getElementById('el-type').value = e.type || 'chairmanship';
  document.getElementById('el-year').value = e.year || '';
  document.getElementById('el-date').value = e.electionDate ? new Date(e.electionDate).toISOString().slice(0, 10) : '';
  document.getElementById('el-statewide').checked = e.isStatewideElection !== false;
  document.getElementById('el-submit-btn').textContent = 'Update Election';
  document.getElementById('el-cancel-btn').style.display = 'inline-flex';
  document.getElementById('el-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelElectionEdit = function () {
  document.getElementById('el-edit-id').value = '';
  document.getElementById('el-title').value = '';
  document.getElementById('el-year').value = '';
  document.getElementById('el-date').value = '';
  document.getElementById('el-type').value = 'chairmanship';
  document.getElementById('el-statewide').checked = true;
  document.getElementById('el-submit-btn').textContent = 'Create Election';
  document.getElementById('el-cancel-btn').style.display = 'none';
};

window.deleteElectionAdmin = async function (id) {
  if (!confirm('Delete this election? Associated candidates/results are not automatically removed. This cannot be undone.')) return;
  try {
    await api.elections.delete(id);
    loadAdminElections();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

window.onElectionSelected = function () {
  adminSelectedElectionId = document.getElementById('el-select').value;
  loadCandidatesList();
};

let adminCandidatesCache = [];

window.addCandidate = async function () {
  const msg = document.getElementById('cand-msg');
  const editId = document.getElementById('cand-edit-id').value;
  if (!adminSelectedElectionId) { if (msg) msg.textContent = '❌ Select an active election first.'; return; }

  const lga = document.getElementById('cand-lga').value;
  const fullName = document.getElementById('cand-name').value.trim();
  const position = document.getElementById('cand-position').value;
  const partySel = document.getElementById('cand-party').value;
  const party = partySel === 'OTHER' ? document.getElementById('cand-party-other').value.trim() : partySel;

  if (!lga || !fullName || !party) { if (msg) msg.textContent = '❌ LGA, party, and candidate name are required.'; return; }

  const fd = new FormData();
  fd.append('fullName', fullName);
  fd.append('party', party);
  fd.append('election', adminSelectedElectionId);
  fd.append('lga', lga);
  fd.append('position', position);
  if (position === 'councillor') fd.append('ward', document.getElementById('cand-ward').value.trim());
  if (position === 'chairman') fd.append('runningMate', document.getElementById('cand-running-mate').value.trim());
  const photoInput = document.getElementById('cand-photo');
  if (photoInput.files.length) fd.append('photo', photoInput.files[0]);

  try {
    if (editId) {
      if (msg) msg.textContent = 'Updating…';
      await api.candidates.update(editId, fd);
      if (msg) msg.textContent = '✅ Candidate updated.';
      cancelCandidateEdit();
    } else {
      if (msg) msg.textContent = 'Adding…';
      await api.candidates.create(fd);
      if (msg) msg.textContent = '✅ Candidate added.';
      document.getElementById('cand-name').value = '';
      document.getElementById('cand-ward').value = '';
      document.getElementById('cand-running-mate').value = '';
      photoInput.value = '';
    }
    loadCandidatesList();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

async function loadCandidatesList() {
  const el = document.getElementById('cand-list');
  if (!el) return;
  if (!adminSelectedElectionId) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="loading">Loading candidates…</div>';
  try {
    const { data } = await api.candidates.getAll(`?election=${adminSelectedElectionId}`);
    adminCandidatesCache = data;
    if (!data.length) { el.innerHTML = '<p class="empty-state">No candidates added yet for this election.</p>'; return; }
    const cols = 'grid-template-columns:1.3fr .9fr 1fr .9fr 1.5fr;';
    el.innerHTML = `
      <div class="admin-table">
        <div class="admin-table-head" style="${cols}"><div>Name</div><div>Party</div><div>LGA</div><div>Position</div><div>Actions</div></div>
        ${data.map(c => `
          <div class="admin-table-row" style="${cols}">
            <div>${c.fullName}</div>
            <div>${c.party}</div>
            <div>${c.lga?.name || '—'}${c.ward ? ' / ' + c.ward : ''}</div>
            <div>${c.position}</div>
            <div>
              <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="editCandidate('${c._id}')">Edit</button>
              ${Auth.isSuperAdmin() ? `<button class="btn-danger" style="margin-left:6px" onclick="deleteCandidateAdmin('${c._id}')">Delete</button>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="error-state">Could not load candidates. ${err.message}</p>`;
  }
}

window.editCandidate = function (id) {
  const c = adminCandidatesCache.find(x => x._id === id);
  if (!c) return;
  document.getElementById('cand-edit-id').value = id;
  document.getElementById('cand-lga').value = c.lga?._id || c.lga || '';
  document.getElementById('cand-position').value = c.position || 'chairman';
  toggleCandidateFields();
  const knownParty = NIGERIAN_PARTIES.some(([code]) => code === c.party);
  document.getElementById('cand-party').value = knownParty ? c.party : 'OTHER';
  togglePartyOther('cand-party', 'cand-party-other-wrap');
  if (!knownParty) document.getElementById('cand-party-other').value = c.party || '';
  document.getElementById('cand-name').value = c.fullName || '';
  document.getElementById('cand-ward').value = c.ward || '';
  document.getElementById('cand-running-mate').value = c.runningMate || '';
  document.getElementById('cand-submit-btn').textContent = 'Update Candidate';
  document.getElementById('cand-cancel-btn').style.display = 'inline-flex';
  document.getElementById('cand-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelCandidateEdit = function () {
  document.getElementById('cand-edit-id').value = '';
  document.getElementById('cand-name').value = '';
  document.getElementById('cand-ward').value = '';
  document.getElementById('cand-running-mate').value = '';
  document.getElementById('cand-photo').value = '';
  document.getElementById('cand-party-other').value = '';
  document.getElementById('cand-submit-btn').textContent = 'Add Candidate';
  document.getElementById('cand-cancel-btn').style.display = 'none';
};

window.deleteCandidateAdmin = async function (id) {
  if (!confirm('Delete this candidate? This cannot be undone.')) return;
  try {
    await api.candidates.delete(id);
    loadCandidatesList();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

let resultCandidatesCache = [];

window.loadCandidatesForResult = async function () {
  const msg = document.getElementById('res-msg');
  if (!adminSelectedElectionId) { if (msg) msg.textContent = '❌ Select an active election first (above).'; return; }
  const lga = document.getElementById('res-lga').value;
  const position = document.getElementById('res-position').value;
  if (!lga) { if (msg) msg.textContent = '❌ Select an LGA.'; return; }

  const el = document.getElementById('res-candidates-list');
  el.innerHTML = '<div class="loading">Loading candidates…</div>';
  try {
    const { data } = await api.candidates.getAll(`?election=${adminSelectedElectionId}&lga=${lga}&position=${position}`);
    resultCandidatesCache = data;
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">No candidates found for this election/LGA/position. Add candidates in section 2 first.</p>';
      return;
    }
    el.innerHTML = data.map(c => `
      <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <label style="flex:1;margin:0;text-transform:none;font-size:14px;color:var(--slate);font-weight:600;">${c.fullName} (${c.party})</label>
        <input type="number" min="0" data-candidate-id="${c._id}" class="res-vote-input" placeholder="Votes" style="width:140px;">
      </div>`).join('');
    if (msg) msg.textContent = '';
  } catch (err) {
    el.innerHTML = `<p class="error-state">Could not load candidates. ${err.message}</p>`;
  }
};

window.saveResult = async function (publish) {
  const msg = document.getElementById('res-msg');
  const editId = document.getElementById('res-edit-id').value;
  if (!adminSelectedElectionId) { if (msg) msg.textContent = '❌ Select an active election first (above).'; return; }
  const lga = document.getElementById('res-lga').value;
  const position = document.getElementById('res-position').value;
  if (!lga) { if (msg) msg.textContent = '❌ Select an LGA.'; return; }
  if (!resultCandidatesCache.length) { if (msg) msg.textContent = '❌ Load candidates first.'; return; }

  const voteInputs = document.querySelectorAll('.res-vote-input');
  const voteEntries = [];
  voteInputs.forEach(input => {
    const candidate = resultCandidatesCache.find(c => c._id === input.dataset.candidateId);
    if (!candidate) return;
    voteEntries.push({
      candidate: candidate._id,
      party: candidate.party,
      candidateName: candidate.fullName,
      votes: parseInt(input.value, 10) || 0,
    });
  });

  const data = {
    election: adminSelectedElectionId,
    lga,
    position,
    ward: position === 'councillor' ? document.getElementById('res-ward').value.trim() : undefined,
    registeredVoters: parseInt(document.getElementById('res-registered').value, 10) || 0,
    accreditedVoters: parseInt(document.getElementById('res-accredited').value, 10) || 0,
    totalVotesCast: parseInt(document.getElementById('res-total-cast').value, 10) || 0,
    rejectedVotes: parseInt(document.getElementById('res-rejected').value, 10) || 0,
    validVotes: parseInt(document.getElementById('res-valid').value, 10) || 0,
    voteEntries,
  };

  try {
    if (msg) msg.textContent = 'Saving…';
    const { data: result } = editId
      ? await api.results.update(editId, data)
      : await api.results.create(data);
    if (publish) {
      await api.results.publish(result._id, { returningOfficer: document.getElementById('res-officer').value.trim() });
      if (msg) msg.textContent = '✅ Result saved and published — now visible on the public Results page.';
    } else {
      if (msg) msg.textContent = editId ? '✅ Result updated.' : '✅ Result saved as draft.';
    }
    if (editId) cancelResultEdit();
    loadAdminResultsList();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

let adminResultsCache = [];

async function loadAdminResultsList() {
  const el = document.getElementById('res-list');
  if (!el) return;
  try {
    const { data } = await api.results.getAll();
    adminResultsCache = data;
    if (!data.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <h4 style="font-family:var(--font-display);color:var(--green);margin-bottom:10px">Existing Results</h4>
      <div class="admin-table">
        <div class="admin-table-head"><div>Election</div><div>LGA</div><div>Position</div><div>Status</div></div>
        ${data.map(r => `
          <div class="admin-table-row">
            <div>${r.election?.title || '—'}</div>
            <div>${r.lga?.name || '—'}</div>
            <div>${r.position}</div>
            <div><span class="${r.status === 'published' ? 'badge-active' : 'badge-pending'}">${r.status}</span>
              <button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:8px;" onclick="editResult('${r._id}')">Edit</button>
              ${r.status !== 'published' ? `<button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:6px;" onclick="publishExistingResult('${r._id}')">Publish</button>` : ''}
              ${Auth.isSuperAdmin() ? `<button class="btn-danger" style="margin-left:6px" onclick="deleteResultAdmin('${r._id}', ${r.status === 'published'})">Delete</button>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    console.warn('[admin] Could not load results list:', err.message);
  }
}

window.deleteResultAdmin = async function (id, isPublished) {
  const warning = isPublished
    ? 'This result is PUBLISHED and currently visible to the public on the Results page. Delete it anyway? This cannot be undone.'
    : 'Delete this draft result? This cannot be undone.';
  if (!confirm(warning)) return;
  try {
    await api.results.delete(id);
    loadAdminResultsList();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

window.publishExistingResult = async function (id) {
  try {
    await api.results.publish(id, {});
    loadAdminResultsList();
  } catch (err) {
    alert('Could not publish: ' + err.message);
  }
};

window.editResult = async function (id) {
  const msg = document.getElementById('res-msg');
  try {
    const { data: r } = await api.results.getOne(id);
    document.getElementById('res-edit-id').value = id;

    // Sync the active election selector so candidate lookups resolve correctly
    adminSelectedElectionId = r.election?._id || r.election;
    const elSel = document.getElementById('el-select');
    if (elSel) elSel.value = adminSelectedElectionId;

    document.getElementById('res-lga').value = r.lga?._id || r.lga || '';
    document.getElementById('res-position').value = r.position;
    toggleResultFields();
    document.getElementById('res-ward').value = r.ward || '';

    await loadCandidatesForResult();

    // Fill in existing vote counts now that the candidate inputs exist
    document.querySelectorAll('.res-vote-input').forEach(input => {
      const entry = (r.voteEntries || []).find(v => (v.candidate?._id || v.candidate) === input.dataset.candidateId);
      if (entry) input.value = entry.votes;
    });

    document.getElementById('res-registered').value = r.registeredVoters || '';
    document.getElementById('res-accredited').value = r.accreditedVoters || '';
    document.getElementById('res-total-cast').value = r.totalVotesCast || '';
    document.getElementById('res-rejected').value = r.rejectedVotes || '';
    document.getElementById('res-valid').value = r.validVotes || '';
    document.getElementById('res-officer').value = r.returningOfficer || '';

    document.getElementById('res-save-draft-btn').textContent = 'Update';
    document.getElementById('res-save-publish-btn').textContent = 'Update & Publish';
    document.getElementById('res-cancel-btn').style.display = 'inline-flex';
    document.getElementById('res-lga').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (msg) msg.textContent = '';
  } catch (err) {
    if (msg) msg.textContent = '❌ Could not load result: ' + err.message;
  }
};

window.cancelResultEdit = function () {
  document.getElementById('res-edit-id').value = '';
  document.getElementById('res-candidates-list').innerHTML = '';
  resultCandidatesCache = [];
  ['res-registered', 'res-accredited', 'res-total-cast', 'res-rejected', 'res-valid', 'res-officer', 'res-ward'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('res-save-draft-btn').textContent = 'Save as Draft';
  document.getElementById('res-save-publish-btn').textContent = 'Save & Publish';
  document.getElementById('res-cancel-btn').style.display = 'none';
};

async function loadTickerAdmin() {
  const textarea = document.getElementById('ticker-admin-messages');
  if (!textarea) return;

  try {
    const { data: settings } = await api.settings.getAll();
    const setting = (settings || []).find(s => s.key === 'ticker_messages');
    const messages = Array.isArray(setting?.value) ? setting.value : [];
    textarea.value = messages.join('\n');
  } catch (err) {
    console.warn('[admin] Could not load ticker settings:', err.message);
  }
}

window.saveTickerMessages = async function () {
  const msg = document.getElementById('ticker-admin-msg');
  const textarea = document.getElementById('ticker-admin-messages');
  const messages = textarea.value.split('\n').map(m => m.trim()).filter(Boolean);

  if (!messages.length) {
    if (msg) msg.textContent = '❌ Add at least one message.';
    return;
  }

  try {
    if (msg) msg.textContent = 'Saving…';
    await api.settings.update('ticker_messages', {
      value: messages, isPublic: true,
      description: 'Scrolling ticker messages shown at the top of the website',
    });
    if (msg) msg.textContent = '✅ Ticker messages saved.';
    load_home(); // Refresh ticker if home is loaded behind the scenes
  } catch (err) {
    if (msg) msg.textContent = '❌ Save failed: ' + err.message;
  }
};

async function loadElectionCountdownAdmin() {
  const activeEl = document.getElementById('cd-admin-active');
  const dateEl   = document.getElementById('cd-admin-date');
  const labelEl  = document.getElementById('cd-admin-label');
  if (!activeEl || !dateEl || !labelEl) return;

  try {
    const { data: settings } = await api.settings.getAll();
    const byKey = {};
    (settings || []).forEach(s => { byKey[s.key] = s.value; });

    activeEl.checked = byKey.next_election_active !== false;
    labelEl.value = byKey.next_election_label || '';
    if (byKey.next_election_date) {
      // Convert stored ISO date to the local value <input type="datetime-local"> expects
      const d = new Date(byKey.next_election_date);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      dateEl.value = local.toISOString().slice(0, 16);
    }
  } catch (err) {
    console.warn('[admin] Could not load countdown settings:', err.message);
  }
}

window.saveElectionCountdown = async function () {
  const msg = document.getElementById('cd-admin-msg');
  const active = document.getElementById('cd-admin-active').checked;
  const dateVal = document.getElementById('cd-admin-date').value;
  const labelVal = document.getElementById('cd-admin-label').value.trim();

  if (active && !dateVal) {
    if (msg) msg.textContent = '❌ Please set an election date to activate the countdown.';
    return;
  }

  try {
    if (msg) msg.textContent = 'Saving…';
    await api.settings.update('next_election_active', { value: active, isPublic: true, description: 'Whether the homepage countdown timer is shown' });
    if (dateVal) {
      await api.settings.update('next_election_date', { value: new Date(dateVal).toISOString(), isPublic: true, description: 'Date of the next LGA election (ISO format)' });
    }
    await api.settings.update('next_election_label', { value: labelVal, isPublic: true, description: 'Display label for countdown timer' });
    if (msg) msg.textContent = '✅ Countdown settings saved.';
    load_home(); // Refresh home countdown if visible
  } catch (err) {
    if (msg) msg.textContent = '❌ Save failed: ' + err.message;
  }
};

// Converts a YouTube / Vimeo / Facebook watch link into an embeddable
// iframe src. Falls back to the URL unchanged if it's already an embed
// link or an unrecognized host.
function toEmbedUrl(url) {
  if (!url) return '';
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  const fbMatch = /facebook\.com\/.+\/videos\//i.test(url) || /fb\.watch\//i.test(url);
  if (fbMatch) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
  return url;
}

async function loadLiveStreamAdmin() {
  const activeEl = document.getElementById('live-admin-active');
  const urlEl = document.getElementById('live-admin-url');
  const titleEl = document.getElementById('live-admin-title');
  if (!activeEl || !urlEl || !titleEl) return;

  try {
    const { data: settings } = await api.settings.getAll();
    const byKey = {};
    (settings || []).forEach(s => { byKey[s.key] = s.value; });

    activeEl.checked = byKey.live_stream_active === true;
    urlEl.value = byKey.live_stream_url || '';
    titleEl.value = byKey.live_stream_title || '';
  } catch (err) {
    console.warn('[admin] Could not load live stream settings:', err.message);
  }
}

window.saveLiveStream = async function () {
  const msg = document.getElementById('live-admin-msg');
  const active = document.getElementById('live-admin-active').checked;
  const urlVal = document.getElementById('live-admin-url').value.trim();
  const titleVal = document.getElementById('live-admin-title').value.trim();

  if (active && !urlVal) {
    if (msg) msg.textContent = '❌ Please provide a stream URL to activate live streaming.';
    return;
  }

  try {
    if (msg) msg.textContent = 'Saving…';
    await api.settings.update('live_stream_active', { value: active, isPublic: true, description: 'Whether the homepage live stream is shown' });
    await api.settings.update('live_stream_url', { value: urlVal, isPublic: true, description: 'Live stream watch URL (YouTube/Vimeo/Facebook)' });
    await api.settings.update('live_stream_title', { value: titleVal, isPublic: true, description: 'Display title for the live stream section' });
    if (msg) msg.textContent = '✅ Live stream settings saved.';
    load_home();
  } catch (err) {
    if (msg) msg.textContent = '❌ Save failed: ' + err.message;
  }
};

async function loadAdminLogSummary() {
  try {
    const { data } = await api.auth.logsSummary();
    setText('admin-stat-logins-today', data.loginsToday);
    setText('admin-stat-failed-today', data.failedToday);
    setText('admin-stat-locked',       data.lockedAccounts);
  } catch (err) {
    console.warn('[admin] Log summary error:', err.message);
  }
}

async function loadAdminLogTable(filterAction = '') {
  const el = document.getElementById('admin-logs-table-body');
  const head = document.getElementById('admin-logs-table-head');
  const clearBtn = document.getElementById('clear-log-btn');
  if (!el) return;

  const isSuper = Auth.isSuperAdmin();
  if (clearBtn) clearBtn.style.display = isSuper ? 'inline-flex' : 'none';
  const cols = isSuper ? 'grid-template-columns:1.2fr .9fr 1.7fr 1fr .7fr;' : '';
  if (head) {
    head.setAttribute('style', cols);
    head.innerHTML = `<div>User</div><div>Action</div><div>Details</div><div>Time</div>${isSuper ? '<div>Actions</div>' : ''}`;
  }

  el.innerHTML = '<div class="loading">Loading activity log…</div>';
  try {
    const params = filterAction ? `?action=${filterAction}&limit=30` : '?limit=30';
    const { data: logs } = await api.auth.logs(params);
    if (!logs.length) { el.innerHTML = '<div style="padding:16px;color:var(--slate-light);">No activity recorded yet.</div>'; return; }
    el.innerHTML = logs.map(l => `
      <div class="admin-table-row" style="${cols}">
        <div>${l.fullName || l.email || 'Unknown'}</div>
        <div><span class="${l.success ? 'badge-active' : 'badge-pending'}">${l.action.replace(/_/g,' ')}</span></div>
        <div style="font-size:12px;color:var(--slate-light)">${l.details || ''}</div>
        <div style="font-size:12px;">${new Date(l.createdAt).toLocaleString('en-NG')}</div>
        ${isSuper ? `<div><button class="btn-danger" style="padding:3px 8px;font-size:11px" onclick="deleteLogEntry('${l._id}')">✕</button></div>` : ''}
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<div style="padding:16px;color:var(--red);">Could not load log: ${err.message}</div>`;
  }
}
window.loadAdminLogTable = loadAdminLogTable;

window.deleteLogEntry = async function (id) {
  if (!confirm('Delete this log entry?')) return;
  try {
    await api.auth.deleteLog(id);
    loadAdminLogTable();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
};

window.clearActivityLog = async function () {
  if (!confirm('Clear the ENTIRE admin activity log? This cannot be undone.')) return;
  try {
    const { deletedCount } = await api.auth.clearLogs();
    alert(`Cleared ${deletedCount} log entries.`);
    loadAdminLogTable();
    loadAdminLogSummary();
  } catch (err) {
    alert('Could not clear log: ' + err.message);
  }
};

const ACTIVITY_LOG_HIDDEN_KEY = 'kosiec_activity_log_hidden';

function applyActivityLogVisibility() {
  const body = document.getElementById('activity-log-body');
  const btn = document.getElementById('activity-log-toggle');
  if (!body || !btn) return;
  const hidden = localStorage.getItem(ACTIVITY_LOG_HIDDEN_KEY) === 'true';
  body.style.display = hidden ? 'none' : '';
  btn.textContent = hidden ? 'Show' : 'Hide';
}

window.toggleActivityLog = function () {
  const hidden = localStorage.getItem(ACTIVITY_LOG_HIDDEN_KEY) === 'true';
  localStorage.setItem(ACTIVITY_LOG_HIDDEN_KEY, hidden ? 'false' : 'true');
  applyActivityLogVisibility();
};

async function loadChairmanPhotoUpload() {
  try {
    const { data: chairman } = await api.team.getChairman();
    const el = document.getElementById('chairman-photo-admin');
    if (!el || !chairman) return;
    el.innerHTML = `
      <div class="admin-photo-section">
        <h4>Chairman Photo — ${chairman.title ? chairman.title + ' ' : ''}${chairman.fullName}</h4>
        <div class="current-photo">
          ${chairman.photo
            ? `<img src="${chairman.photo}" alt="Chairman" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--gold)">`
            : `<div style="width:120px;height:120px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--gold);font-weight:900">${getInitials(chairman.fullName)}</div>`}
        </div>
        <div style="margin-top:12px;">
          <input type="file" id="chairman-photo-input" accept="image/*" style="margin-bottom:8px;display:block;">
          <button class="btn-primary" onclick="uploadChairmanPhoto('${chairman._id}')">Upload Photo</button>
          <span id="chairman-photo-msg" style="margin-left:12px;font-size:13px;"></span>
        </div>
      </div>`;
  } catch {}
}

window.uploadChairmanPhoto = async function(memberId) {
  const input = document.getElementById('chairman-photo-input');
  const msg   = document.getElementById('chairman-photo-msg');
  if (!input?.files?.length) { if (msg) msg.textContent = 'Please select a photo.'; return; }

  const fd = new FormData();
  fd.append('photo', input.files[0]);

  try {
    if (msg) msg.textContent = 'Uploading…';
    await api.team.uploadPhoto(memberId, fd);
    if (msg) msg.textContent = '✅ Photo uploaded! Refresh to see changes.';
    load_admin(); // Reload admin panel
    load_home();  // Refresh home if visible
  } catch (err) {
    if (msg) msg.textContent = '❌ Upload failed: ' + err.message;
  }
};

// ============================================================
// Admin — Inquiries Inbox (mail-style: Inbox / Archived, paginated)
// ============================================================
let adminInquiriesCache = [];
let inquiryTabState = { tab: 'inbox', page: 1, pages: 1 };
const INQUIRY_PAGE_SIZE = 20;

async function loadInquiriesTab(tab, page) {
  inquiryTabState.tab = tab;
  inquiryTabState.page = page;

  const inboxBtn = document.getElementById('inq-tab-inbox');
  const archivedBtn = document.getElementById('inq-tab-archived');
  if (inboxBtn) inboxBtn.className = tab === 'inbox' ? 'btn-primary' : 'btn-outline';
  if (archivedBtn) archivedBtn.className = tab === 'archived' ? 'btn-primary' : 'btn-outline';

  const el = document.getElementById('admin-inquiries-table-body');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading inquiries…</div>';
  try {
    const params = `?archived=${tab === 'archived'}&page=${page}&limit=${INQUIRY_PAGE_SIZE}`;
    const res = await api.inquiries.getAll(params);
    adminInquiriesCache = res.data || [];
    inquiryTabState.pages = res.pages || 1;

    setText('admin-stat-inquiries', res.unreadCount ?? 0);
    const unreadBadge = document.getElementById('inq-unread-badge');
    if (unreadBadge) {
      if (res.unreadCount > 0) { unreadBadge.textContent = res.unreadCount; unreadBadge.style.display = 'inline-block'; }
      else unreadBadge.style.display = 'none';
    }

    renderAdminInquiries(adminInquiriesCache);

    const pageLabel = document.getElementById('inq-page-label');
    if (pageLabel) pageLabel.textContent = `Page ${res.currentPage || 1} of ${res.pages || 1} (${res.total || 0} total)`;
    const prevBtn = document.getElementById('inq-prev-btn');
    const nextBtn = document.getElementById('inq-next-btn');
    if (prevBtn) prevBtn.disabled = (res.currentPage || 1) <= 1;
    if (nextBtn) nextBtn.disabled = (res.currentPage || 1) >= (res.pages || 1);
  } catch (err) {
    el.innerHTML = `<p class="error-state">Could not load inquiries. ${err.message}</p>`;
  }
}

window.switchInquiryTab = function (tab) { loadInquiriesTab(tab, 1); };

window.changeInquiryPage = function (delta) {
  const next = inquiryTabState.page + delta;
  if (next < 1 || next > inquiryTabState.pages) return;
  loadInquiriesTab(inquiryTabState.tab, next);
};

function renderAdminInquiries(inquiries) {
  const el = document.getElementById('admin-inquiries-table-body');
  if (!el) return;
  if (!inquiries.length) {
    el.innerHTML = `<div style="padding:16px;color:var(--slate-light);">${inquiryTabState.tab === 'archived' ? 'No archived inquiries.' : 'Inbox is empty.'}</div>`;
    return;
  }
  el.innerHTML = inquiries.map(i => `
    <div class="admin-table-row" style="grid-template-columns:1.2fr 1fr .9fr .7fr 1fr;${i.status === 'new' ? 'font-weight:700;' : ''}">
      <div>${i.status === 'new' ? '● ' : ''}${i.fullName}</div>
      <div>${i.subject?.replace(/_/g,' ') || '—'}</div>
      <div>${new Date(i.createdAt).toLocaleDateString('en-NG')}</div>
      <div><span class="badge-${i.status === 'new' ? 'pending' : 'active'}">${i.status}</span></div>
      <div>
        <button class="btn-outline" style="padding:3px 10px;font-size:11px;" onclick="viewInquiryDetail('${i._id}')">View</button>
        <button class="btn-outline" style="padding:3px 10px;font-size:11px;margin-left:4px;" onclick="quickArchiveInquiry('${i._id}', ${i.isArchived ? 'false' : 'true'})">${i.isArchived ? 'Unarchive' : 'Archive'}</button>
      </div>
    </div>`).join('');
}

window.quickArchiveInquiry = async function (id, archived) {
  try {
    await api.inquiries.archive(id, archived);
    loadInquiriesTab(inquiryTabState.tab, inquiryTabState.page);
  } catch (err) {
    alert('Could not update: ' + err.message);
  }
};

window.viewInquiryDetail = function (id) {
  const i = adminInquiriesCache.find(x => x._id === id);
  if (!i) return;
  document.getElementById('inquiry-modal-id').value = id;
  document.getElementById('inquiry-modal-title').textContent = (i.subject || 'general').replace(/_/g, ' ');
  document.getElementById('inquiry-modal-date').textContent = new Date(i.createdAt).toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });
  document.getElementById('inquiry-modal-name').textContent = i.fullName || '—';
  document.getElementById('inquiry-modal-email').textContent = i.email || '—';
  document.getElementById('inquiry-modal-phone').textContent = i.phone || '—';
  document.getElementById('inquiry-modal-lga').textContent = i.lga?.name || '—';
  document.getElementById('inquiry-modal-subject').textContent = (i.subject || 'general').replace(/_/g, ' ');
  document.getElementById('inquiry-modal-message').textContent = i.message || '';
  document.getElementById('inquiry-modal-status').value = i.status || 'new';
  document.getElementById('inquiry-modal-notes').value = i.adminNotes || '';
  document.getElementById('inquiry-modal-msg').textContent = '';
  document.getElementById('inquiry-modal-archive-btn').textContent = i.isArchived ? '📥 Move to Inbox' : '🗄️ Archive';
  document.getElementById('inquiry-modal-delete-btn').style.display = i.isArchived && Auth.isSuperAdmin() ? 'inline-flex' : 'none';
  document.getElementById('inquiry-modal').classList.add('open');

  // Viewing a "new" inquiry naturally marks it read, same as any inbox
  if (i.status === 'new') {
    api.inquiries.setStatus(id, { status: 'read' }).then(() => {
      i.status = 'read';
      document.getElementById('inquiry-modal-status').value = 'read';
      renderAdminInquiries(adminInquiriesCache);
    }).catch(() => {});
  }
};

window.closeInquiryModal = function () {
  document.getElementById('inquiry-modal').classList.remove('open');
  loadInquiriesTab(inquiryTabState.tab, inquiryTabState.page);
};

window.saveInquiryStatus = async function () {
  const msg = document.getElementById('inquiry-modal-msg');
  const id = document.getElementById('inquiry-modal-id').value;
  const status = document.getElementById('inquiry-modal-status').value;
  const adminNotes = document.getElementById('inquiry-modal-notes').value.trim();
  try {
    if (msg) msg.textContent = 'Saving…';
    const { data } = await api.inquiries.setStatus(id, { status, adminNotes });
    const cached = adminInquiriesCache.find(x => x._id === id);
    if (cached) { cached.status = data.status; cached.adminNotes = data.adminNotes; }
    renderAdminInquiries(adminInquiriesCache);
    if (msg) msg.textContent = '✅ Saved.';
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

window.toggleInquiryArchive = async function () {
  const msg = document.getElementById('inquiry-modal-msg');
  const id = document.getElementById('inquiry-modal-id').value;
  const i = adminInquiriesCache.find(x => x._id === id);
  const archiving = !(i && i.isArchived);
  try {
    if (msg) msg.textContent = archiving ? 'Archiving…' : 'Moving to Inbox…';
    await api.inquiries.archive(id, archiving);
    if (msg) msg.textContent = archiving ? '✅ Archived.' : '✅ Moved to Inbox.';
    closeInquiryModal();
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

window.deleteInquiryFromModal = async function () {
  if (!confirm('Permanently delete this inquiry? This cannot be undone.')) return;
  const msg = document.getElementById('inquiry-modal-msg');
  const id = document.getElementById('inquiry-modal-id').value;
  try {
    await api.inquiries.delete(id);
    document.getElementById('inquiry-modal').classList.remove('open');
    loadInquiriesTab(inquiryTabState.tab, inquiryTabState.page);
  } catch (err) {
    if (msg) msg.textContent = '❌ Failed: ' + err.message;
  }
};

// ============================================================
// Shared helpers
// ============================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// JSON.stringify() produces a double-quoted JS string literal, which is
// safe from the JS engine's point of view — but when that gets embedded
// inside an HTML onclick='...' attribute (single-quote delimited), a raw
// apostrophe in the content (e.g. a title like "Stakeholders' Meeting")
// still closes the HTML attribute early and corrupts the markup. Escaping
// it as &#39; lets the browser's HTML parser decode it back to a real
// apostrophe before the string ever reaches the JS engine.
function jsAttr(value) {
  return JSON.stringify(value).replace(/'/g, '&#39;');
}

function getInitials(name = '') {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

