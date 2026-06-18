#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'assets/template-swiss.html');
const PREVIEW_INDEX = path.join(ROOT, 'output/theme-preview/ppt/index.html');
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cliUrl = getArg('--url');
const REQUIRED_MODES = [
  { value: 'pixelReveal', family: 'pixel/grid reveal' },
  { value: 'sliceReveal', family: 'slice reveal' },
  { value: 'canvasWipe', family: 'shader/canvas/video-style wipe' },
];

if (!existsSync(CHROME_PATH)) {
  throw new Error(`Chrome executable not found: ${CHROME_PATH}
Set CHROME_PATH to a local Chrome/Chromium executable and rerun the validation.`);
}

if (!cliUrl && !existsSync(PREVIEW_INDEX)) {
  throw new Error(`Preview file missing: ${PREVIEW_INDEX}
Run npm run render:themes first, or pass --url to an existing preview.`);
}

const staticChecks = runStaticChecks();
const server = cliUrl ? null : await startPreviewServer();
const url = cliUrl || server.url;
const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
let page;

try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  page.setDefaultTimeout(30000);
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}page_transitions=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#deck > .slide.active, #deck > .slide[data-deck-active]');
  await settle(page, 500);

  const options = await readTransitionOptions(page);
  const setMode = [];
  const lifecycles = [];
  for (const mode of REQUIRED_MODES) {
    setMode.push(await probeSetMode(page, mode.value));
    lifecycles.push(await runModeTransition(page, mode.value));
  }
  const rapidNavigation = await runRapidNavigation(page);
  const noneMode = await runDirectNavigation(page, 'none');
  const reducedMotion = await runReducedMotionNavigation(page);
  const result = {
    url,
    passed: false,
    staticChecks,
    options,
    setMode,
    lifecycles,
    rapidNavigation,
    noneMode,
    reducedMotion,
    consoleErrors,
  };
  const failures = validateResult(result);
  result.passed = failures.length === 0;
  if (failures.length) {
    console.error(JSON.stringify({ ...result, failures }, null, 2));
    throw new Error(failures.join('\n'));
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closePage(page);
  await closeBrowser(browser);
  if (server) await server.close();
}

function runStaticChecks() {
  const html = readFileSync(TEMPLATE, 'utf8');
  const selectSource = sliceBetween(html, '<select id="preview-transition">', '</select>');
  const options = [...selectSource.matchAll(/<option\s+value=["']([^"']+)["']/g)].map(match => match[1]);
  const failures = [];
  for (const mode of REQUIRED_MODES) {
    if (!options.includes(mode.value)) failures.push(`Template transition select is missing ${mode.family} mode "${mode.value}".`);
  }
  if (!options.includes('none')) failures.push('Template transition select is missing existing "none" mode.');
  if (!options.includes('liquidMorph')) failures.push('Template transition select is missing existing "liquidMorph" mode.');
  return { options, failures };
}

async function readTransitionOptions(page) {
  return page.evaluate(() => {
    const select = document.getElementById('preview-transition');
    return [...(select?.options || [])].map(option => ({
      value: option.value,
      label: (option.textContent || '').trim(),
    }));
  });
}

async function probeSetMode(page, mode) {
  return page.evaluate(mode => {
    window.__setPageTransition?.(mode);
    return {
      mode,
      stored: window.__getPageTransition?.() || '',
      global: window.__pageTransitionMode || '',
    };
  }, mode);
}

async function runModeTransition(page, mode) {
  await resetToIndex(page, 0);
  const selection = await selectTransitionMode(page, mode);
  return page.evaluate(async mode => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    const waitFor = async (predicate, timeoutMs) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (predicate()) return true;
        await wait(40);
      }
      return predicate();
    };
    const rectOf = rect => rect ? ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }) : null;
    const readStageState = () => {
      const stage = document.querySelector('.page-transition-stage');
      const deck = document.getElementById('deck-viewport');
      const stageRect = stage?.getBoundingClientRect();
      const deckRect = deck?.getBoundingClientRect();
      const visualProbeCount = stage?.querySelectorAll?.('[data-transition-probe="true"], .page-transition-pixel, .page-transition-slice, canvas[data-transition-probe="true"]').length || 0;
      return {
        exists: Boolean(stage),
        mode: stage?.dataset.transitionMode || '',
        roleCount: stage?.querySelectorAll?.('[data-transition-role]').length || 0,
        visualProbeCount,
        hasVisualProbe: visualProbeCount > 0,
        stageRect: rectOf(stageRect),
        deckRect: rectOf(deckRect),
        stageWithinDeck: Boolean(stageRect && deckRect
          && stageRect.left >= deckRect.left - 1
          && stageRect.top >= deckRect.top - 1
          && stageRect.right <= deckRect.right + 1
          && stageRect.bottom <= deckRect.bottom + 1),
      };
    };
    const targetIndex = 1;
    const initialIndex = window.__currentSlideIndex || 0;
    let commitCount = 0;
    const onChange = () => { commitCount += 1; };
    addEventListener('swiss-slide-change', onChange);
    window.go?.(targetIndex, { skipThumbPause: true });
    await nextFrame();
    const earlyStage = readStageState();
    await wait(150);
    const midStage = readStageState();
    await waitFor(() => !document.querySelector('.page-transition-stage'), 1600);
    removeEventListener('swiss-slide-change', onChange);
    return {
      mode,
      initialIndex,
      targetIndex,
      currentIndex: window.__currentSlideIndex || 0,
      commitCount,
      earlyStage,
      midStage,
      stageCountAfter: document.querySelectorAll('.page-transition-stage').length,
      transitionRoleCountAfter: document.querySelectorAll('[data-transition-role]').length,
    };
  }, mode).then(result => ({ ...result, selection }));
}

async function runRapidNavigation(page) {
  const mode = REQUIRED_MODES[0].value;
  await resetToIndex(page, 0);
  const selection = await selectTransitionMode(page, mode);
  return page.evaluate(async mode => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (predicate, timeoutMs) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (predicate()) return true;
        await wait(40);
      }
      return predicate();
    };
    const visible = window.__getVisibleSlides?.() || [...document.querySelectorAll('#deck > .slide:not([hidden])')];
    const targetIndex = Math.min(3, Math.max(1, visible.length - 1));
    let commitCount = 0;
    const onChange = () => { commitCount += 1; };
    addEventListener('swiss-slide-change', onChange);
    for (let index = 1; index <= targetIndex; index += 1) {
      window.go?.(index, { skipThumbPause: true });
      await wait(45);
    }
    await waitFor(() => !document.querySelector('.page-transition-stage'), 1800);
    removeEventListener('swiss-slide-change', onChange);
    return {
      mode,
      targetIndex,
      currentIndex: window.__currentSlideIndex || 0,
      commitCount,
      stageCountAfter: document.querySelectorAll('.page-transition-stage').length,
      transitionRoleCountAfter: document.querySelectorAll('[data-transition-role]').length,
    };
  }, mode).then(result => ({ ...result, selection }));
}

async function runDirectNavigation(page, mode) {
  await resetToIndex(page, 0);
  const selection = mode === 'none'
    ? await page.evaluate(() => {
      window.__setPageTransition?.('none');
      const select = document.getElementById('preview-transition');
      if(select) select.value = 'none';
      return { mode: 'none', selectedValue: select?.value || '', stored: window.__getPageTransition?.() || '' };
    })
    : await selectTransitionMode(page, mode);
  return page.evaluate(async mode => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    let commitCount = 0;
    const onChange = () => { commitCount += 1; };
    addEventListener('swiss-slide-change', onChange);
    window.go?.(1, { skipThumbPause: true });
    await wait(120);
    removeEventListener('swiss-slide-change', onChange);
    return {
      mode,
      currentIndex: window.__currentSlideIndex || 0,
      commitCount,
      stageCountAfter: document.querySelectorAll('.page-transition-stage').length,
    };
  }, mode).then(result => ({ ...result, selection }));
}

async function selectTransitionMode(page, mode) {
  return page.evaluate(mode => {
    const select = document.getElementById('preview-transition');
    if (!select) {
      window.__setPageTransition?.(mode);
      return { mode, selectedValue: '', stored: window.__getPageTransition?.() || '', hasSelect: false };
    }
    select.value = mode;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      mode,
      selectedValue: select.value,
      stored: window.__getPageTransition?.() || '',
      hasSelect: true,
    };
  }, mode);
}

async function runReducedMotionNavigation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await runDirectNavigation(page, REQUIRED_MODES[1].value);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return result;
}

async function resetToIndex(page, index) {
  await page.evaluate(index => {
    document.querySelectorAll('.page-transition-stage').forEach(stage => {
      stage.__transitionCancel?.();
      stage.__transitionTimeline?.kill?.();
      stage.remove();
    });
    window.__setPageTransition?.('none');
    window.go?.(index, { animate: false, force: true, skipThumbPause: true });
  }, index);
  await settle(page, 180);
}

function validateResult(result) {
  const failures = [...(result.staticChecks.failures || [])];
  const optionValues = result.options.map(option => option.value);
  for (const mode of REQUIRED_MODES) {
    if (!optionValues.includes(mode.value)) failures.push(`Runtime transition select is missing ${mode.family} mode "${mode.value}".`);
  }
  for (const probe of result.setMode) {
    if (probe.stored !== probe.mode) failures.push(`__setPageTransition("${probe.mode}") stored "${probe.stored}" instead.`);
  }
  for (const lifecycle of result.lifecycles) {
    if (lifecycle.selection.selectedValue !== lifecycle.mode || lifecycle.selection.stored !== lifecycle.mode) failures.push(`${lifecycle.mode} could not be selected through #preview-transition.`);
    if (!lifecycle.earlyStage.exists && !lifecycle.midStage.exists) failures.push(`${lifecycle.mode} did not create a transition stage.`);
    if (lifecycle.earlyStage.exists && !lifecycle.earlyStage.stageWithinDeck) failures.push(`${lifecycle.mode} transition stage is not confined to the slide stage.`);
    if (lifecycle.midStage.exists && !lifecycle.midStage.hasVisualProbe) failures.push(`${lifecycle.mode} did not expose a mode-specific mid-transition visual probe.`);
    if (lifecycle.commitCount !== 1) failures.push(`${lifecycle.mode} committed ${lifecycle.commitCount} time(s), expected 1.`);
    if (lifecycle.currentIndex !== lifecycle.targetIndex) failures.push(`${lifecycle.mode} finished on slide ${lifecycle.currentIndex}, expected ${lifecycle.targetIndex}.`);
    if (lifecycle.stageCountAfter !== 0) failures.push(`${lifecycle.mode} left ${lifecycle.stageCountAfter} transition stage(s) after completion.`);
    if (lifecycle.transitionRoleCountAfter !== 0) failures.push(`${lifecycle.mode} left ${lifecycle.transitionRoleCountAfter} transition clone(s) after completion.`);
  }
  if (result.rapidNavigation.selection.selectedValue !== result.rapidNavigation.mode || result.rapidNavigation.selection.stored !== result.rapidNavigation.mode) failures.push('Rapid navigation mode could not be selected through #preview-transition.');
  if (result.rapidNavigation.currentIndex !== result.rapidNavigation.targetIndex) failures.push(`Rapid navigation ended on slide ${result.rapidNavigation.currentIndex}, expected ${result.rapidNavigation.targetIndex}.`);
  if (result.rapidNavigation.stageCountAfter !== 0) failures.push(`Rapid navigation left ${result.rapidNavigation.stageCountAfter} transition stage(s).`);
  if (result.rapidNavigation.transitionRoleCountAfter !== 0) failures.push(`Rapid navigation left ${result.rapidNavigation.transitionRoleCountAfter} transition clone(s).`);
  if (result.noneMode.currentIndex !== 1 || result.noneMode.stageCountAfter !== 0) failures.push('none mode did not switch directly without a transition stage.');
  if (result.reducedMotion.currentIndex !== 1 || result.reducedMotion.stageCountAfter !== 0) failures.push('Reduced motion did not switch directly without a transition stage.');
  if (result.consoleErrors.length) failures.push(`Console errors were emitted: ${result.consoleErrors.join(' | ')}`);
  return failures;
}

async function settle(page, ms = 180) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return '';
  const endIndex = source.indexOf(end, startIndex + start.length);
  return endIndex < 0 ? source.slice(startIndex + start.length) : source.slice(startIndex + start.length, endIndex);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function startPreviewServer() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['scripts/serve-preview-https.mjs', 'output/theme-preview/ppt', String(port)], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  const previewUrl = `https://127.0.0.1:${port}/`;
  await waitForServer(previewUrl, child, () => output);
  return {
    url: previewUrl,
    close: () => new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      child.once('exit', finish);
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!done) child.kill('SIGKILL');
        finish();
      }, 1500).unref();
    }),
  };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(previewUrl, child, getOutput) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Preview server exited early:\n${getOutput()}`);
    if (await canOpen(previewUrl)) return;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Preview server did not become ready:\n${getOutput()}`);
}

function canOpen(previewUrl) {
  return new Promise(resolve => {
    const req = https.get(previewUrl, { rejectUnauthorized: false }, response => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function closePage(page) {
  if (!page) return;
  await page.close().catch(() => {});
}

async function closeBrowser(browser) {
  await browser.close().catch(() => {});
}
