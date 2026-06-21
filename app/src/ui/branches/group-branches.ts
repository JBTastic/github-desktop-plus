import { Branch, BranchType } from '../../models/branch'
import { BranchSortOrder } from '../../models/branch-sort-order'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'

export type BranchGroupIdentifier = 'default' | 'recent' | 'other'

export interface IBranchListItem extends IFilterListItem {
  readonly text: ReadonlyArray<string>
  readonly id: string
  readonly branch: Branch
}

/**
 * Whether a branch is local-only, i.e. a local branch that has either never
 * been published to a remote or whose upstream has since been deleted.
 */
export function isLocalOnlyBranch(branch: Branch): boolean {
  return branch.type === BranchType.Local && (!branch.upstream || branch.isGone)
}

export function groupBranches(
  defaultBranch: Branch | null,
  currentBranch: Branch | null,
  allBranches: ReadonlyArray<Branch>,
  recentBranches: ReadonlyArray<Branch>,
  sortOrder: BranchSortOrder
): ReadonlyArray<IFilterListGroup<IBranchListItem>> {
  const groups = new Array<IFilterListGroup<IBranchListItem>>()

  if (defaultBranch) {
    groups.push({
      identifier: 'default',
      items: [
        {
          text: [defaultBranch.name],
          id: defaultBranch.name,
          branch: defaultBranch,
        },
      ],
    })
  }

  const recentBranchNames = new Set<string>()
  const defaultBranchName = defaultBranch ? defaultBranch.name : null
  const recentBranchesWithoutDefault = recentBranches.filter(
    b => b.name !== defaultBranchName
  )
  if (recentBranchesWithoutDefault.length > 0) {
    const recentBranches = new Array<IBranchListItem>()

    for (const branch of recentBranchesWithoutDefault) {
      recentBranches.push({
        text: [branch.name],
        id: branch.name,
        branch,
      })
      recentBranchNames.add(branch.name)
    }

    groups.push({
      identifier: 'recent',
      items: recentBranches,
    })
  }

  const remainingBranches = allBranches.filter(
    b =>
      b.name !== defaultBranchName &&
      !recentBranchNames.has(b.name) &&
      !b.isDesktopForkRemoteBranch
  )
  const branchComparer = getBranchComparer(sortOrder)
  const sortedRemainingBranches = remainingBranches.sort((a, b) =>
    // Local branches are always sorted above remote branches, regardless of the sort order
    a.type === b.type ? branchComparer(a, b) : a.type - b.type
  )

  const remainingItems = sortedRemainingBranches.map(b => {
    return {
      text: [b.name],
      id: b.name,
      branch: b,
    }
  })
  groups.push({
    identifier: 'other',
    items: remainingItems,
  })

  return groups
}

function getBranchComparer(
  sortOrder: BranchSortOrder
): (a: Branch, b: Branch) => number {
  switch (sortOrder) {
    case BranchSortOrder.Alphabetical:
      return (a, b) => a.name.localeCompare(b.name)
    case BranchSortOrder.LastModified:
      return (a, b) => b.tip.author.date.getTime() - a.tip.author.date.getTime()
  }
}
