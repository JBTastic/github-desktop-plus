import { git } from './core'
import { Repository } from '../../models/repository'
import * as Path from 'path'
import * as Fs from 'fs'
import type { WorktreeEntry, WorktreeType } from '../../models/worktree'
import { normalizePath } from '../helpers/path'

/**
 * Get the set of canonical branch refs (e.g. `refs/heads/feature`)
 * checked out in any worktree (main or linked).
 */
export async function getWorktreeCheckedOutBranches(
  repository: Repository
): Promise<ReadonlySet<string>> {
  const result = await git(
    ['worktree', 'list', '--porcelain', '-z'],
    repository.path,
    'getWorktreeCheckedOutBranches'
  )

  const branches = new Set<string>()

  // With -z, lines are NUL-terminated and blocks are separated by
  // double NUL (i.e. an empty string between two NUL terminators).
  const blocks = result.stdout.split('\0\0')

  for (const block of blocks) {
    for (const line of block.split('\0')) {
      if (line.startsWith('branch ')) {
        branches.add(line.substring('branch '.length))
      }
    }
  }

  return branches
}

export function parseWorktreePorcelainOutput(
  stdout: string
): ReadonlyArray<WorktreeEntry> {
  if (stdout.trim().length === 0) {
    return []
  }

  const blocks = stdout.trim().split('\n\n')
  const entries: WorktreeEntry[] = []

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n')
    let path = ''
    let head = ''
    let branch: string | null = null
    let isDetached = false
    let isLocked = false
    let isPrunable = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.substring('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.substring('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.substring('branch '.length)
      } else if (line === 'detached') {
        isDetached = true
      } else if (line === 'locked' || line.startsWith('locked ')) {
        isLocked = true
      } else if (line === 'prunable' || line.startsWith('prunable ')) {
        isPrunable = true
      }
    }

    const type: WorktreeType = i === 0 ? 'main' : 'linked'
    entries.push({ path, head, branch, isDetached, type, isLocked, isPrunable })
  }

  return entries
}

export async function listWorktrees(
  repository: Repository
): Promise<ReadonlyArray<WorktreeEntry>> {
  const result = await git(
    ['worktree', 'list', '--porcelain'],
    repository.path,
    'listWorktrees'
  )

  return parseWorktreePorcelainOutput(result.stdout)
}

export async function addWorktree(
  repository: Repository,
  path: string,
  options: {
    readonly branch?: string
    readonly createBranch?: string
    readonly detach?: boolean
    readonly commitish?: string
  } = {}
): Promise<void> {
  const args = ['worktree', 'add']

  if (options.detach) {
    args.push('--detach')
  }

  if (options.createBranch) {
    args.push('-b', options.createBranch)
  }

  args.push(path)

  if (options.branch) {
    args.push(options.branch)
  } else if (options.commitish) {
    args.push(options.commitish)
  }

  await git(args, repository.path, 'addWorktree')
}

export async function removeWorktree(
  repository: Repository,
  path: string
): Promise<void> {
  const args = ['worktree', 'remove', '--force', path]
  await git(args, repository.path, 'removeWorktree')
}

export async function moveWorktree(
  repository: Repository,
  oldPath: string,
  newPath: string
): Promise<void> {
  await git(
    ['worktree', 'move', oldPath, newPath],
    repository.path,
    'moveWorktree'
  )
}

export async function isLinkedWorktree(
  repository: Repository
): Promise<boolean> {
  const worktrees = await listWorktrees(repository)
  const repoPath = normalizePath(repository.path)

  return worktrees.some(
    wt => wt.type === 'linked' && normalizePath(wt.path) === repoPath
  )
}

export async function getMainWorktreePath(
  repository: Repository
): Promise<string | null> {
  const worktrees = await listWorktrees(repository)
  const main = worktrees.find(wt => wt.type === 'main')
  return main?.path ?? null
}

/**
 * Synchronously checks if a repository path is a linked worktree by examining
 * whether `.git` is a file (linked worktree) or directory (main worktree).
 */
export function isLinkedWorktreeSync(repositoryPath: string): boolean {
  try {
    const dotGit = Path.join(repositoryPath, '.git')
    // eslint-disable-next-line no-sync
    const stats = Fs.statSync(dotGit)
    return stats.isFile()
  } catch {
    return false
  }
}
