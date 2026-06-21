import * as React from 'react'

import { Branch, BranchType } from '../../models/branch'

import { IBranchListItem } from './group-branches'
import { BranchListItem } from './branch-list-item'
import { IMatches } from '../../lib/fuzzy-find'
import { getRelativeTimeInfoFromDate } from '../relative-time'
import { getPreferAbsoluteDates } from '../../models/formatting-preferences'

export function renderDefaultBranch(
  item: IBranchListItem,
  matches: IMatches,
  currentBranch: Branch | null,
  onDropOntoBranch?: (branchName: string) => void,
  onDropOntoCurrentBranch?: () => void
): JSX.Element {
  const branch = item.branch
  const currentBranchName = currentBranch ? currentBranch.name : null
  const isLocalOnly =
    branch.type === BranchType.Local && (!branch.upstream || branch.isGone)
  return (
    <BranchListItem
      name={branch.name}
      isCurrentBranch={branch.name === currentBranchName}
      authorDate={branch.tip.author.date}
      isLocalOnly={isLocalOnly}
      matches={matches}
      onDropOntoBranch={onDropOntoBranch}
      onDropOntoCurrentBranch={onDropOntoCurrentBranch}
    />
  )
}

export function getDefaultAriaLabelForBranch(item: IBranchListItem): string {
  const branch = item.branch
  const authorDate = branch.tip.author.date

  if (!authorDate) {
    return branch.name
  }

  if (Number.isNaN(authorDate.getTime())) {
    return branch.name
  }

  if (Number.isNaN(authorDate.getTime())) {
    return branch.name
  }

  const { relativeText, absoluteText } = getRelativeTimeInfoFromDate(
    authorDate,
    true
  )

  return `${item.branch.name} ${
    getPreferAbsoluteDates() ? absoluteText : relativeText
  }`
}
