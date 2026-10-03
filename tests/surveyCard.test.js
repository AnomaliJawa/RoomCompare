import { describe, it, expect } from 'vitest';
import { surveyCard } from '../src/components/surveyCard.js';

function render(markup) {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  return host;
}

const community = {
  id: 'com-test',
  ownerName: 'Rahma',
  kos: { name: 'Kos Kartika', type: 'female', rent: 1_650_000, distanceKm: 0.9, kosLocation: { label: 'Ketawanggede, Malang' } },
  room: { photoIds: [] },
  bathroom: { photoIds: [] },
  shared: { photoIds: [] },
};

const starOf = (host) => host.querySelector('[data-action="toggle-star"]');

describe('a community survey card', () => {
  it('gives the location without naming who shared it, which its page says', () => {
    const card = render(surveyCard(community, { variant: 'community' }));
    expect(card.querySelector('.survey-card__meta .meta').textContent.trim()).toBe('Ketawanggede, Malang');
    expect(card.textContent).not.toMatch(/Shared by|Rahma/);
  });

  it('stars with an icon, its state carried by aria-pressed rather than words', () => {
    const off = starOf(render(surveyCard(community, { variant: 'community' })));
    const on = starOf(render(surveyCard(community, { variant: 'community', starred: true })));
    for (const star of [off, on]) {
      expect(star.textContent.trim()).toBe('');
      // The name stays the same either way; the pressed state says which.
      expect(star.getAttribute('aria-label')).toBe('Star Kos Kartika');
      expect(star.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
    expect(off.getAttribute('aria-pressed')).toBe('false');
    expect(on.getAttribute('aria-pressed')).toBe('true');
  });

  it('has a like button carrying its count, named for the kos', () => {
    const likeOf = (options) =>
      render(surveyCard(community, { variant: 'community', ...options })).querySelector('[data-action="toggle-like"]');
    const off = likeOf({ likes: 24 });
    const on = likeOf({ liked: true, likes: 25 });
    expect(off.dataset.id).toBe('com-test');
    expect([off.getAttribute('aria-pressed'), on.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    expect(off.querySelector('.like__count').textContent).toBe('24');
    expect(off.textContent.replace(/\s+/g, ' ').trim()).toBe('Like Kos Kartika, 24 likes');
    expect(likeOf({ likes: 1 }).textContent.replace(/\s+/g, ' ').trim()).toBe('Like Kos Kartika, 1 like');
    expect(off.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('your own survey card', () => {
  const own = { ...community, id: 'svy-test', ownerId: 'me', status: 'draft' };

  it('has no star or like and names no one', () => {
    const card = render(surveyCard(own));
    expect(starOf(card)).toBeNull();
    expect(card.querySelector('[data-action="toggle-like"]')).toBeNull();
    expect(card.querySelector('.survey-card__meta .meta').textContent.trim()).toBe('Ketawanggede, Malang');
  });

  it('shows its status as an icon, with the word as its name and tooltip', () => {
    for (const [status, word] of [['draft', 'Draft'], ['published', 'Published']]) {
      const badge = render(surveyCard({ ...own, status })).querySelector('.status');
      expect(badge.dataset.status).toBe(status);
      expect([badge.getAttribute('role'), badge.getAttribute('aria-label'), badge.getAttribute('title')]).toEqual(['img', word, word]);
      expect(badge.textContent.trim()).toBe('');
      expect(badge.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
    const draft = render(surveyCard({ ...own, status: 'draft' })).querySelector('.status svg').innerHTML;
    const published = render(surveyCard({ ...own, status: 'published' })).querySelector('.status svg').innerHTML;
    expect(draft).not.toBe(published);
  });

  it('edits and deletes with icons, each named for the kos', () => {
    const card = render(surveyCard(own));
    const edit = card.querySelector('a[href="#/surveys/svy-test/edit"]');
    const remove = card.querySelector('[data-action="ask-delete"]');
    expect(edit.getAttribute('aria-label')).toBe('Edit Kos Kartika');
    expect(remove.getAttribute('aria-label')).toBe('Delete Kos Kartika');
    expect(remove.dataset.id).toBe('svy-test');
    for (const control of [edit, remove]) {
      expect(control.textContent.trim()).toBe('');
      expect(control.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
    // View keeps its words. (The title links to the same page, so look in the actions.)
    expect(card.querySelector('.survey-card__actions a[href="#/surveys/svy-test"]').textContent.trim()).toBe('View');
  });
});
