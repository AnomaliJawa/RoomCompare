import { describe, it, expect } from 'vitest';
import { html, raw, escapeHtml, mount, getCheckedValues } from '../src/utils/dom.js';

describe('escapeHtml', () => {
  it('neutralises the characters that let markup in', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('treats absent values as empty, not as the word null', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('the html tag', () => {
  it('escapes interpolated values', () => {
    const name = '<img src=x onerror="alert(1)">';
    expect(String(html`<h1>${name}</h1>`)).toBe(
      '<h1>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</h1>',
    );
  });

  it('composes nested templates instead of escaping them', () => {
    // A plain string here once rendered every nested call's markup as visible text.
    const badge = html`<span class="status">Published</span>`;
    expect(String(html`<div>${badge}</div>`)).toBe('<div><span class="status">Published</span></div>');
  });

  it('joins arrays, including arrays of templates', () => {
    const items = ['a', 'b'].map((letter) => html`<li>${letter}</li>`);
    expect(String(html`<ul>${items}</ul>`)).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('inserts raw() content untouched', () => {
    expect(String(html`<div>${raw('<b>bold</b>')}</div>`)).toBe('<div><b>bold</b></div>');
  });

  it('renders nothing for null, undefined and false', () => {
    expect(String(html`<p>${null}${undefined}${false}</p>`)).toBe('<p></p>');
  });

  it('renders a genuine zero rather than swallowing it', () => {
    expect(String(html`<p>${0}</p>`)).toBe('<p>0</p>');
  });

  it('escapes a value that arrives inside an attribute', () => {
    const value = '" onmouseover="alert(1)';
    const output = String(html`<input value="${value}" />`);
    expect(output).not.toContain('onmouseover="alert');
    expect(output).toContain('&quot;');
  });
});

describe('mount', () => {
  it('renders a template into a node without executing scripts', () => {
    const node = document.createElement('div');
    mount(node, html`<p>${'<script>window.__x = 1</script>'}</p>`);
    expect(window.__x).toBeUndefined();
    expect(node.querySelector('script')).toBeNull();
    expect(node.textContent).toContain('<script>');
  });
});

describe('getCheckedValues', () => {
  it('reads only the checked boxes, and only within its own scope', () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input type="checkbox" name="facility" value="AC" checked>
      <input type="checkbox" name="facility" value="Fan">
      <input type="checkbox" name="facility" value="Window" checked>
    `;
    const other = document.createElement('form');
    other.innerHTML = '<input type="checkbox" name="facility" value="Elsewhere" checked>';
    document.body.append(form, other);

    // Scoped, so two forms on a page cannot see each other's boxes.
    expect(getCheckedValues('facility', form)).toEqual(['AC', 'Window']);
    expect(getCheckedValues('facility', other)).toEqual(['Elsewhere']);

    form.remove();
    other.remove();
  });
});
