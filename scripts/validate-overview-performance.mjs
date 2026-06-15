#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PREVIEW_ROOT = path.join(ROOT, 'output/theme-preview/ppt');
const PREVIEW_INDEX = path.join(PREVIEW_ROOT, 'index.html');
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THRESHOLDS = {
  minCards: 70,
  visibleCards: 6,
  openFrameMs: 140,
  firstCardMs: 180,
  firstVisibleCardsMs: 220,
  allCardsMs: 420,
  hoverMs: 50,
  dragStartMs: 80,
  dragOverMs: 50,
  dropImmediateMs: 90,
  clickMs: 90,
  closeMs: 90,
  reopenMs: 140,
  interactionWindowMs: 300,
  backgroundWindowMs: 650,
  postScrollSettleMs: 2000,
  postScrollLongTaskCount: 2,
  repeatedOpenCount: 3,
  repeatedOpenReadyMs: 900,
  repeatedOpenWindowMs: 5200,
  repeatedOpenLongTaskCount: 2,
  postDropWindowMs: 3200,
  postDropLongTaskCount: 1,
  postDropCommitDelayMs: 650,
  postDropCommitDurationMs: 180,
  postDropProbeMs: 120,
  firstVisibleThumbReadyMs: 900,
  allVisibleThumbsReadyMs: 2500,
  visibleThumbReadyWindowMs: 2500,
  cachedInteractionMin: 8,
  interactionLongTaskMaxMs: 90,
  interactionLongTaskCount: 1,
  backgroundLongTaskMaxMs: 140,
  cacheApproxChars: 18 * 1024 * 1024,
};

const cliUrl = getArg('--url');

if (!existsSync(CHROME_PATH)) {
  throw new Error(`Chrome executable not found: ${CHROME_PATH}
Set CHROME_PATH to a local Chrome/Chromium executable and rerun npm run validate:overview-performance.`);
}

if (!existsSync(PREVIEW_INDEX) && !cliUrl) {
  throw new Error(`Preview file missing: ${PREVIEW_INDEX}
Run npm run render:themes first, or pass --url to an existing preview.`);
}

const server = cliUrl ? null : await startPreviewServer();
const url = cliUrl || server.url;
const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
let page;

try {
  page = await browser.newPage({ viewport: { width: 1500, height: 950 }, ignoreHTTPSErrors: true });
  page.setDefaultTimeout(30000);
  await page.goto(`${url}?overview_perf=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#deck > .slide');
  await installLongTaskObserver(page);
  await assertPerfApi(page);
  await page.evaluate(async () => {
    window.__setActiveThemePack?.('theme01', { navigate: false });
    window.go?.(0, { animate: false, force: true });
    window.__resetOverviewPerfMarks?.();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const openStart = await now(page);
  await page.evaluate(() => window.__toggleOverview?.());
  await nextFrame(page);
  const openFrameEnd = await now(page);

  await page.waitForFunction(() => document.querySelectorAll('[data-overview-card="true"]').length > 0);
  const firstCardAt = await now(page);

  await page.waitForFunction((minimumVisible) => {
    return getVisibleOverviewCardCount() >= minimumVisible;

    function getVisibleOverviewCardCount() {
      const overview = document.getElementById('overview');
      if (!overview) return 0;
      const rootRect = overview.getBoundingClientRect();
      return [...document.querySelectorAll('[data-overview-card="true"]')]
        .filter(card => {
          const rect = card.getBoundingClientRect();
          return rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
        }).length;
    }
  }, THRESHOLDS.visibleCards);
  const firstVisibleCardsAt = await now(page);

  await page.waitForFunction((minimumCards) => window.__getOverviewPerfState?.().cardCount >= minimumCards, THRESHOLDS.minCards);
  const allCardsAt = await now(page);
  const coldVisibleThumbs = await measureVisibleThumbReadiness(page, openStart, THRESHOLDS.visibleThumbReadyWindowMs);

  const backgroundStart = await now(page);
  await page.waitForTimeout(THRESHOLDS.backgroundWindowMs);
  const backgroundEnd = await now(page);
  const stateAfterBackground = await getState(page);
  const progressAfterBackground = await getOverviewProgressState(page);

  const scrollMid = await measureInteraction(page, 'scrollMid', async () => {
    await scrollOverviewTo(page, 0.5);
  });
  const stateAfterScrollMid = await getState(page);

  const scrollBottom = await measureInteraction(page, 'scrollBottom', async () => {
    await scrollOverviewTo(page, 1);
  });
  const stateAfterScrollBottom = await getState(page);

  const scrollTop = await measureInteraction(page, 'scrollTop', async () => {
    await scrollOverviewTo(page, 0);
  });
  const stateAfterScrollTop = await getState(page);

  const postScrollStart = await now(page);
  await page.waitForTimeout(THRESHOLDS.postScrollSettleMs);
  const postScrollEnd = await now(page);
  const stateAfterScrollStable = await getState(page);
  const loadedStateAfterScroll = await getOverviewLoadedState(page);

  const hoverBox = await page.locator('[data-overview-card="true"]').first().boundingBox();
  if (!hoverBox) throw new Error('Hover card box missing');
  const hover = await measureInteraction(page, 'hover', async () => {
    await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
    await nextFrame(page);
  });
  const stateAfterHover = await getState(page);

  const source = page.locator('[data-overview-card="true"][data-index="2"]');
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error('Source overview card box missing');
  const dragStart = await measureInteraction(page, 'dragStart', async () => {
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + sourceBox.height / 2 + 10, { steps: 2 });
    await nextFrame(page);
  });
  const stateDuringDrag = await getState(page);

  const dragOverSamples = [];
  const targetBox = await page.locator('[data-overview-card="true"][data-index="7"]').boundingBox();
  if (!targetBox) throw new Error('Target overview card box missing');
  for (let step = 0; step < 4; step += 1) {
    const dragOver = await measureImmediate(page, `dragOver${step}`, async () => {
      await page.mouse.move(targetBox.x + targetBox.width / 2 + step * 5, targetBox.y + targetBox.height / 2, { steps: 1 });
      await nextFrame(page);
    });
    dragOverSamples.push(dragOver.durationMs);
  }

  const drop = await measureInteraction(page, 'drop', async () => {
    await page.mouse.up();
    await nextFrame(page);
  });
  const stateAfterDropFrame = await getState(page);

  await page.waitForFunction(() => {
    const state = window.__getOverviewPerfState?.();
    return state?.lastDrop?.deckCommittedAt && state.lastDrop.deckCommittedAt > state.lastDrop.localDomCommittedAt;
  }, undefined, { timeout: 2500 });
  const stateAfterDropCommit = await getState(page);

  const click = await measureInteraction(page, 'click', async () => {
    await page.locator('[data-overview-card="true"][data-index="1"]').click();
    await nextFrame(page);
  });
  const stateAfterClick = await getState(page);

  const reopenStart = await now(page);
  await page.evaluate(() => window.__toggleOverview?.());
  await nextFrame(page);
  const reopenEnd = await now(page);
  await page.waitForFunction((minimumCards) => window.__getOverviewPerfState?.().cardCount >= minimumCards, THRESHOLDS.minCards);
  await page.waitForTimeout(THRESHOLDS.backgroundWindowMs);
  const stateAfterReopen = await getState(page);

  const dirtyResult = await runDirtyValidation(page);

  const close = await measureInteraction(page, 'close', async () => {
    await page.evaluate(() => window.__toggleOverview?.());
    await nextFrame(page);
  });
  const stateAfterClose = await getState(page);
  const repeatedOpen = await runRepeatedOpenValidation(page);
  const repeatedDrop = await runRepeatedDropValidation(page);

  const result = {
    url,
    cards: stateAfterBackground.cardCount,
    timings: {
      openFrameMs: round(openFrameEnd - openStart),
      firstCardMs: round(firstCardAt - openStart),
      firstVisibleCardsMs: round(firstVisibleCardsAt - openStart),
      allCardsMs: round(allCardsAt - openStart),
      hoverMs: hover.durationMs,
      scrollMaxMs: Math.max(scrollMid.durationMs, scrollBottom.durationMs, scrollTop.durationMs),
      dragStartMs: dragStart.durationMs,
      dragOverMaxMs: Math.max(...dragOverSamples),
      dropImmediateMs: drop.durationMs,
      clickMs: click.durationMs,
      reopenMs: round(reopenEnd - reopenStart),
      closeMs: close.durationMs,
    },
    longTasks: {
      open: summarizeLongTasks(await longTasksInWindow(page, openStart, allCardsAt)),
      background: summarizeLongTasks(await longTasksInWindow(page, backgroundStart, backgroundEnd)),
      postScrollSettle: summarizeLongTasks(await longTasksInWindow(page, postScrollStart, postScrollEnd)),
      scrollMid: scrollMid.longTasks,
      scrollBottom: scrollBottom.longTasks,
      scrollTop: scrollTop.longTasks,
      hover: hover.longTasks,
      dragStart: dragStart.longTasks,
      drop: drop.longTasks,
      click: click.longTasks,
      close: close.longTasks,
    },
    captureStarts: {
      background: await captureStartsInWindow(page, backgroundStart, backgroundEnd),
      postScrollSettle: await captureStartsInWindow(page, postScrollStart, postScrollEnd),
      scrollMid: scrollMid.captureStarts,
      scrollBottom: scrollBottom.captureStarts,
      scrollTop: scrollTop.captureStarts,
      hover: hover.captureStarts,
      dragStart: dragStart.captureStarts,
      drop: drop.captureStarts,
      click: click.captureStarts,
      close: close.captureStarts,
    },
    states: {
      afterBackground: pickState(stateAfterBackground),
      afterScrollMid: pickState(stateAfterScrollMid),
      afterScrollBottom: pickState(stateAfterScrollBottom),
      afterScrollTop: pickState(stateAfterScrollTop),
      afterScrollStable: pickState(stateAfterScrollStable),
      afterHover: pickState(stateAfterHover),
      duringDrag: pickState(stateDuringDrag),
      afterDropFrame: pickState(stateAfterDropFrame),
      afterDropCommit: pickState(stateAfterDropCommit),
      afterClick: pickState(stateAfterClick),
      afterReopen: pickState(stateAfterReopen),
      afterClose: pickState(stateAfterClose),
    },
    loadedStateAfterScroll,
    progressAfterBackground,
    coldVisibleThumbs,
    dirtyResult,
    dragOverSamples,
    repeatedOpen,
    repeatedDrop,
  };

  const failures = validateResult(result, stateAfterReopen);
  if (failures.length) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(failures.join('\n'));
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closePage(page);
  await closeBrowser(browser);
  if (server) await server.close();
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function startPreviewServer() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['scripts/serve-preview-https.mjs', 'output/theme-preview/ppt', String(port)], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
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
    await wait(120);
  }
  throw new Error(`Preview server did not become ready:\n${getOutput()}`);
}

function canOpen(previewUrl) {
  return new Promise(resolve => {
    const req = https.get(previewUrl, { rejectUnauthorized: false }, res => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
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
  await page.evaluate(() => window.__overviewPerfLongTaskObserver?.disconnect?.()).catch(() => {});
  await Promise.race([
    page.close({ runBeforeUnload: false }).catch(() => {}),
    wait(2000),
  ]);
}

async function closeBrowser(browser) {
  const browserProcess = typeof browser.process === 'function' ? browser.process() : null;
  await Promise.race([
    browser.close().catch(() => {}),
    wait(4000),
  ]);
  if (browserProcess && browserProcess.exitCode === null) browserProcess.kill('SIGKILL');
}

async function installLongTaskObserver(page) {
  await page.evaluate(() => {
    window.__overviewPerfLongTasks = [];
    if (!('PerformanceObserver' in window)) return;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__overviewPerfLongTasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    window.__overviewPerfLongTaskObserver = observer;
  });
}

async function assertPerfApi(page) {
  const hasApi = await page.evaluate(() => ({
    getState: typeof window.__getOverviewPerfState === 'function',
    reset: typeof window.__resetOverviewPerfMarks === 'function',
  }));
  if (!hasApi.getState || !hasApi.reset) {
    throw new Error('Overview perf debug API missing: expected window.__getOverviewPerfState and window.__resetOverviewPerfMarks');
  }
}

async function getState(page) {
  return page.evaluate(() => window.__getOverviewPerfState());
}

async function now(page) {
  return page.evaluate(() => performance.now());
}

async function nextFrame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function scrollOverviewTo(page, ratio) {
  await page.evaluate(async (scrollRatio) => {
    const overview = document.getElementById('overview');
    if (!overview) throw new Error('Overview element missing');
    const maxScroll = Math.max(0, overview.scrollHeight - overview.clientHeight);
    overview.scrollTop = Math.round(maxScroll * scrollRatio);
    overview.dispatchEvent(new Event('scroll', { bubbles: true }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, ratio);
}

async function measureImmediate(page, label, fn) {
  const start = await now(page);
  await fn();
  const end = await now(page);
  return {
    label,
    start,
    end,
    durationMs: round(end - start),
    longTasks: summarizeLongTasks(await longTasksInWindow(page, start, end)),
    captureStarts: await captureStartsInWindow(page, start, end),
  };
}

async function measureInteraction(page, label, fn) {
  const start = await now(page);
  await fn();
  const immediateEnd = await now(page);
  await page.waitForTimeout(THRESHOLDS.interactionWindowMs);
  const windowEnd = await now(page);
  return {
    label,
    start,
    immediateEnd,
    windowEnd,
    durationMs: round(immediateEnd - start),
    longTasks: summarizeLongTasks(await longTasksInWindow(page, start, windowEnd)),
    captureStarts: await captureStartsInWindow(page, start, windowEnd),
  };
}

async function longTasksInWindow(page, start, end) {
  return page.evaluate(({ start, end }) => {
    return (window.__overviewPerfLongTasks || []).filter(task => {
      const taskStart = task.startTime;
      const taskEnd = task.startTime + task.duration;
      return taskEnd >= start && taskStart <= end;
    });
  }, { start, end });
}

async function captureStartsInWindow(page, start, end) {
  return page.evaluate(({ start, end }) => {
    const captures = window.__getOverviewPerfState?.().marks?.captures || [];
    return captures
      .map(capture => ({
        slideId: capture.slideId || capture.key || '',
        trigger: capture.trigger || capture.reason || '',
        startedAt: Number(capture.startedAt ?? capture.startAt ?? capture.start ?? 0),
      }))
      .filter(capture => capture.startedAt >= start && capture.startedAt <= end);
  }, { start, end });
}

function summarizeLongTasks(tasks) {
  const durations = tasks.map(task => Math.round(task.duration));
  return {
    count: durations.length,
    countOver50: durations.filter(ms => ms >= 50).length,
    maxMs: durations.length ? Math.max(...durations) : 0,
  };
}

function pickState(state) {
  return {
    overviewOn: state.overviewOn,
    cardCount: state.cardCount,
    renderedCount: state.renderedCount,
    visibleOrNearCount: state.visibleOrNearCount,
    queueLength: state.queueLength,
    processing: state.processing,
    scheduled: state.scheduled,
    pauseRemainingMs: Math.round(state.pauseRemainingMs || 0),
    cacheSize: state.cacheSize,
    cacheLimit: state.cacheLimit,
    cacheApproxChars: state.cacheApproxChars,
    activeSlideId: state.activeSlideId,
    cacheKeys: state.cacheKeys,
    queuedKeys: state.queuedKeys,
    lastDrop: state.lastDrop,
    layoutReads: state.marks?.layoutReads || [],
    captureCount: state.marks?.captures?.length || 0,
  };
}

async function getOverviewLoadedState(page) {
  return page.evaluate(() => {
    const overview = document.getElementById('overview');
    const state = window.__getOverviewPerfState?.() || {};
    if (!overview) {
      return {
        fullLoaded: false,
        visibleOrNearLoaded: false,
        visibleOrNearRendered: 0,
        visibleOrNearCount: 0,
      };
    }
    const rootRect = overview.getBoundingClientRect();
    const nearMargin = 720;
    const nearWraps = [...overview.querySelectorAll('[data-overview-thumb="true"]')].filter(wrap => {
      const rect = wrap.getBoundingClientRect();
      return rect.bottom >= rootRect.top - nearMargin && rect.top <= rootRect.bottom + nearMargin;
    });
    const visibleOrNearRendered = nearWraps.filter(wrap => wrap.dataset.overviewRendered === 'true').length;
    const queueEmpty = Number(state.queueLength || 0) === 0 && !state.processing && !state.scheduled;
    return {
      fullLoaded: Number(state.renderedCount || 0) === Number(state.cardCount || 0) && queueEmpty,
      visibleOrNearLoaded: nearWraps.length > 0 && visibleOrNearRendered === nearWraps.length && queueEmpty,
      visibleOrNearRendered,
      visibleOrNearCount: nearWraps.length,
      queueEmpty,
    };
  });
}

async function measureVisibleThumbReadiness(page, openStart, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let firstAt = null;
  let allAt = null;
  let stats = await getVisibleThumbStats(page);
  while (Date.now() < deadline) {
    stats = await getVisibleThumbStats(page);
    const current = await now(page);
    if (!firstAt && stats.visibleCount > 0 && stats.visibleRenderedCount > 0) firstAt = current;
    if (stats.visibleCount > 0 && stats.visibleRenderedCount === stats.visibleCount) {
      allAt = current;
      break;
    }
    await page.waitForTimeout(80);
  }
  stats = await getVisibleThumbStats(page);
  return {
    ...stats,
    visibleViewportCount: stats.visibleCount,
    visibleViewportRenderedCount: stats.visibleRenderedCount,
    visibleViewportMissingCount: stats.visibleMissingCount,
    visibleViewportRenderedRatioAt2s: stats.visibleCount ? round(stats.visibleRenderedCount / stats.visibleCount) : 0,
    firstVisibleThumbReadyMs: firstAt ? round(firstAt - openStart) : null,
    allVisibleThumbsReadyMs: allAt ? round(allAt - openStart) : null,
    firstVisibleViewportThumbReadyMs: firstAt ? round(firstAt - openStart) : null,
    allVisibleViewportThumbsReadyMs: allAt ? round(allAt - openStart) : null,
    timeoutMs,
  };
}

async function getVisibleThumbStats(page) {
  return page.evaluate(() => {
    const overview = document.getElementById('overview');
    if (!overview) return { visibleCount: 0, visibleRenderedCount: 0, visibleMissingCount: 0 };
    const rootRect = overview.getBoundingClientRect();
    const visibleWraps = [...overview.querySelectorAll('[data-overview-thumb="true"]')].filter(wrap => {
      const rect = wrap.getBoundingClientRect();
      return rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
    });
    const visibleRenderedCount = visibleWraps.filter(wrap => wrap.dataset.overviewRendered === 'true').length;
    return {
      visibleCount: visibleWraps.length,
      visibleRenderedCount,
      visibleMissingCount: visibleWraps.length - visibleRenderedCount,
    };
  });
}

async function getOverviewProgressState(page) {
  return page.evaluate(() => {
    const overview = document.getElementById('overview');
    if (!overview) return { visible: false, blocksViewport: false, text: '', height: 0 };
    const progress = overview.querySelector('[data-overview-progress="true"]')
      || [...overview.children].find(child => /目录缩略图|当前视图/.test(child.textContent || ''));
    if (!progress) return { visible: false, blocksViewport: false, text: '', height: 0 };
    const rect = progress.getBoundingClientRect();
    const style = getComputedStyle(progress);
    const visible = !progress.hidden
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0.01
      && rect.width > 0
      && rect.height > 0;
    const overviewRect = overview.getBoundingClientRect();
    return {
      visible,
      blocksViewport: visible && rect.bottom > overviewRect.top + 8,
      text: (progress.textContent || '').replace(/\s+/g, ' ').trim(),
      height: Math.round(rect.height),
      top: Math.round(rect.top - overviewRect.top),
      bottom: Math.round(rect.bottom - overviewRect.top),
    };
  });
}

async function runDirtyValidation(page) {
  await page.waitForFunction(() => {
    const state = window.__getOverviewPerfState?.();
    if (!state?.activeSlideId || !Array.isArray(state.cacheKeys)) return false;
    const activeKeyPart = `|${state.activeSlideId}|`;
    return state.cacheKeys.some(key => key.includes(activeKeyPart))
      && state.cacheKeys.some(key => !key.includes(activeKeyPart));
  }, undefined, { timeout: 5000 });

  return page.evaluate(() => {
    const before = window.__getOverviewPerfState();
    const activeId = before.activeSlideId;
    const activeKeyPart = `|${activeId}|`;
    const beforeKeys = before.cacheKeys || [];
    const activeKeysBefore = beforeKeys.filter(key => key.includes(activeKeyPart));
    const otherKeysBefore = beforeKeys.filter(key => !key.includes(activeKeyPart));
    const activeSlide = document.querySelector('#deck > .slide.active');
    window.__markOverviewThumbDirty?.(activeSlide);
    const after = window.__getOverviewPerfState();
    const afterKeys = after.cacheKeys || [];
    const removed = beforeKeys.filter(key => !afterKeys.includes(key));
    return {
      activeId,
      beforeKeys,
      afterKeys,
      activeKeysBefore,
      otherKeysBefore,
      removed,
      otherKeysStillPresent: otherKeysBefore.every(key => afterKeys.includes(key)),
    };
  });
}

async function runRepeatedOpenValidation(page) {
  const cycles = [];
  await warmVisibleViewportThumbs(page);
  await ensureOverviewClosed(page);
  for (let index = 0; index < THRESHOLDS.repeatedOpenCount; index += 1) {
    await page.evaluate(() => {
      window.__resetOverviewPerfMarks?.();
      window.__overviewPerfLongTasks = [];
    });
    const start = await now(page);
    await page.evaluate(() => window.__toggleOverview?.());
    await page.waitForFunction(({ minCards, visibleCards }) => {
      const state = window.__getOverviewPerfState?.();
      return state?.overviewOn && state.cardCount >= minCards && state.visibleOrNearCount >= visibleCards;
    }, { minCards: THRESHOLDS.minCards, visibleCards: THRESHOLDS.visibleCards });
    await nextFrame(page);
    const readyAt = await now(page);
    const hoverBox = await page.locator('[data-overview-card="true"]').first().boundingBox();
    if (!hoverBox) throw new Error('Repeated-open hover card box missing');
    const hover = await measureInteraction(page, `repeatedOpen${index}Hover`, async () => {
      await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    });
    const windowStart = await now(page);
    await page.waitForTimeout(THRESHOLDS.repeatedOpenWindowMs);
    const windowEnd = await now(page);
    const state = await getState(page);
    const stages = await stagesInWindow(page, start, windowEnd);
    cycles.push({
      index,
      readyMs: round(readyAt - start),
      hoverMs: hover.durationMs,
      longTasks: summarizeLongTasks(await longTasksInWindow(page, start, windowEnd)),
      captureStarts: await captureStartsInWindow(page, start, windowEnd),
      state: pickState(state),
      progress: await getOverviewProgressState(page),
      stages: summarizeStages(stages),
      layoutReads: layoutReadsInWindow(state, start, windowEnd),
      windowMs: round(windowEnd - windowStart),
    });
    await ensureOverviewClosed(page);
  }
  return cycles;
}

async function warmVisibleViewportThumbs(page) {
  await ensureOverviewOpen(page);
  await page.waitForFunction(() => {
    const overview = document.getElementById('overview');
    if (!overview) return false;
    const rootRect = overview.getBoundingClientRect();
    const visibleWraps = [...overview.querySelectorAll('[data-overview-thumb="true"]')].filter(wrap => {
      const rect = wrap.getBoundingClientRect();
      return rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
    });
    return visibleWraps.length > 0 && visibleWraps.every(wrap => wrap.dataset.overviewRendered === 'true');
  }, undefined, { timeout: 10000 }).catch(() => {});
  await ensureOverviewClosed(page);
}

async function runRepeatedDropValidation(page) {
  await ensureOverviewOpen(page);
  await page.evaluate(() => {
    window.__resetOverviewPerfMarks?.();
    window.__overviewPerfLongTasks = [];
  });
  await page.waitForFunction((minimumCards) => window.__getOverviewPerfState?.().cardCount >= minimumCards, THRESHOLDS.minCards);
  await nextFrame(page);

  const sourceBox = await page.locator('[data-overview-card="true"][data-index="3"]').boundingBox();
  const targetBox = await page.locator('[data-overview-card="true"][data-index="9"]').boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Repeated-drop source/target card box missing');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 12, { steps: 2 });
  await nextFrame(page);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 3 });
  await nextFrame(page);

  const dropStart = await now(page);
  await page.mouse.up();
  await nextFrame(page);
  const immediateEnd = await now(page);
  const immediateHoverBox = await page.locator('[data-overview-card="true"]').first().boundingBox();
  if (!immediateHoverBox) throw new Error('Immediate post-drop hover card box missing');
  const postDropImmediateHover = await measureInteraction(page, 'postDropImmediateHover', async () => {
    await page.mouse.move(immediateHoverBox.x + immediateHoverBox.width / 2, immediateHoverBox.y + immediateHoverBox.height / 2);
    await nextFrame(page);
  });
  await page.waitForFunction(() => {
    const state = window.__getOverviewPerfState?.();
    return state?.lastDrop?.deckCommittedAt && state.lastDrop.deckCommittedAt > state.lastDrop.localDomCommittedAt;
  }, undefined, { timeout: 3000 });
  const committedState = await getState(page);
  const commitAt = Number(committedState.lastDrop?.deckCommittedAt || 0);

  const immediateDragProbeBox = await page.locator('[data-overview-card="true"][data-index="4"]').boundingBox();
  if (!immediateDragProbeBox) throw new Error('Immediate post-drop drag probe card box missing');
  const postDropImmediateDrag = await measureInteraction(page, 'postDropImmediateDragStart', async () => {
    await page.mouse.move(immediateDragProbeBox.x + immediateDragProbeBox.width / 2, immediateDragProbeBox.y + immediateDragProbeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(immediateDragProbeBox.x + immediateDragProbeBox.width / 2 + 8, immediateDragProbeBox.y + immediateDragProbeBox.height / 2 + 8, { steps: 1 });
    await nextFrame(page);
    await page.mouse.up();
    await nextFrame(page);
  });

  await page.waitForTimeout(THRESHOLDS.postDropWindowMs);
  const windowEnd = await now(page);
  const stateAfterWindow = await getState(page);

  const hoverBox = await page.locator('[data-overview-card="true"]').first().boundingBox();
  if (!hoverBox) throw new Error('Post-drop hover card box missing');
  const postDropHover = await measureInteraction(page, 'postDropHover', async () => {
    await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
    await nextFrame(page);
  });

  const dragProbeBox = await page.locator('[data-overview-card="true"][data-index="4"]').boundingBox();
  if (!dragProbeBox) throw new Error('Post-drop drag probe card box missing');
  const postDropDrag = await measureInteraction(page, 'postDropDragStart', async () => {
    await page.mouse.move(dragProbeBox.x + dragProbeBox.width / 2, dragProbeBox.y + dragProbeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragProbeBox.x + dragProbeBox.width / 2 + 8, dragProbeBox.y + dragProbeBox.height / 2 + 8, { steps: 1 });
    await nextFrame(page);
    await page.mouse.up();
    await nextFrame(page);
  });

  const stages = await stagesInWindow(page, dropStart, windowEnd);
  return {
    dropImmediateMs: round(immediateEnd - dropStart),
    commitDelayMs: round(commitAt - dropStart),
    deckCommitDurationMs: round(committedState.lastDrop?.deckCommitDurationMs || 0),
    deckAppendDurationMs: round(committedState.lastDrop?.deckAppendDurationMs || 0),
    deckMutationDurationMs: round(committedState.lastDrop?.deckMutationDurationMs || 0),
    postDropWindowMs: round(windowEnd - dropStart),
    postDropImmediateHoverMs: postDropImmediateHover.durationMs,
    postDropImmediateHoverLongTasks: postDropImmediateHover.longTasks,
    postDropImmediateHoverCaptureStarts: postDropImmediateHover.captureStarts,
    postDropImmediateDragStartMs: postDropImmediateDrag.durationMs,
    postDropImmediateDragLongTasks: postDropImmediateDrag.longTasks,
    postDropImmediateDragCaptureStarts: postDropImmediateDrag.captureStarts,
    postDropHoverMs: postDropHover.durationMs,
    postDropDragStartMs: postDropDrag.durationMs,
    longTasks: summarizeLongTasks(await longTasksInWindow(page, dropStart, windowEnd)),
    captureStarts: await captureStartsInWindow(page, dropStart, windowEnd),
    stateAfterWindow: pickState(stateAfterWindow),
    stages: summarizeStages(stages),
    layoutReads: layoutReadsInWindow(stateAfterWindow, dropStart, windowEnd),
  };
}

async function ensureOverviewClosed(page) {
  const open = await page.evaluate(() => !!window.__getOverviewPerfState?.().overviewOn);
  if (open) {
    await page.evaluate(() => window.__toggleOverview?.());
    await nextFrame(page);
  }
}

async function ensureOverviewOpen(page) {
  const open = await page.evaluate(() => !!window.__getOverviewPerfState?.().overviewOn);
  if (!open) {
    await page.evaluate(() => window.__toggleOverview?.());
    await nextFrame(page);
  }
}

async function stagesInWindow(page, start, end) {
  return page.evaluate(({ start, end }) => {
    const stages = window.__getOverviewPerfState?.().marks?.stages || [];
    return stages.filter(stage => {
      const stageStart = Number(stage.startAt || 0);
      const stageEnd = Number(stage.endAt || stageStart);
      return stageEnd >= start && stageStart <= end;
    });
  }, { start, end });
}

function summarizeStages(stages) {
  const byType = {};
  for (const stage of stages) {
    const type = stage.type || 'unknown';
    const summary = byType[type] || {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      maxItemCount: 0,
    };
    const duration = Number(stage.duration || 0);
    summary.count += 1;
    summary.totalMs = round(summary.totalMs + duration);
    summary.maxMs = Math.max(summary.maxMs, round(duration));
    summary.maxItemCount = Math.max(summary.maxItemCount, Number(stage.count || 0));
    if (stage.appendMs !== undefined) summary.maxAppendMs = Math.max(summary.maxAppendMs || 0, round(Number(stage.appendMs || 0)));
    if (stage.mutationMs !== undefined) summary.maxMutationMs = Math.max(summary.maxMutationMs || 0, round(Number(stage.mutationMs || 0)));
    byType[type] = summary;
  }
  return byType;
}

function layoutReadsInWindow(state, start, end) {
  return (state.marks?.layoutReads || []).filter(read => {
    const at = Number(read.at || 0);
    return at >= start && at <= end;
  });
}

function validateResult(result, finalState) {
  const failures = [];
  const t = result.timings;
  const s = result.states;
  const afterBackground = s.afterBackground;
  const drop = s.afterDropCommit.lastDrop;
  const allCacheKeys = finalState.cacheKeys || [];

  if (result.cards < THRESHOLDS.minCards) failures.push(`expected at least ${THRESHOLDS.minCards} cards, got ${result.cards}`);
  if (t.openFrameMs > THRESHOLDS.openFrameMs) failures.push(`overview open too slow: ${t.openFrameMs}ms`);
  if (t.firstCardMs > THRESHOLDS.firstCardMs) failures.push(`first card too slow: ${t.firstCardMs}ms`);
  if (t.firstVisibleCardsMs > THRESHOLDS.firstVisibleCardsMs) failures.push(`first visible cards too slow: ${t.firstVisibleCardsMs}ms`);
  if (t.allCardsMs > THRESHOLDS.allCardsMs) failures.push(`all overview cards too slow: ${t.allCardsMs}ms`);
  if (t.hoverMs > THRESHOLDS.hoverMs) failures.push(`hover too slow: ${t.hoverMs}ms`);
  if (t.scrollMaxMs > THRESHOLDS.hoverMs) failures.push(`scroll response too slow: ${t.scrollMaxMs}ms`);
  if (t.dragStartMs > THRESHOLDS.dragStartMs) failures.push(`dragstart too slow: ${t.dragStartMs}ms`);
  if (t.dragOverMaxMs > THRESHOLDS.dragOverMs) failures.push(`dragover too slow: ${t.dragOverMaxMs}ms`);
  if (t.dropImmediateMs > THRESHOLDS.dropImmediateMs) failures.push(`drop immediate too slow: ${t.dropImmediateMs}ms`);
  if (t.clickMs > THRESHOLDS.clickMs) failures.push(`click too slow: ${t.clickMs}ms`);
  if (t.reopenMs > THRESHOLDS.reopenMs) failures.push(`reopen too slow: ${t.reopenMs}ms`);
  if (t.closeMs > THRESHOLDS.closeMs) failures.push(`close too slow: ${t.closeMs}ms`);

  for (const name of ['scrollMid', 'scrollBottom', 'scrollTop', 'hover', 'dragStart', 'drop', 'click', 'close']) {
    const stat = result.longTasks[name];
    if (stat.countOver50 > THRESHOLDS.interactionLongTaskCount || stat.maxMs > THRESHOLDS.interactionLongTaskMaxMs) {
      failures.push(`${name} has interaction long tasks: ${JSON.stringify(stat)}`);
    }
    if (result.captureStarts[name].length) {
      failures.push(`${name} started thumbnail captures inside the interaction window`);
    }
  }
  if (result.longTasks.background.maxMs > THRESHOLDS.backgroundLongTaskMaxMs) {
    failures.push(`background thumbnail long task too high: ${JSON.stringify(result.longTasks.background)}`);
  }
  if (result.longTasks.postScrollSettle.countOver50 > THRESHOLDS.postScrollLongTaskCount || result.longTasks.postScrollSettle.maxMs > THRESHOLDS.backgroundLongTaskMaxMs) {
    failures.push(`post-scroll background work still blocks the main thread: ${JSON.stringify(result.longTasks.postScrollSettle)}`);
  }

  if (afterBackground.queueLength >= afterBackground.cardCount) failures.push('thumbnail queue enqueued all cards');
  if (afterBackground.queueLength > afterBackground.visibleOrNearCount + 2) failures.push('thumbnail queue exceeds visible/near range');
  for (const name of ['afterScrollMid', 'afterScrollBottom', 'afterScrollTop', 'afterScrollStable']) {
    const state = s[name];
    if (state.queueLength > state.visibleOrNearCount + 2) {
      failures.push(`${name} thumbnail queue exceeds current visible/near range: queue=${state.queueLength}, visibleOrNear=${state.visibleOrNearCount}`);
    }
  }
  if (s.afterScrollStable.cacheSize < Math.min(THRESHOLDS.cachedInteractionMin, Math.max(1, s.afterScrollStable.visibleOrNearCount))) {
    failures.push(`post-scroll interactions were not tested with enough cached thumbnails: cacheSize=${s.afterScrollStable.cacheSize}`);
  }
  if (s.afterScrollStable.queueLength === 0 && !result.loadedStateAfterScroll.fullLoaded && !result.loadedStateAfterScroll.visibleOrNearLoaded) {
    failures.push(`loaded/stable state is not well defined: ${JSON.stringify(result.loadedStateAfterScroll)}`);
  }
  if (result.progressAfterBackground?.blocksViewport) {
    failures.push(`overview progress blocks viewport after visible thumbnails are ready: ${JSON.stringify(result.progressAfterBackground)}`);
  }
  if (s.afterHover.pauseRemainingMs < 200) failures.push('hover did not defer thumbnail captures');
  if (s.duringDrag.queueLength !== 0 && s.duringDrag.pauseRemainingMs < 200) failures.push('dragstart did not pause/defer thumbnail queue');
  if (s.afterDropFrame.queueLength !== 0 && s.afterDropFrame.pauseRemainingMs < 200) failures.push('drop did not pause/defer thumbnail queue');
  if (s.afterClick.queueLength !== 0) failures.push('click did not cancel thumbnail queue');
  if (s.afterClose.queueLength !== 0) failures.push('close did not cancel thumbnail queue');

  if (!drop) failures.push('drop perf mark missing');
  else {
    if (!drop.localDomCommittedAt || !drop.deckCommittedAt) failures.push('drop local/deck commit timestamps missing');
    if (drop.deckCommittedAt <= drop.localDomCommittedAt) failures.push('deck commit was not delayed after local overview update');
    if (drop.deckOrderBeforeDrop !== drop.deckOrderAfterLocalDom) failures.push('real deck order changed before delayed commit');
    if (drop.overviewOrderBeforeDrop === drop.overviewOrderAfterLocalDom) failures.push('overview order did not update immediately on drop');
    if (drop.deckOrderAfterCommit === drop.deckOrderBeforeDrop) failures.push('real deck order did not commit after drop');
    if (drop.queueAfterDrop !== 0) failures.push('drop left thumbnail queue running');
  }

  const layoutReads = s.afterDropCommit.layoutReads || [];
  const dragStartReads = layoutReads.filter(read => read.phase === 'dragstart' && read.kind === 'all-card-rects');
  const dragOverFullReads = layoutReads.filter(read => read.phase === 'dragover' && Number(read.count || 0) >= result.cards);
  const dragOverCacheReads = layoutReads.filter(read => read.phase === 'dragover' && read.kind === 'cached-card-rects');
  if (!dragStartReads.length) failures.push('dragstart did not record one cached rect read');
  if (dragStartReads.length > 1) failures.push('dragstart should not repeatedly read all overview card rects');
  if (dragOverFullReads.length) failures.push('dragover repeatedly read all card rects instead of using cached rects');
  if (!dragOverCacheReads.length) failures.push('dragover did not record cached rect usage');

  if (!allCacheKeys.length) failures.push('cache keys are empty; cache validation cannot pass without real thumbnails');
  const invalidKeys = allCacheKeys.filter(key => !/^[^|]+\|[^|]+\|r\d+\|\d+x\d+$/.test(key) || /overview-\d+/.test(key));
  if (invalidKeys.length) failures.push(`cache keys are not stable: ${invalidKeys.slice(0, 5).join(', ')}`);
  if (finalState.cacheSize > finalState.cacheLimit) failures.push('cache exceeds LRU limit');
  if (finalState.cacheApproxChars > THRESHOLDS.cacheApproxChars) failures.push(`cache approx size too high: ${finalState.cacheApproxChars}`);

  const visibleThumbs = result.coldVisibleThumbs;
  if (!visibleThumbs.visibleCount) {
    failures.push('cold open visible thumbnail readiness could not find visible thumbnails');
  } else {
    if (visibleThumbs.firstVisibleThumbReadyMs === null || visibleThumbs.firstVisibleThumbReadyMs > THRESHOLDS.firstVisibleThumbReadyMs) {
      failures.push(`cold open first visible thumbnail too slow: ${visibleThumbs.firstVisibleThumbReadyMs}ms`);
    }
    if (visibleThumbs.allVisibleThumbsReadyMs === null || visibleThumbs.allVisibleThumbsReadyMs > THRESHOLDS.allVisibleThumbsReadyMs) {
      failures.push(`cold open visible thumbnails not ready fast enough: rendered=${visibleThumbs.visibleRenderedCount}/${visibleThumbs.visibleCount}, allReadyMs=${visibleThumbs.allVisibleThumbsReadyMs}`);
    }
  }

  result.repeatedOpen.forEach(cycle => {
    if (cycle.readyMs > THRESHOLDS.repeatedOpenReadyMs) {
      failures.push(`repeated open ${cycle.index} interactive ready too slow: ${cycle.readyMs}ms`);
    }
    if (cycle.hoverMs > THRESHOLDS.hoverMs) {
      failures.push(`repeated open ${cycle.index} hover probe too slow: ${cycle.hoverMs}ms`);
    }
    if (cycle.longTasks.countOver50 > THRESHOLDS.repeatedOpenLongTaskCount || cycle.longTasks.maxMs > THRESHOLDS.backgroundLongTaskMaxMs) {
      failures.push(`repeated open ${cycle.index} remains busy after opening: ${JSON.stringify(cycle.longTasks)}`);
    }
    if (cycle.captureStarts.length) {
      failures.push(`warm repeated open ${cycle.index} started thumbnail captures: ${cycle.captureStarts.map(capture => capture.slideId).join(', ')}`);
    }
    const fit = cycle.stages['fit-overview-thumbnails'];
    const observe = cycle.stages['observe-overview-thumbnails'];
    const queueRead = cycle.stages['queue-nearby-overview-thumbs'];
    if (fit?.maxItemCount >= cycle.state.cardCount) {
      failures.push(`repeated open ${cycle.index} synchronously fit all overview thumbnails: ${fit.maxItemCount}`);
    }
    if (observe?.maxItemCount >= cycle.state.cardCount) {
      failures.push(`repeated open ${cycle.index} synchronously observed all overview thumbnails: ${observe.maxItemCount}`);
    }
    if (queueRead?.maxItemCount >= cycle.state.cardCount) {
      failures.push(`repeated open ${cycle.index} read layout for all overview thumbnails while opening: ${queueRead.maxItemCount}`);
    }
    if (cycle.state.queueLength > cycle.state.visibleOrNearCount + 2) {
      failures.push(`repeated open ${cycle.index} queue exceeds current visible/near range: queue=${cycle.state.queueLength}, visibleOrNear=${cycle.state.visibleOrNearCount}`);
    }
    if (cycle.progress?.blocksViewport) {
      failures.push(`warm repeated open ${cycle.index} shows blocking progress: ${JSON.stringify(cycle.progress)}`);
    }
  });

  const repeatedDrop = result.repeatedDrop;
  if (repeatedDrop.commitDelayMs > THRESHOLDS.postDropCommitDelayMs) {
    failures.push(`post-drop deck commit delay too high: ${repeatedDrop.commitDelayMs}ms`);
  }
  if (repeatedDrop.deckCommitDurationMs > THRESHOLDS.postDropCommitDurationMs) {
    failures.push(`post-drop deck commit duration too high: ${repeatedDrop.deckCommitDurationMs}ms`);
  }
  if (repeatedDrop.longTasks.countOver50 > THRESHOLDS.postDropLongTaskCount || repeatedDrop.longTasks.maxMs > THRESHOLDS.backgroundLongTaskMaxMs) {
    failures.push(`post-drop window remains busy: ${JSON.stringify(repeatedDrop.longTasks)}`);
  }
  if (repeatedDrop.postDropHoverMs > THRESHOLDS.postDropProbeMs) {
    failures.push(`post-drop hover probe too slow: ${repeatedDrop.postDropHoverMs}ms`);
  }
  if (repeatedDrop.postDropDragStartMs > THRESHOLDS.postDropProbeMs) {
    failures.push(`post-drop drag probe too slow: ${repeatedDrop.postDropDragStartMs}ms`);
  }
  if (repeatedDrop.postDropImmediateHoverMs > THRESHOLDS.postDropProbeMs) {
    failures.push(`immediate post-drop hover probe too slow: ${repeatedDrop.postDropImmediateHoverMs}ms`);
  }
  if (repeatedDrop.postDropImmediateDragStartMs > THRESHOLDS.postDropProbeMs) {
    failures.push(`immediate post-drop drag probe too slow: ${repeatedDrop.postDropImmediateDragStartMs}ms`);
  }
  if (repeatedDrop.postDropImmediateHoverLongTasks.countOver50 > THRESHOLDS.interactionLongTaskCount || repeatedDrop.postDropImmediateHoverLongTasks.maxMs > THRESHOLDS.interactionLongTaskMaxMs) {
    failures.push(`immediate post-drop hover window blocked: ${JSON.stringify(repeatedDrop.postDropImmediateHoverLongTasks)}`);
  }
  if (repeatedDrop.postDropImmediateDragLongTasks.countOver50 > THRESHOLDS.interactionLongTaskCount || repeatedDrop.postDropImmediateDragLongTasks.maxMs > THRESHOLDS.interactionLongTaskMaxMs) {
    failures.push(`immediate post-drop drag window blocked: ${JSON.stringify(repeatedDrop.postDropImmediateDragLongTasks)}`);
  }
  if (repeatedDrop.postDropImmediateHoverCaptureStarts.length) {
    failures.push('immediate post-drop hover started thumbnail captures');
  }
  if (repeatedDrop.postDropImmediateDragCaptureStarts.length) {
    failures.push('immediate post-drop drag started thumbnail captures');
  }
  const postDropFit = repeatedDrop.stages['fit-overview-thumbnails'];
  const postDropObserve = repeatedDrop.stages['observe-overview-thumbnails'];
  const postDropQueueRead = repeatedDrop.stages['queue-nearby-overview-thumbs'];
  if (postDropFit?.maxItemCount >= repeatedDrop.stateAfterWindow.cardCount) {
    failures.push(`post-drop synchronously fit all overview thumbnails: ${postDropFit.maxItemCount}`);
  }
  if (postDropObserve?.maxItemCount >= repeatedDrop.stateAfterWindow.cardCount) {
    failures.push(`post-drop synchronously observed all overview thumbnails: ${postDropObserve.maxItemCount}`);
  }
  if (postDropQueueRead?.maxItemCount > repeatedDrop.stateAfterWindow.visibleOrNearCount + 2) {
    failures.push(`post-drop read too many thumbnail layouts: count=${postDropQueueRead.maxItemCount}, visibleOrNear=${repeatedDrop.stateAfterWindow.visibleOrNearCount}`);
  }

  const dirty = result.dirtyResult;
  if (!dirty.beforeKeys.length) failures.push('dirty validation had no cache keys before invalidation');
  if (!dirty.activeKeysBefore.length) failures.push('dirty validation had no active slide cache key before invalidation');
  if (!dirty.otherKeysBefore.length) failures.push('dirty validation had no non-active slide cache key before invalidation');
  if (!dirty.removed.length) failures.push('dirty invalidation removed no cache keys');
  if (dirty.removed.some(key => !key.includes(`|${dirty.activeId}|`))) failures.push(`dirty invalidation removed other slides: ${dirty.removed.join(', ')}`);
  if (!dirty.otherKeysStillPresent) failures.push('dirty invalidation did not preserve non-active slide cache keys');

  return failures;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function round(value) {
  return Math.round(value * 10) / 10;
}
