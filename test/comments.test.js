'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Hexo = require('hexo');

const repositoryRoot = path.resolve(__dirname, '..');
const temporaryRoot = path.resolve(os.tmpdir());
let temporaryDirectory;
let hexo;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'hexo-comments-test-'));
  // Read the real source, configuration, scripts and installed theme, but never
  // read or write the repository's tracked db.json or its public directory.
  hexo = new Hexo(repositoryRoot, { silent: true, output: temporaryDirectory });
  await hexo.init();
  hexo.public_dir = path.join(temporaryDirectory, 'public') + path.sep;
  await hexo.load();
});

after(async () => {
  try {
    if (hexo) await hexo.exit();
  } finally {
    if (temporaryDirectory) {
      const relative = path.relative(temporaryRoot, path.resolve(temporaryDirectory));
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
});

async function readRoute(routePath) {
  const stream = hexo.route.get(routePath);
  assert.ok(stream, `Missing generated route: ${routePath}`);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function commentScripts(html) {
  return html.match(/<script\b[^>]*\bsrc=["']https:\/\/utteranc\.es\/client\.js["'][^>]*>/gi) || [];
}

function commentSections(html) {
  return html.match(/<section\b[^>]*\bid=["']comments["'][^>]*>/gi) || [];
}

function assertComments(html, description, expectedTerm) {
  assert.equal(commentSections(html).length, 1, `${description}: one comments section`);
  const scripts = commentScripts(html);
  assert.equal(scripts.length, 1, `${description}: one utterances client`);
  assert.match(scripts[0], /\brepo=["']Big-Fat-Duck\/Big-Fat-Duck\.github\.io["']/);
  const issueTerm = scripts[0].match(/\bissue-term=["']([^"']+)["']/);
  assert.ok(issueTerm, `${description}: a fixed discussion identifier`);
  assert.equal(issueTerm[1], expectedTerm, `${description}: the canonical discussion identifier`);
  assert.match(scripts[0], /\bcrossorigin=["']anonymous["']/);
  assert.match(scripts[0], /\basync(?:\s|=|>)/);

  const fallback = html.match(/<p\b[^>]*\bclass=["']comments-fallback["'][^>]*>[\s\S]*?<a\b[^>]*\bhref=["']([^"']+)["']/i);
  assert.ok(fallback, `${description}: a direct GitHub fallback link`);
  const fallbackUrl = new URL(fallback[1].replace(/&amp;/g, '&'));
  assert.equal(fallbackUrl.origin, 'https://github.com');
  assert.equal(fallbackUrl.pathname, '/Big-Fat-Duck/Big-Fat-Duck.github.io/issues');
  assert.equal(fallbackUrl.searchParams.get('q'), `is:issue in:title "${expectedTerm}"`,
    `${description}: fallback searches for the same discussion as the widget`);
}

function articleThread(post) {
  // Resolve the article's directory with URL semantics, independently of the
  // template's string normalization. The repository uses directory permalinks.
  return new URL('.', post.permalink).pathname.substring(1);
}

function assertNoComments(html, description) {
  assert.equal(commentSections(html).length, 0, `${description}: no comments section`);
  assert.equal(commentScripts(html).length, 0, `${description}: no utterances request`);
}

function renderPage(page, viewName, theme = hexo.theme.config) {
  const view = hexo.theme.getView(viewName);
  assert.ok(view, `Missing ${viewName} view`);
  const locals = {
    page,
    path: page.path,
    url: page.permalink,
    config: hexo.config,
    theme,
    site: hexo.locals.toObject(),
    env: hexo.env,
    view_dir: path.join(hexo.theme_dir, 'layout') + path.sep,
    layout: 'layout'
  };
  // Apply the same language helpers that Hexo supplies when rendering routes.
  hexo.execFilterSync('template_locals', locals, { context: hexo });
  return view.renderSync(locals);
}

test('every published article loads one GitHub comment widget', async () => {
  const posts = hexo.locals.get('posts').toArray();
  assert.ok(posts.length > 0, 'The real repository must contain published articles');
  for (const post of posts) {
    const html = await readRoute(post.path);
    if (post.comments === false) {
      assertNoComments(html, post.path);
    } else {
      assertComments(html, post.path, articleThread(post));
    }
  }
});

test('the guestbook is a generated page with its own comment thread', async () => {
  const html = await readRoute('guestbook/index.html');
  assert.match(html, /留言/);
  assertComments(html, 'guestbook', 'guestbook/');
});

test('the homepage, archive and tag listings do not load comment widgets', async () => {
  assertNoComments(await readRoute('index.html'), 'homepage');
  const archives = hexo.route.list().filter(route => /^archives\/.*\.html$/.test(route));
  assert.ok(archives.length > 0, 'Archive routes should be generated');
  for (const route of archives) assertNoComments(await readRoute(route), route);
  const tags = hexo.route.list().filter(route => /^tags\/.*\.html$/.test(route));
  assert.ok(tags.length > 0, 'The real repository has tagged articles');
  for (const route of tags) assertNoComments(await readRoute(route), route);
});

test('Chinese article identifiers retain one level of URL encoding in widget and fallback', async () => {
  const post = hexo.locals.get('posts').findOne({ source: '_posts/雅思学习.md' });
  assert.ok(post, 'Use an actual article with a Chinese filename');
  assertComments(await readRoute(post.path), 'Chinese article',
    '2026/03/09/%E9%9B%85%E6%80%9D%E5%AD%A6%E4%B9%A0/');
});

test('directory and index.html URLs keep the same discussion for articles and guestbook', () => {
  const post = hexo.locals.get('posts').findOne({ source: '_posts/雅思学习.md' });
  const guestbook = hexo.locals.get('pages').findOne({ source: 'guestbook/index.md' });
  assert.ok(post);
  assert.ok(guestbook);
  const cases = [
    { page: post, view: 'post', term: '2026/03/09/%E9%9B%85%E6%80%9D%E5%AD%A6%E4%B9%A0/' },
    { page: guestbook, view: 'page', term: 'guestbook/' }
  ];
  for (const { page, view, term } of cases) {
    const directoryUrl = new URL('.', page.permalink);
    for (const suffix of ['', 'index.html']) {
      const permalink = new URL(suffix, directoryUrl).href;
      assertComments(renderPage({ ...page, permalink }, view), permalink, term);
    }
  }
});

test('desktop and mobile navigation both link to the guestbook', async () => {
  const html = await readRoute('index.html');
  for (const navId of ['main-nav', 'mobile-nav']) {
    const nav = html.match(new RegExp(`<nav\\b[^>]*\\bid=["']${navId}["'][^>]*>([\\s\\S]*?)<\\/nav>`, 'i'));
    assert.ok(nav, `${navId} should be present`);
    assert.match(nav[1], /<a\b[^>]*\bhref=["']\/guestbook\/?["'][^>]*>\s*留言板\s*<\/a>/i);
  }
});

test('comments: false disables the widget for both article and page layouts', () => {
  const post = hexo.locals.get('posts').first();
  const guestbook = hexo.locals.get('pages').findOne({ source: 'guestbook/index.md' });
  assert.ok(post);
  assert.ok(guestbook);
  assertNoComments(renderPage({ ...post, comments: false }, 'post'), 'disabled article');
  assertNoComments(renderPage({ ...guestbook, comments: false }, 'page'), 'disabled page');
});

test('the global enable switch disables comments on articles and the guestbook', () => {
  const theme = {
    ...hexo.theme.config,
    utterances: { ...hexo.theme.config.utterances, enable: false }
  };
  const post = hexo.locals.get('posts').first();
  const guestbook = hexo.locals.get('pages').findOne({ source: 'guestbook/index.md' });
  assert.ok(post);
  assert.ok(guestbook);
  assertNoComments(renderPage({ ...post }, 'post', theme), 'globally disabled article');
  assertNoComments(renderPage({ ...guestbook }, 'page', theme), 'globally disabled guestbook');
});

test('a second generation does not duplicate the comments integration', async () => {
  await hexo.load();
  assertComments(await readRoute('guestbook/index.html'), 'regenerated guestbook', 'guestbook/');
  const post = hexo.locals.get('posts').findOne({ comments: true });
  assert.ok(post);
  assertComments(await readRoute(post.path), 'regenerated article', articleThread(post));
});
