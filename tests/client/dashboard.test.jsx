import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// The store reads storage once at import, so each render gets a fresh copy.
async function dashboard(prepare) {
  vi.resetModules();
  const store = await import('../../client/src/data/store.js');
  prepare?.(store);
  const { DashboardPage } = await import('../../client/src/pages/DashboardPage.jsx');
  const recent = [...store.getState().surveys].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3);
  return { ...render(<DashboardPage />), recent, store };
}

const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const strips = (container) => [...container.querySelectorAll('section[data-strip]')];

beforeEach(() => localStorage.clear());

describe('the dashboard comparison strip', () => {
  it('gives each criterion its own section, headed by its name', async () => {
    const { container } = await dashboard();
    const sections = strips(container);
    expect(sections.map((s) => text(s.querySelector('h3')))).toEqual(['Monthly rent', 'To campus']);
    for (const section of sections) {
      const heading = section.querySelector('h3');
      expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(section.querySelector('table').getAttribute('aria-labelledby')).toBe(heading.id);
    }
  });

  it('keeps every kos name, rent and distance', async () => {
    const { container, recent } = await dashboard();
    const [rent, distance] = strips(container);
    const shown = (section) => [...section.querySelectorAll('td [data-strip-value]')].map(text);
    const kos = (section) => [...section.querySelectorAll('td [data-strip-kos]')].map(text);

    expect(kos(rent)).toEqual(recent.map((s) => s.kos.name));
    expect(kos(distance)).toEqual(recent.map((s) => s.kos.name));
    expect(shown(rent)).toEqual(recent.map((s) => `Rp ${s.kos.rent.toLocaleString('id-ID')}`));
    expect(shown(distance)).toEqual(recent.map((s) => `${s.kos.distanceKm.toFixed(1).replace('.', ',')} km`));
  });

  it('marks the lowest rent and the shortest distance', async () => {
    const { container, recent } = await dashboard();
    const [rent, distance] = strips(container);
    const best = (section) => [...section.querySelectorAll('td')].map((td) => td.dataset.best === 'true');
    const cheapest = Math.min(...recent.map((s) => s.kos.rent));
    const nearest = Math.min(...recent.map((s) => s.kos.distanceKm));
    expect(best(rent)).toEqual(recent.map((s) => s.kos.rent === cheapest));
    expect(best(distance)).toEqual(recent.map((s) => s.kos.distanceKm === nearest));
  });

  it('puts every table on the same column set, so values line up across sections', async () => {
    const { container, recent } = await dashboard();
    const tables = [...container.querySelectorAll('[data-hero-strip] table')];
    expect(tables).toHaveLength(3); // the kos names, then one per criterion
    for (const table of tables) expect(table.querySelectorAll('colgroup col')).toHaveLength(recent.length);
  });

  it('shows the kos names once, while every section keeps column headers for screen readers', async () => {
    const { container, recent } = await dashboard();
    const names = container.querySelector('[data-strip-names]');
    expect(names.getAttribute('aria-hidden')).toBe('true');
    expect([...names.querySelectorAll('th')].map(text)).toEqual(recent.map((s) => s.kos.name));
    for (const section of strips(container)) {
      const head = section.querySelector('thead');
      expect(head.className).toContain('sr-only');
      expect([...head.querySelectorAll('th[scope="col"]')].map(text)).toEqual(recent.map((s) => s.kos.name));
    }
  });

  it('places the Compare kos button above the table, not in the text column', async () => {
    const { container } = await dashboard();
    const strip = container.querySelector('[data-hero-strip]');
    const button = screen.getByRole('link', { name: 'Compare kos' });
    expect(button.getAttribute('href')).toBe('#/compare');
    expect(strip.firstElementChild.contains(button)).toBe(true);
  });

  it('reads "Not recorded" where a value was not captured, never blank', async () => {
    const { container } = await dashboard((store) => {
      const base = store.getState().surveys[0];
      store.addSurvey({
        ...base,
        id: 'no-rent',
        updatedAt: new Date(Date.now() + 60_000).toISOString(),
        kos: { ...base.kos, name: 'Kos Tanpa Harga', rent: null, distanceKm: null },
      });
    });
    const cells = [...container.querySelectorAll('section[data-strip] td')].filter(
      (td) => text(td.querySelector('[data-strip-kos]')) === 'Kos Tanpa Harga',
    );
    expect(cells).toHaveLength(2);
    for (const td of cells) {
      const value = td.querySelector('[data-strip-value]');
      expect(text(value)).toBe('Not recorded');
      expect(value.className).toContain('italic');
      expect(td.dataset.best).toBeUndefined();
    }
  });

  it('starts empty for a new account, pointing to the first survey', async () => {
    await dashboard((store) => store.adoptSurveys([], 'u1'));
    expect(screen.getByText('No kos recorded yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add survey' }).getAttribute('href')).toBe('#/surveys/new');
    expect(screen.getByText('Nothing recorded yet.')).toBeTruthy();
  });
});

describe('the Best Match criteria panel', () => {
  const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 3, security: 12 };
  const panel = () => screen.getByRole('heading', { name: 'Best Match criteria', level: 2 }).closest('section');
  const listed = (section) => [...section.querySelectorAll('li')].map((item) => [...item.querySelectorAll('span')].map(text));

  it('lists the defaults for an account that has not changed them', async () => {
    await dashboard((store) => store.setUser({ id: 'u1', email: 'a@example.test', name: 'A' }));
    const section = panel();
    expect(listed(section)).toEqual([
      ['Price', '25%'],
      ['Facilities', '20%'],
      ['Cleanliness', '15%'],
      ['Location (distance and amenities)', '15%'],
      ['Distance to campus', '13%'],
      ['Security', '12%'],
    ]);
    expect(text(section.querySelector('[data-weights-note]'))).toContain('These are the defaults.');
    expect(text(section)).not.toMatch(/fixed/i);
  });

  it('lists the account’s own weights, and says whose they are', async () => {
    await dashboard((store) => {
      store.setUser({ id: 'u1', email: 'a@example.test', name: 'A' });
      store.setBestMatchWeights(custom);
    });
    const section = panel();
    expect(listed(section).map(([, weight]) => weight)).toEqual(['35%', '20%', '15%', '15%', '3%', '12%']);
    expect(text(section.querySelector('[data-weights-note]'))).toContain('These are your own.');
  });

  it('opens the criteria dialog from its heading', async () => {
    await dashboard((store) => store.setUser({ id: 'u1', email: 'a@example.test', name: 'A' }));
    const edit = screen.getByRole('button', { name: 'Edit Best Match criteria' });
    expect(text(edit)).toBe('Edit');
    expect(edit.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(edit);
    expect(document.querySelector('dialog[open]').getAttribute('aria-labelledby')).toBe('criteria-dialog-title');
  });
});
