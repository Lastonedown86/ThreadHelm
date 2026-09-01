/** T090 — keyboard-only operation, visible focus, text scaling, contrast, reduced motion, idle. */

import { expect, test, type Page } from '@playwright/test';
import { launchWithFixtures, sessionOption, teardown, tempWorkspace } from './helpers/ui.js';

interface Focused {
  tag: string;
  name: string;
  outlineStyle: string;
  outlineWidth: string;
  html: string;
}

function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    const name =
      el.getAttribute('aria-label') ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) ||
      el.closest('label')?.textContent ||
      el.textContent ||
      '';
    return {
      tag: el.tagName,
      name: name.trim(),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      html: el.outerHTML.slice(0, 80),
    };
  });
}

/** Tabs until the focused element's accessible name matches, checking focus visibility on the way. */
async function tabTo(page: Page, pattern: RegExp, max = 40): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    const f = await focused(page);
    expect(f.name, `focused ${f.tag} ${f.html} has an accessible name`).not.toBe('');
    expect(
      f.outlineStyle !== 'none' && f.outlineWidth !== '0px',
      `focus visible on ${f.name}`,
    ).toBe(true);
    if (pattern.test(f.name)) return;
  }
  throw new Error(`never reached control matching ${pattern}`);
}

function luminance(rgb: string): number {
  const [r, g, b] = rgb
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map((v) => Number(v) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

test('keyboard-only journey with visible focus and accessible names', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace();
  const page = app.page;
  try {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await app.setPickerPath(dir);
    await page.locator('.status-bar').click(); // establish a focus origin only
    await tabTo(page, /^Choose folder/);
    await page.keyboard.press('Enter');
    const approve = page.getByRole('dialog', { name: 'Approve this folder?' });
    await expect(approve).toBeVisible();
    await tabTo(page, /^Approve folder$/);
    await page.keyboard.press('Enter');
    await expect(approve).toBeHidden();

    await tabTo(page, /^Launch Codex CLI in /);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toBeVisible();
    await tabTo(page, /cannot confine/);
    await page.keyboard.press('Space');
    await expect(dialog.getByRole('checkbox')).toBeChecked();
    // Keyboard traversal skips disabled controls. Wait for the async preview
    // and React confirmation update before trying to reach the launch button.
    await expect(dialog.getByRole('button', { name: 'Launch session', exact: true })).toBeEnabled();
    await tabTo(page, /^Launch session$/);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    const [live] = await app.liveSessions();
    await expect(sessionOption(page, live!.id)).toHaveAttribute('aria-selected', 'true');
  } finally {
    await teardown(app, dir);
  }
});

// Once a session is launched focus lands in xterm's textarea, which consumes
// Tab and Shift+Tab (they belong to the PTY). F6 is the keyboard exit that
// moves focus to the session controls (FR-021).
test('keyboard can leave the terminal to reach Stop and confirm it', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace();
  const page = app.page;
  try {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await app.setPickerPath(dir);
    await page.locator('.status-bar').click();
    await tabTo(page, /^Choose folder/);
    await page.keyboard.press('Enter');
    const approve = page.getByRole('dialog', { name: 'Approve this folder?' });
    await expect(approve).toBeVisible();
    await tabTo(page, /^Approve folder$/);
    await page.keyboard.press('Enter');
    await expect(approve).toBeHidden();
    await tabTo(page, /^Launch Codex CLI in /);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toBeVisible();
    await tabTo(page, /cannot confine/);
    await page.keyboard.press('Space');
    await expect(dialog.getByRole('checkbox')).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Launch session', exact: true })).toBeEnabled();
    await tabTo(page, /^Launch session$/);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    const [live] = await app.liveSessions();
    const interrupt = page.locator('.control-bar').getByRole('button', {
      name: 'Interrupt',
      exact: true,
    });
    await expect(interrupt).toBeEnabled();
    // Launch completion precedes the lazy terminal's mount and automatic focus.
    // Exercise F6 from xterm itself; do not send it to a loading/previous control.
    await expect(page.locator('.terminal-host .xterm-helper-textarea')).toBeFocused();
    await page.keyboard.press('F6');
    await expect(interrupt).toBeFocused();
    await tabTo(page, /^Stop…$/);
    await page.keyboard.press('Enter');
    const stop = page.getByRole('dialog', { name: 'Stop this session?' });
    await expect(stop).toBeVisible();
    await tabTo(page, /^Stop session$/);
    await page.keyboard.press('Enter');
    await expect(sessionOption(page, live!.id)).toContainText('Stopped', { timeout: 30_000 });
  } finally {
    await teardown(app, dir);
  }
});

test('text scaling, contrast, reduced motion, and idle rendering', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const page = app.page;
  try {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    // Contrast (WCAG 2.2 AA): text ≥ 4.5, borders ≥ 3 against effective backgrounds.
    const samples = await page.evaluate(() => {
      const bg = (el: Element | null): string => {
        for (let node = el; node; node = node.parentElement) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && !c.endsWith(', 0)') && c !== 'transparent') return c;
        }
        return 'rgb(255, 255, 255)';
      };
      const pick = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = getComputedStyle(el);
        return {
          selector,
          color: style.color,
          border: style.borderColor,
          background: bg(el),
          size: parseFloat(style.fontSize),
        };
      };
      return ['body', 'h2', 'p.hint', 'button', 'button.primary', '.status-bar', '.badge'].map(
        pick,
      );
    });
    for (const sample of samples) {
      if (!sample) continue;
      const min = sample.size >= 24 ? 3 : 4.5;
      expect(
        contrast(sample.color, sample.background),
        `text contrast for ${sample.selector}`,
      ).toBeGreaterThanOrEqual(min);
    }
    const button = samples.find((s) => s?.selector === 'button');
    expect(
      contrast(button!.border, button!.background),
      'button border contrast',
    ).toBeGreaterThanOrEqual(3);

    // Reduced motion: nothing animates or transitions.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await page.evaluate(
      () =>
        [...document.querySelectorAll('*')]
          .map((el) => getComputedStyle(el))
          .filter(
            (s) =>
              (s.transitionDuration && s.transitionDuration !== '0s') ||
              (s.animationDuration && s.animationDuration !== '0s'),
          ).length,
    );
    expect(motion).toBe(0);
    expect(await page.locator('canvas').count()).toBe(0);

    // Idle: no user-visible state changes without input or agent activity.
    const before = await page.evaluate(() => document.body.innerHTML);
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => document.body.innerHTML)).toBe(before);

    // Text scaling to 200%: primary controls stay visible, no horizontal scroll.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByRole('button', { name: 'Choose folder…' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sessions' })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  } finally {
    await teardown(app);
  }
});

test('mission form has named visible-focus controls, stable idle content and 200 percent reflow', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const page = app.page;
  try {
    await page.getByRole('button', { name: 'New mission…', exact: true }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Create mission', exact: true });
    await expect(dialog.getByLabel('Objective', { exact: true })).toBeFocused();
    // Traverse the real form, checking each enabled focus target rather than
    // asserting accessibility from the source markup alone.
    for (let index = 0; index < 18; index++) {
      const control = await focused(page);
      expect(control.name, `accessible name for ${control.html}`).not.toBe('');
      expect(control.outlineStyle !== 'none' && control.outlineWidth !== '0px').toBe(true);
      await page.keyboard.press('Tab');
    }
    await expect(dialog.locator('canvas,svg,img,video')).toHaveCount(0);
    const before = await dialog.innerHTML();
    await page.waitForTimeout(2000);
    expect(await dialog.innerHTML()).toBe(before);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const overflow = await dialog.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await expect(dialog.getByLabel('Objective', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  } finally {
    await teardown(app);
  }
});
