'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Extend the installed Landscape theme without editing dependency files.
// before_generate runs after Hexo has loaded the theme and merged its config.
hexo.extend.filter.register('before_generate', function () {
  if (this.config.theme !== 'landscape') return;

  const options = this.theme.config.utterances;
  if (options && options.enable && !/^[\w.-]+\/[\w.-]+$/.test(options.repo || '')) {
    throw new Error('utterances.repo must be a GitHub repository in owner/name format.');
  }

  const templates = join(this.base_dir, 'layouts');
  this.theme.setView('_partial/comments.ejs', readFileSync(join(templates, 'comments.ejs'), 'utf8'));
  const pageTemplate = readFileSync(join(templates, 'commented-page.ejs'), 'utf8');
  this.theme.setView('post.ejs', pageTemplate);
  this.theme.setView('page.ejs', pageTemplate);
});
