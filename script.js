const surveys = [
    {
      id: 1,
      name: 'Kos Melati Residence',
      type: 'Female',
      rent: 1500000,
      location: 'Lowokwaru, Malang',
      distance: 1.8,
      status: 'Published',
      photo: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      roomLength: 3.5,
      roomWidth: 3,
      roomFacilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Dispenser', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 4,
      bathroomFacilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'],
      sharedFacilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Washing machine', 'Laundry', 'Dispenser'],
      surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)', 'Place of worship'],
      security: 3,
      notes: 'Quiet environment, owner responsive, safe for female tenants. Good access to local food stalls and minimarket nearby.',
      starred: true,
      priceScore: 89,
      facilityScore: 91,
      locationScore: 88,
      campusScore: 93,
      securityScore: 77
    },
    {
      id: 2,
      name: 'Casa Hijau',
      type: 'Mixed',
      rent: 1350000,
      location: 'Tlogomas, Malang',
      distance: 2.3,
      status: 'Published',
      photo: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      roomLength: 4,
      roomWidth: 3.2,
      roomFacilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Refrigerator', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 3,
      bathroomFacilities: ['Indoor bathroom', 'Western-style toilet'],
      sharedFacilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Laundry', 'Dispenser'],
      surroundings: ['Minimarket / supermarket', 'Pharmacy / clinic', 'Eatery (warung makan)', 'Place of worship'],
      security: 4,
      notes: 'Very good lighting, clean shared kitchen, and fast owner response. Slightly more crowded but comfortable overall.',
      starred: false,
      priceScore: 94,
      facilityScore: 86,
      locationScore: 80,
      campusScore: 82,
      securityScore: 90
    },
    {
      id: 3,
      name: 'Kost Arwana',
      type: 'Male',
      rent: 1700000,
      location: 'Dinoyo, Malang',
      distance: 1.6,
      status: 'Draft',
      photo: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
      roomLength: 3.8,
      roomWidth: 3.1,
      roomFacilities: ['Mattress', 'Wardrobe', 'AC', 'Fan', 'Table', 'Chair', 'Dispenser', 'Window', 'Includes electricity'],
      cleanliness: 3,
      internet: 4,
      bathroomFacilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'],
      sharedFacilities: ['Wifi', 'Motorcycle parking', 'Car parking', 'Kitchen', 'Washing machine'],
      surroundings: ['Eatery (warung makan)', 'Place of worship', 'Gym / sports facilities'],
      security: 3,
      notes: 'Near campus and good internet signal. Room is spacious but still needs maintenance on the bathroom fixtures.',
      starred: true,
      priceScore: 72,
      facilityScore: 88,
      locationScore: 93,
      campusScore: 94,
      securityScore: 75
    },
    {
      id: 4,
      name: 'Kost Bumi Asri',
      type: 'Female',
      rent: 1250000,
      location: 'Sumbersari, Malang',
      distance: 2.8,
      status: 'Published',
      photo: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      roomLength: 3.2,
      roomWidth: 2.8,
      roomFacilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 3,
      internet: 2,
      bathroomFacilities: ['Outdoor bathroom', 'Squat toilet'],
      sharedFacilities: ['Wifi', 'Motorcycle parking', 'Laundry'],
      surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)'],
      security: 2,
      notes: 'Affordable and close to a local market. Internet quality is weaker and security around the access gate needs attention.',
      starred: false,
      priceScore: 98,
      facilityScore: 63,
      locationScore: 72,
      campusScore: 70,
      securityScore: 58
    }
  ];
  
  const state = {
    activeView: 'dashboard',
    selectedSurveyId: null,
    compareSelection: [],
    deleteSurveyId: null,
    communityFilters: {
      location: '',
      minRent: '',
      maxRent: '',
      type: '',
      starredOnly: false
    }
  };
  
  const refs = {
    pageTitle: document.querySelector('#page-title'),
    pageKicker: document.querySelector('#page-kicker'),
    dashboardStats: document.querySelector('#dashboard-stats'),
    recentSurveys: document.querySelector('#recent-surveys'),
    surveyList: document.querySelector('#survey-list'),
    communityList: document.querySelector('#community-list'),
    compareBar: document.querySelector('#compare-bar'),
    compareCandidates: document.querySelector('#compare-candidates'),
    comparisonTableWrap: document.querySelector('#comparison-table-wrap'),
    compareCounter: document.querySelector('#compare-counter'),
    runCompare: document.querySelector('#run-compare'),
    surveyDetailContent: document.querySelector('#survey-detail-content'),
    deleteModal: document.querySelector('#delete-modal'),
    surveyForm: document.querySelector('#survey-form'),
    formTitle: document.querySelector('#form-title'),
    formKicker: document.querySelector('#form-kicker')
  };
  
  const viewTitles = {
    dashboard: { kicker: 'Overview', title: 'Dashboard' },
    'survey-list': { kicker: 'Survey management', title: 'My surveys' },
    community: { kicker: 'Shared survey results', title: 'Community surveys' },
    compare: { kicker: 'Comparison', title: 'Compare kos' },
    'survey-form': { kicker: 'Add survey', title: 'New survey' },
    'survey-detail': { kicker: 'Survey details', title: 'Kos detail' }
  };
  
  function numberToCurrency(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }
  
  function formatDistance(value) {
    return `${Number(value).toFixed(1)} km`;
  }
  
  function setView(viewName) {
    state.activeView = viewName;
  
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('active', view.dataset.viewSection === viewName);
    });
  
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
  
    if (viewTitles[viewName]) {
      refs.pageKicker.textContent = viewTitles[viewName].kicker;
      refs.pageTitle.textContent = viewTitles[viewName].title;
    }
  
    if (viewName === 'survey-form') {
      refs.formKicker.textContent = 'Add survey';
      refs.formTitle.textContent = 'New survey';
    }
  }
  
  function renderDashboardStats() {
    const total = surveys.length;
    const published = surveys.filter((s) => s.status === 'Published').length;
    const drafts = surveys.filter((s) => s.status === 'Draft').length;
    const starredCount = surveys.filter((s) => s.starred).length;
    const avgRent = Math.round(surveys.reduce((sum, s) => sum + s.rent, 0) / total);
  
    refs.dashboardStats.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total surveys</div>
        <div class="stat-value"><strong>${total}</strong><span>+12%</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Published</div>
        <div class="stat-value"><strong>${published}</strong><span>+8%</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Drafts</div>
        <div class="stat-value"><strong>${drafts}</strong><span>+2%</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg. rent</div>
        <div class="stat-value"><strong>${numberToCurrency(avgRent).replace('Rp', 'Rp')}</strong></div>
      </div>
    `;
  }
  
  function renderRecentSurveys() {
    const recent = [...surveys].slice(0, 3);
    refs.recentSurveys.innerHTML = recent.map((survey) => `
      <div class="stack-item">
        <div>
          <strong>${survey.name}</strong>
          <div class="meta">${survey.location}</div>
        </div>
        <span class="badge ${survey.status.toLowerCase()}">${survey.status}</span>
      </div>
    `).join('');
  }
  
  function renderSurveyList() {
    const query = document.querySelector('#survey-search')?.value.trim().toLowerCase() || '';
    const filtered = surveys.filter((survey) => survey.name.toLowerCase().includes(query));
  
    if (!filtered.length) {
      refs.surveyList.innerHTML = '<div class="empty-state">No surveys match your search.</div>';
      return;
    }
  
    refs.surveyList.innerHTML = filtered.map((survey) => `
      <article class="survey-card">
        <div class="card-image" style="background-image:url('${survey.photo}')"></div>
        <div class="card-body">
          <div class="card-header-row">
            <h3>${survey.name}</h3>
            <span class="ghost-tag ${survey.status.toLowerCase()}">${survey.status}</span>
          </div>
          <ul class="meta-list">
            <li><span>Price</span><strong>${numberToCurrency(survey.rent)}</strong></li>
            <li><span>Location</span><strong>${survey.location}</strong></li>
            <li><span>Distance</span><strong>${formatDistance(survey.distance)}</strong></li>
          </ul>
          <div class="card-footer">
            <div class="inline-actions">
              <button class="primary-mini" data-action="view-survey" data-id="${survey.id}">View</button>
              <button data-action="edit-survey" data-id="${survey.id}">Edit</button>
            </div>
            <button class="delete-mini" data-action="delete-survey" data-id="${survey.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join('');
  }
  
  function renderCommunityList() {
    const { location, minRent, maxRent, type, starredOnly } = state.communityFilters;
  
    const filtered = surveys.filter((survey) => {
      const matchesLocation = !location || survey.location.toLowerCase().includes(location.toLowerCase());
      const matchesType = !type || survey.type === type;
      const matchesStar = !starredOnly || survey.starred;
      const matchesMin = !minRent || survey.rent >= Number(minRent);
      const matchesMax = !maxRent || survey.rent <= Number(maxRent);
      return matchesLocation && matchesType && matchesStar && matchesMin && matchesMax && survey.status === 'Published';
    });
  
    if (!filtered.length) {
      refs.communityList.innerHTML = '<div class="empty-state">No shared surveys match the current filters.</div>';
      return;
    }
  
    refs.communityList.innerHTML = filtered.map((survey) => `
      <article class="community-card">
        <div class="card-image" style="background-image:url('${survey.photo}')"></div>
        <div class="card-body">
          <div class="card-header-row">
            <h3>${survey.name}</h3>
            <button class="star-button ${survey.starred ? 'active' : ''}" data-action="toggle-star" data-id="${survey.id}">${survey.starred ? '★' : '☆'}</button>
          </div>
          <ul class="meta-list">
            <li><span>Price</span><strong>${numberToCurrency(survey.rent)}</strong></li>
            <li><span>Location</span><strong>${survey.location}</strong></li>
            <li><span>Type</span><strong>${survey.type}</strong></li>
          </ul>
          <div class="card-footer">
            <button class="primary-mini" data-action="view-survey" data-id="${survey.id}">View</button>
            <button data-action="add-to-compare" data-id="${survey.id}">Add to compare</button>
          </div>
        </div>
      </article>
    `).join('');
  }
  
  function getSelectedCompareSurveys() {
    return surveys.filter((survey) => state.compareSelection.includes(survey.id));
  }
  
  function syncCompareUI() {
    refs.compareCounter.textContent = `${state.compareSelection.length} selected`;
    refs.runCompare.disabled = state.compareSelection.length < 2;
  
    refs.compareBar.innerHTML = state.compareSelection.length
      ? getSelectedCompareSurveys().map((survey) => `
        <div class="compare-pill">
          <span>${survey.name}</span>
          <button class="close-pill" data-action="remove-compare" data-id="${survey.id}">×</button>
        </div>
      `).join('')
      : '<div class="empty-state" style="padding:16px 18px;">Select at least two kos to compare.</div>';
  
    refs.compareCandidates.innerHTML = surveys.map((survey) => {
      const isSelected = state.compareSelection.includes(survey.id);
      return `
        <div class="compare-candidate">
          <div>
            <strong>${survey.name}</strong>
            <div class="meta">${survey.location} • ${numberToCurrency(survey.rent)}</div>
          </div>
          <button class="${isSelected ? 'added' : ''}" data-action="toggle-compare" data-id="${survey.id}">
            ${isSelected ? 'Selected' : (state.compareSelection.length >= 3 ? 'Full' : 'Add')}
          </button>
        </div>
      `;
    }).join('');
  
    if (state.compareSelection.length >= 2) {
      renderComparisonTable();
    } else {
      refs.comparisonTableWrap.innerHTML = '<div class="empty-state">Comparison results will appear after selecting at least two kos.</div>';
    }
  }
  
  function scoreKos(survey) {
    const priceScore = survey.priceScore || 0;
    const facilityScore = survey.facilityScore || 0;
    const cleanlinessScore = (survey.cleanliness / 4) * 100;
    const locationScore = survey.locationScore || 0;
    const campusScore = survey.campusScore || 0;
    const securityScore = survey.securityScore || 0;
  
    const weighted = 
      (priceScore * 0.25) +
      (facilityScore * 0.2) +
      (cleanlinessScore * 0.15) +
      (locationScore * 0.15) +
      ((100 - Math.min(Math.max((survey.distance - 1) * 20, 0), 100)) * 0.13) +
      (securityScore * 0.12);
  
    return Math.round(weighted);
  }
  
  function renderComparisonTable() {
    const selected = getSelectedCompareSurveys();
    const scored = selected.map((survey) => ({ ...survey, score: scoreKos(survey) }));
    const best = scored.reduce((max, item) => item.score > max.score ? item : max, scored[0]);
  
    const rows = [
      { label: 'Kos Information', values: selected.map((s) => `<strong>${s.name}</strong><br>${s.location}<br>${s.type}`) },
      { label: 'Price', values: selected.map((s) => numberToCurrency(s.rent)) },
      { label: 'Facilities', values: selected.map((s) => s.roomFacilities.concat(s.sharedFacilities).slice(0, 5).join(', ')) },
      { label: 'Room quality', values: selected.map((s) => `${s.cleanliness}/4 cleanliness<br>${s.internet}/4 internet`) },
      { label: 'Bathroom', values: selected.map((s) => s.bathroomFacilities.join(', ')) },
      { label: 'Surroundings', values: selected.map((s) => s.surroundings.slice(0, 3).join(', ')) },
      { label: 'Security', values: selected.map((s) => `${s.security}/4`) },
      { label: 'Overall score', values: scored.map((s) => `<div class="score-box ${s.id === best.id ? 'best' : ''}">${s.score}</div>`) }
    ];
  
    const headers = selected.map((survey) => `<th>${survey.name}</th>`).join('');
    const body = rows.map((row) => `
      <tr>
        <td class="label">${row.label}</td>
        ${row.values.map((value) => `<td>${value}</td>`).join('')}
      </tr>
    `).join('');
  
    refs.comparisonTableWrap.innerHTML = `
      <div class="table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Criteria</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    `;
  }
  
  function renderSurveyDetail(surveyId) {
    const survey = surveys.find((item) => item.id === Number(surveyId));
    if (!survey) return;
  
    refs.surveyDetailContent.innerHTML = `
      <div class="detail-card">
        <div class="detail-hero">
          <div>
            <div class="eyebrow">Survey details</div>
            <h2>${survey.name}</h2>
            <div class="tag">${survey.status}</div>
          </div>
          <div class="detail-image" style="background-image:url('${survey.photo}')"></div>
        </div>
  
        <div class="detail-grid">
          <div class="kpi-box">
            <div class="kpi-label">Monthly rent</div>
            <div class="kpi-value">${numberToCurrency(survey.rent)}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Distance to campus</div>
            <div class="kpi-value">${formatDistance(survey.distance)}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Best match score</div>
            <div class="kpi-value">${scoreKos(survey)}</div>
          </div>
        </div>
  
        <div class="detail-sections">
          <div class="detail-section">
            <h4>Kos information</h4>
            <ul>
              <li>${survey.type}</li>
              <li>${survey.location}</li>
              <li>${survey.roomLength}m × ${survey.roomWidth}m</li>
            </ul>
          </div>
  
          <div class="detail-section">
            <h4>Room facilities</h4>
            <ul>
              ${survey.roomFacilities.map((feature) => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
  
          <div class="detail-section">
            <h4>Bathroom facilities</h4>
            <ul>
              ${survey.bathroomFacilities.map((feature) => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
  
          <div class="detail-section">
            <h4>Shared facilities</h4>
            <ul>
              ${survey.sharedFacilities.map((feature) => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
  
          <div class="detail-section">
            <h4>Surroundings</h4>
            <ul>
              ${survey.surroundings.map((feature) => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
  
          <div class="detail-section">
            <h4>Ratings</h4>
            <ul>
              <li>Cleanliness ${survey.cleanliness}/4</li>
              <li>Internet ${survey.internet}/4</li>
              <li>Security ${survey.security}/4</li>
            </ul>
          </div>
        </div>
  
        <div class="notes-box">
          <strong>Additional notes</strong>
          <p>${survey.notes}</p>
        </div>
      </div>
    `;
  }
  
  function populateForm(surveyId = null) {
    refs.surveyForm.reset();
  
    if (!surveyId) {
      refs.formKicker.textContent = 'Add survey';
      refs.formTitle.textContent = 'New survey';
      return;
    }
  
    const survey = surveys.find((item) => item.id === surveyId);
    if (!survey) return;
  
    refs.formKicker.textContent = 'Edit survey';
    refs.formTitle.textContent = 'Update survey';
  
    const formData = new FormData(refs.surveyForm);
    refs.surveyForm.name.value = survey.name;
    refs.surveyForm.type.value = survey.type;
    refs.surveyForm.location.value = survey.location;
    refs.surveyForm.distance.value = survey.distance;
    refs.surveyForm.rent.value = survey.rent;
    refs.surveyForm.roomLength.value = survey.roomLength;
    refs.surveyForm.roomWidth.value = survey.roomWidth;
    refs.surveyForm.cleanliness.value = String(survey.cleanliness);
    refs.surveyForm.internet.value = String(survey.internet);
    refs.surveyForm.security.value = String(survey.security);
    refs.surveyForm.notes.value = survey.notes;
  
    Array.from(refs.surveyForm.querySelectorAll('input[name="roomFacility"]')).forEach((checkbox) => {
      checkbox.checked = survey.roomFacilities.includes(checkbox.value);
    });
  
    Array.from(refs.surveyForm.querySelectorAll('input[name="bathroomFacility"]')).forEach((checkbox) => {
      checkbox.checked = survey.bathroomFacilities.includes(checkbox.value);
    });
  
    Array.from(refs.surveyForm.querySelectorAll('input[name="sharedFacility"]')).forEach((checkbox) => {
      checkbox.checked = survey.sharedFacilities.includes(checkbox.value);
    });
  
    Array.from(refs.surveyForm.querySelectorAll('input[name="surrounding"]')).forEach((checkbox) => {
      checkbox.checked = survey.surroundings.includes(checkbox.value);
    });
  }
  
  function getCheckedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }
  
  function saveSurvey(mode) {
    const form = refs.surveyForm;
    const formData = new FormData(form);
    const isEditing = !!state.selectedSurveyId;
  
    const payload = {
      id: isEditing ? state.selectedSurveyId : Date.now(),
      name: formData.get('name').toString(),
      type: formData.get('type').toString(),
      location: formData.get('location').toString(),
      distance: Number(formData.get('distance') || 0),
      rent: Number(formData.get('rent') || 0),
      roomLength: Number(formData.get('roomLength') || 0),
      roomWidth: Number(formData.get('roomWidth') || 0),
      roomFacilities: getCheckedValues('roomFacility'),
      cleanliness: Number(formData.get('cleanliness') || 1),
      internet: Number(formData.get('internet') || 1),
      bathroomFacilities: getCheckedValues('bathroomFacility'),
      sharedFacilities: getCheckedValues('sharedFacility'),
      surroundings: getCheckedValues('surrounding'),
      security: Number(formData.get('security') || 1),
      notes: formData.get('notes').toString(),
      status: mode === 'publish' ? 'Published' : 'Draft',
      photo: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      starred: false,
      priceScore: 82,
      facilityScore: 85,
      locationScore: 80,
      campusScore: 83,
      securityScore: 80
    };
  
    if (isEditing) {
      const idx = surveys.findIndex((item) => item.id === payload.id);
      if (idx >= 0) surveys[idx] = { ...surveys[idx], ...payload };
    } else {
      surveys.unshift(payload);
    }
  
    renderAll();
    setView('survey-list');
    refs.surveyForm.reset();
    state.selectedSurveyId = null;
  }
  
  function renderAll() {
    renderDashboardStats();
    renderRecentSurveys();
    renderSurveyList();
    renderCommunityList();
    syncCompareUI();
  }
  
  function bindGlobalEvents() {
    document.body.addEventListener('click', (event) => {
      const actionTarget = event.target.closest('[data-action]');
      const viewTarget = event.target.closest('[data-view]');
  
      if (viewTarget) {
        const view = viewTarget.dataset.view;
        if (view === 'dashboard' || view === 'survey-list' || view === 'community' || view === 'compare') {
          setView(view);
        }
        return;
      }
  
      if (!actionTarget) return;
      const { action, id } = actionTarget.dataset;
  
      switch (action) {
        case 'new-survey':
          state.selectedSurveyId = null;
          populateForm();
          setView('survey-form');
          break;
        case 'view-survey':
          state.selectedSurveyId = Number(id);
          renderSurveyDetail(Number(id));
          setView('survey-detail');
          break;
        case 'edit-survey':
          state.selectedSurveyId = Number(id);
          populateForm(Number(id));
          setView('survey-form');
          break;
        case 'delete-survey':
          state.deleteSurveyId = Number(id);
          refs.deleteModal.classList.remove('hidden');
          break;
        case 'cancel-delete':
          state.deleteSurveyId = null;
          refs.deleteModal.classList.add('hidden');
          break;
        case 'confirm-delete':
          if (state.deleteSurveyId) {
            const index = surveys.findIndex((survey) => survey.id === state.deleteSurveyId);
            if (index >= 0) surveys.splice(index, 1);
          }
          refs.deleteModal.classList.add('hidden');
          state.deleteSurveyId = null;
          renderAll();
          setView('survey-list');
          break;
        case 'save-draft':
          saveSurvey('draft');
          break;
        case 'publish-survey':
          saveSurvey('publish');
          break;
        case 'toggle-star': {
          const survey = surveys.find((item) => item.id === Number(id));
          if (survey) survey.starred = !survey.starred;
          renderCommunityList();
          renderDashboardStats();
          break;
        }
        case 'toggle-compare': {
          const value = Number(id);
          if (state.compareSelection.includes(value)) {
            state.compareSelection = state.compareSelection.filter((item) => item !== value);
          } else if (state.compareSelection.length < 3) {
            state.compareSelection.push(value);
          }
          syncCompareUI();
          break;
        }
        case 'remove-compare': {
          state.compareSelection = state.compareSelection.filter((item) => item !== Number(id));
          syncCompareUI();
          break;
        }
        case 'add-to-compare': {
          const value = Number(id);
          if (!state.compareSelection.includes(value) && state.compareSelection.length < 3) {
            state.compareSelection.push(value);
          }
          setView('compare');
          syncCompareUI();
          break;
        }
      }
    });
  
    document.querySelector('#survey-search').addEventListener('input', renderSurveyList);
  
    document.querySelector('#community-location').addEventListener('input', (event) => {
      state.communityFilters.location = event.target.value;
      renderCommunityList();
    });
  
    document.querySelector('#community-min-rent').addEventListener('input', (event) => {
      state.communityFilters.minRent = event.target.value;
      renderCommunityList();
    });
  
    document.querySelector('#community-max-rent').addEventListener('input', (event) => {
      state.communityFilters.maxRent = event.target.value;
      renderCommunityList();
    });
  
    document.querySelector('#community-type').addEventListener('change', (event) => {
      state.communityFilters.type = event.target.value;
      renderCommunityList();
    });
  
    document.querySelector('#community-starred').addEventListener('change', (event) => {
      state.communityFilters.starredOnly = event.target.checked;
      renderCommunityList();
    });
  
    refs.runCompare.addEventListener('click', () => {
      if (state.compareSelection.length >= 2) renderComparisonTable();
    });
  }
  
  bindGlobalEvents();
  renderAll();
  setView('dashboard');