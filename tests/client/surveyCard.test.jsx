import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SurveyCard } from '../../client/src/components/survey/SurveyCard.jsx';

const community = {
  id: 'com-test',
  ownerName: 'Rahma',
  kos: { name: 'Kos Kartika', type: 'female', rent: 1_650_000, distanceKm: 0.9, kosLocation: { label: 'Ketawanggede, Malang' } },
  room: { photoIds: [] },
  bathroom: { photoIds: [] },
  shared: { photoIds: [] },
};

const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const card = (survey, props) => render(<SurveyCard survey={survey} {...props} />).container.querySelector('article');

describe('a community survey card', () => {
  it('gives the location without naming who shared it, which its page says', () => {
    const node = card(community, { variant: 'community' });
    expect(within(node).getByText('Ketawanggede, Malang')).toBeTruthy();
    expect(node.textContent).not.toMatch(/Shared by|Rahma/);
  });

  it('stars with an icon, its state carried by aria-pressed rather than words', () => {
    const off = within(card(community, { variant: 'community' })).getByRole('button', { name: 'Star Kos Kartika' });
    const on = within(card(community, { variant: 'community', starred: true })).getByRole('button', { name: 'Star Kos Kartika' });
    for (const star of [off, on]) {
      expect(star.textContent.trim()).toBe('');
      expect(star.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
    expect([off.getAttribute('aria-pressed'), on.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
  });

  it('has a like button carrying its count, named for the kos', () => {
    const likeOf = (props) => within(card(community, { variant: 'community', ...props })).getByRole('button', { name: /^Like / });
    const off = likeOf({ likes: 24 });
    const on = likeOf({ liked: true, likes: 25 });
    expect([off.getAttribute('aria-pressed'), on.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    expect(off.querySelector('[data-like-count]').textContent).toBe('24');
    expect(text(off)).toBe('Like Kos Kartika, 24 likes');
    expect(text(likeOf({ likes: 1 }))).toBe('Like Kos Kartika, 1 like');
    expect(off.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('offers Add to compare, and says so once it is in', () => {
    expect(within(card(community, { variant: 'community' })).getByRole('button', { name: 'Add to compare' })).toBeTruthy();
    expect(within(card(community, { variant: 'community', inCompare: true })).getByRole('button', { name: 'In comparison' })).toBeTruthy();
  });
});

describe('your own survey card', () => {
  const own = { ...community, id: 'svy-test', ownerId: 'me', status: 'draft' };

  it('has no star or like and names no one', () => {
    const node = card(own);
    expect(within(node).queryByRole('button', { name: /^Star / })).toBeNull();
    expect(within(node).queryByRole('button', { name: /^Like / })).toBeNull();
    expect(within(node).getByText('Ketawanggede, Malang')).toBeTruthy();
  });

  it('shows its status as an icon, with the word as its name and tooltip', () => {
    const icons = {};
    for (const [status, word] of [['draft', 'Draft'], ['published', 'Published']]) {
      const badge = within(card({ ...own, status })).getByRole('img', { name: word });
      expect([badge.dataset.status, badge.getAttribute('title')]).toEqual([status, word]);
      expect(badge.textContent.trim()).toBe('');
      expect(badge.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
      icons[status] = badge.querySelector('svg').innerHTML;
    }
    expect(icons.draft).not.toBe(icons.published);
  });

  it('edits and deletes with icons, each named for the kos', () => {
    const node = card(own);
    const edit = within(node).getByRole('link', { name: 'Edit Kos Kartika' });
    const remove = within(node).getByRole('button', { name: 'Delete Kos Kartika' });
    expect(edit.getAttribute('href')).toBe('#/surveys/svy-test/edit');
    for (const control of [edit, remove]) {
      expect(control.textContent.trim()).toBe('');
      expect(control.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
    // View keeps its words; the title links to the same page.
    expect(within(node).getByRole('link', { name: 'View' }).getAttribute('href')).toBe('#/surveys/svy-test');
  });

  it('stands in the kos initial where it has no photo', () => {
    const node = card(own);
    expect(node.querySelector('[data-placeholder]').textContent).toBe('K');
    expect(within(node).queryByRole('img', { name: 'Kos Kartika' })).toBeNull();
  });
});

describe('what a survey says, however it is written', () => {
  const hostile = {
    ...community,
    id: 'svy-x',
    status: 'draft',
    kos: { ...community.kos, name: '<img src=x onerror="window.__owned = 1">', kosLocation: { label: '<script>window.__owned = 2</script>' } },
  };

  it('is shown as text, never run as markup', () => {
    const node = card(hostile);
    expect(window.__owned).toBeUndefined();
    expect(node.querySelector('script')).toBeNull();
    expect(node.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByRole('link', { name: hostile.kos.name }).textContent).toBe(hostile.kos.name);
    expect(within(node).getByText(hostile.kos.kosLocation.label)).toBeTruthy();
  });

  it('keeps a zero as a zero, not as nothing', () => {
    const node = card({ ...hostile, kos: { ...community.kos, rent: 0 } });
    expect(within(node).getByText('Rp 0')).toBeTruthy();
  });

  it('reads "Not recorded" for a rent or distance not captured', () => {
    const node = card({ ...community, id: 'svy-y', status: 'draft', kos: { ...community.kos, rent: null, distanceKm: null } });
    expect(within(node).getAllByText('Not recorded')).toHaveLength(2);
  });
});
