import { describe, it } from 'node:test'
import assert from 'node:assert'
import { groupBranches } from '../../src/ui/branches'
import { Branch, BranchType } from '../../src/models/branch'
import { CommitIdentity } from '../../src/models/commit-identity'
import { BranchSortOrder } from '../../src/models/branch-sort-order'

describe('Branches grouping', () => {
  const author = new CommitIdentity('Hubot', 'hubot@github.com', new Date())

  const branchTip = {
    sha: '300acef',
    author,
  }

  const currentBranch = new Branch(
    'master',
    null,
    branchTip,
    BranchType.Local,
    '',
    false
  )
  const defaultBranch = new Branch(
    'master',
    null,
    branchTip,
    BranchType.Local,
    '',
    false
  )
  const recentBranches = [
    new Branch(
      'some-recent-branch',
      null,
      branchTip,
      BranchType.Local,
      '',
      false
    ),
  ]
  const otherBranch = new Branch(
    'other-branch',
    null,
    branchTip,
    BranchType.Local,
    '',
    false
  )

  const allBranches = [currentBranch, ...recentBranches, otherBranch]

  it('should group branches', () => {
    const groups = groupBranches(
      defaultBranch,
      currentBranch,
      allBranches,
      recentBranches,
      BranchSortOrder.Alphabetical
    )
    assert.equal(groups.length, 3)

    assert.equal(groups[0].identifier, 'default')
    let items = groups[0].items
    assert.equal(items[0].branch, defaultBranch)

    assert.equal(groups[1].identifier, 'recent')
    items = groups[1].items
    assert.equal(items[0].branch, recentBranches[0])

    assert.equal(groups[2].identifier, 'other')
    items = groups[2].items
    assert.equal(items[0].branch, otherBranch)
  })
})
