// Exercises the real web settings with a simulated Tauri transport. No native or server settings are changed.
// Run against a local Vane dev server: node desktop/tests/shortcut-settings.mjs [http://localhost:3000]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const baseURL = process.argv[2] || 'http://localhost:3000';
const field = {
  key: 'newQuestionShortcut',
  name: 'New question',
  type: 'shortcut',
  scope: 'client',
  required: false,
  default: 'Ctrl+Alt+N',
  description: 'Open a fresh chat from anywhere in Vane.',
};

async function openSettings(desktop) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  if (desktop) {
    await context.addInitScript(() => {
      window.__VANE_DESKTOP__ = { version: 1 };
      window.nativeTest = {
        shortcut: 'Alt+Shift+Space',
        defaultShortcut: 'Alt+Shift+Space',
        calls: [],
        recording: false,
        reject: false,
      };
      window.__TAURI__ = {
        core: {
          invoke: async (command, args) => {
            const state = window.nativeTest;
            state.calls.push({ command, args });
            if (command === 'get_desktop_shortcut' && state.rejectRead)
              throw new Error('Desktop connection failed.');
            if (command === 'set_shortcut_recording') {
              state.recording = args.recording;
              return;
            }
            if (command === 'set_desktop_shortcut') {
              if (state.reject)
                throw new Error('This key combination is already in use.');
              state.shortcut = args.shortcut.replace(/\bMeta\b/g, 'Super');
              window.dispatchEvent(new Event('desktop-shortcut-changed'));
            }
            return {
              shortcut: state.shortcut,
              defaultShortcut: state.defaultShortcut,
            };
          },
        },
      };
      localStorage.setItem('newQuestionShortcut', 'Ctrl+Alt+N');
    });
  }
  await context.route('**/api/config', (route) =>
    route.fulfill({
      json: {
        fields: {
          preferences: [],
          shortcuts: [field],
          personalization: [],
          search: [],
          modelProviders: [],
        },
        values: {
          preferences: {},
          personalization: {},
          search: {},
          modelProviders: [],
        },
      },
    }),
  );
  await context.route('**/api/chats', (route) =>
    route.fulfill({ json: { chats: [] } }),
  );
  await context.route('**/api/providers', (route) =>
    route.fulfill({
      json: {
        providers: [
          {
            id: 'test',
            name: 'Test',
            chatModels: [{ key: 'test', name: 'Test' }],
            embeddingModels: [{ key: 'test', name: 'Test' }],
          },
        ],
      },
    }),
  );
  const page = await context.newPage();
  const hydrated = page.waitForResponse('**/api/providers');
  await page.goto(`${baseURL}/library`, { waitUntil: 'domcontentloaded' });
  await hydrated;
  await page.locator('svg.lucide-settings').first().locator('..').click();
  await page
    .getByRole('button', { name: 'Keyboard shortcuts', exact: true })
    .click();
  return {
    context,
    page,
    control: page.locator('button[data-shortcut-setting="new-question"]'),
  };
}

async function waitText(control, text) {
  await control.filter({ hasText: text }).waitFor();
}

try {
  const { context, page, control } = await openSettings(true);
  await waitText(control, 'Alt+Shift+Space');
  assert.equal(
    await page.evaluate(() => localStorage.getItem('newQuestionShortcut')),
    'Alt+Shift+Space',
  );

  await control.click();
  await waitText(control, 'Press a key combination');
  assert.equal(await page.evaluate(() => window.nativeTest.recording), true);
  await page.keyboard.press('Alt+Shift+Space');
  await waitText(control, 'Alt+Shift+Space');
  assert.equal(await page.evaluate(() => window.nativeTest.recording), false);
  assert.equal(new URL(page.url()).pathname, '/library'); // Native owns the action; no duplicate web navigation.

  await control.click();
  await waitText(control, 'Press a key combination');
  await page.keyboard.press('Control+Alt+K');
  await waitText(control, 'Ctrl+Alt+K');
  assert.equal(
    await page.evaluate(() => window.nativeTest.shortcut),
    'Ctrl+Alt+K',
  );

  const savesBefore = await page.evaluate(
    () =>
      window.nativeTest.calls.filter(
        (call) => call.command === 'set_desktop_shortcut',
      ).length,
  );
  await control.click();
  await waitText(control, 'Press a key combination');
  await page.keyboard.press('Escape');
  await waitText(control, 'Ctrl+Alt+K');
  assert.equal(await page.evaluate(() => window.nativeTest.recording), false);
  assert.equal(
    await page.evaluate(
      () =>
        window.nativeTest.calls.filter(
          (call) => call.command === 'set_desktop_shortcut',
        ).length,
    ),
    savesBefore,
  );

  await page.evaluate(() => {
    window.nativeTest.reject = true;
  });
  await control.click();
  await waitText(control, 'Press a key combination');
  await page.keyboard.press('Control+Alt+J');
  await page
    .getByText('Error: This key combination is already in use.', {
      exact: true,
    })
    .waitFor();
  await waitText(control, 'Ctrl+Alt+K');
  assert.equal(await page.evaluate(() => window.nativeTest.recording), false);
  assert.equal(
    await page.evaluate(() => localStorage.getItem('newQuestionShortcut')),
    'Ctrl+Alt+K',
  );

  await page.evaluate(() => {
    window.nativeTest.reject = false;
    window.nativeTest.shortcut = 'Super+Shift+J';
    window.dispatchEvent(new Event('desktop-shortcut-changed'));
  });
  await waitText(control, 'Meta+Shift+J');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await waitText(control, 'Alt+Shift+Space');
  assert.equal(
    await page.evaluate(() => window.nativeTest.shortcut),
    'Alt+Shift+Space',
  );
  await control.click();
  await waitText(control, 'Press a key combination');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitText(control, 'Alt+Shift+Space');
  assert.equal(await page.evaluate(() => window.nativeTest.recording), false);

  await page.evaluate(() => {
    window.nativeTest.rejectRead = true;
    window.dispatchEvent(new Event('desktop-shortcut-changed'));
  });
  await waitText(control, 'Desktop connection unavailable');
  assert.equal(await control.getAttribute('aria-disabled'), 'true');
  await page.evaluate(() => {
    window.nativeTest.rejectRead = false;
  });
  await page
    .getByRole('button', { name: 'Retry connection', exact: true })
    .click();
  await waitText(control, 'Alt+Shift+Space');

  await control.click();
  await waitText(control, 'Press a key combination');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.waitForFunction(() => !window.nativeTest.recording);
  await context.close();

  const standalone = await openSettings(false);
  await standalone.control.click();
  await waitText(standalone.control, 'Press a key combination');
  await standalone.page.keyboard.press('Control+Alt+K');
  await waitText(standalone.control, 'Ctrl+Alt+K');
  assert.equal(
    await standalone.page.evaluate(() =>
      localStorage.getItem('newQuestionShortcut'),
    ),
    'Ctrl+Alt+K',
  );
  await standalone.context.close();
  console.log(
    'PASS: desktop authority, recording, same-key capture, save, cancel, rejection rollback, native updates, reset, standalone browser.',
  );
} finally {
  await browser.close();
}
