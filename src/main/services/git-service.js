/**
 * git-service.js — Git integration (ported from NewFinder)
 */

'use strict';

const simpleGit = require('simple-git');

async function getGitInfo(dirPath) {
  try {
    const git = simpleGit(dirPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return { ok: true, data: { isRepo: false } };

    const [status, branch] = await Promise.all([
      git.status(),
      git.branchLocal(),
    ]);

    const fileStatuses = {};
    for (const f of status.modified) fileStatuses[f] = 'modified';
    for (const f of status.staged) fileStatuses[f] = 'staged';
    for (const f of status.not_added) fileStatuses[f] = 'untracked';
    for (const f of status.created) fileStatuses[f] = 'staged';
    for (const f of status.deleted) fileStatuses[f] = 'deleted';

    return {
      ok: true,
      data: {
        isRepo: true,
        branch: status.current || branch.current || '',
        modified: status.modified.length,
        staged: status.staged.length + status.created.length,
        untracked: status.not_added.length,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        fileStatuses,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { getGitInfo };
