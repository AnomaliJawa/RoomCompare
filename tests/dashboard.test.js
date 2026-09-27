import { describe, it, expect, beforeEach, vi } from 'vitest';

const render = (markup) => {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  return host;
};

// The store reads storage once at import, so each render gets a fresh copy.
async function dashboard(prepare) {
  vi.resetModules();
  const store = await import('../src/store.js');
  prepare?.(store);
  const { renderDashboard } = await import('../src/features/dashboard.js');
  const recent = [...store.getState().surveys]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);
  return { host: render(renderDashboard()), recent };
}

describe('the dashboard comparison strip', () => {
  beforeEach(() => localStorage.clear());

  it('gives each criterion its own section, headed by its name', async () => {
    const { host } = await dashboard();
    const sections = [...host.querySelectorAll('.hero section.strip-section')];
    expect(sections.map((s) => s.querySelector('h3').textContent.trim())).toEqual(['Monthly rent', 'To campus']);
    for (const section of sections) {
      const heading = section.querySelector('h3');
      expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(section.querySelector('table').getAttribute('aria-labelledby')).toBe(heading.id);
    }
  });

  it('keeps every kos name, rent and distance it showed before', async () => {
    const { host, recent } = await dashboard();
    const [rent, distance] = [...host.querySelectorAll('.hero section.strip-section')];
    const values = (section) => [...section.querySelectorAll('td .strip__value')].map((v) => v.textContent.trim());
    const kos = (section) => [...section.querySelectorAll('td .strip__kos')].map((k) => k.textContent.trim());

    expect(kos(rent)).toEqual(recent.map((s) => s.kos.name));
    expect(kos(distance)).toEqual(recent.map((s) => s.kos.name));
    expect(values(rent)).toEqual(recent.map((s) => `Rp ${s.kos.rent.toLocaleString('id-ID')}`));
    expect(values(distance)).toEqual(recent.map((s) => `${s.kos.distanceKm.toFixed(1).replace('.', ',')} km`));
  });

  it('marks the lowest rent and the shortest distance, as before', async () => {
    const { host, recent } = await dashboard();
    const [rent, distance] = [...host.querySelectorAll('.hero section.strip-section')];
    const best = (section) => [...section.querySelectorAll('td')].map((td) => td.classList.contains('strip__best'));
    const cheapest = Math.min(...recent.map((s) => s.kos.rent));
    const nearest = Math.min(...recent.map((s) => s.kos.distanceKm));
    expect(best(rent)).toEqual(recent.map((s) => s.kos.rent === cheapest));
    expect(best(distance)).toEqual(recent.map((s) => s.kos.distanceKm === nearest));
  });

  it('puts every table on the same column set, so values line up across sections', async () => {
    const { host, recent } = await dashboard();
    const tables = [...host.querySelectorAll('.hero table.strip')];
    expect(tables).toHaveLength(3); // the kos names, then one per criterion
    for (const table of tables) expect(table.querySelectorAll('colgroup col')).toHaveLength(recent.length);
  });

  it('shows the kos names once, while every section keeps column headers for screen readers', async () => {
    const { host, recent } = await dashboard();
    const names = host.querySelector('.strip-section--names');
    expect(names.getAttribute('aria-hidden')).toBe('true');
    expect([...names.querySelectorAll('th')].map((th) => th.textContent.trim())).toEqual(recent.map((s) => s.kos.name));
    for (const section of host.querySelectorAll('.hero section.strip-section')) {
      const head = section.querySelector('thead');
      expect(head.classList.contains('visually-hidden')).toBe(true);
      expect([...head.querySelectorAll('th[scope="col"]')].map((th) => th.textContent.trim())).toEqual(recent.map((s) => s.kos.name));
    }
  });

  it('places the Compare kos button above the table, not in the text column', async () => {
    const { host } = await dashboard();
    const strip = host.querySelector('.hero__strip');
    const button = strip.querySelector('.hero__actions a.btn');
    expect(button.textContent.trim()).toBe('Compare kos');
    expect(button.getAttribute('href')).toBe('#/compare');
    expect(strip.firstElementChild.classList.contains('hero__actions')).toBe(true);
    expect(host.querySelector('.hero__text .btn')).toBeNull();
  });

  it('reads "Not recorded" where a value was not captured, never blank', async () => {
    const { host } = await dashboard((store) => {
      const base = store.getState().surveys[0];
      store.addSurvey({
        ...base,
        id: 'no-rent',
        updatedAt: new Date(Date.now() + 60_000).toISOString(),
        kos: { ...base.kos, name: 'Kos Tanpa Harga', rent: null, distanceKm: null },
      });
    });
    const cells = [...host.querySelectorAll('.hero section.strip-section td')].filter(
      (td) => td.querySelector('.strip__kos').textContent.trim() === 'Kos Tanpa Harga',
    );
    expect(cells).toHaveLength(2);
    for (const td of cells) {
      const value = td.querySelector('.strip__value');
      expect(value.textContent.trim()).toBe('Not recorded');
      expect(value.classList.contains('unrecorded')).toBe(true);
      expect(td.classList.contains('strip__best')).toBe(false);
    }
  });
});
