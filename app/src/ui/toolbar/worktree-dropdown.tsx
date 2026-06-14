import * as React from 'react'
import * as Path from 'path'
import { Dispatcher } from '../dispatcher'
import * as octicons from '../octicons/octicons.generated'
import { Repository } from '../../models/repository'
import { ToolbarDropdown, DropdownState } from './dropdown'
import {
  FoldoutType,
  IConstrainedValue,
  IRepositoryState,
} from '../../lib/app-state'
import { ILocalRepositoryState } from '../../models/repository'
import { WorktreeEntry } from '../../models/worktree'
import { WorktreeList } from '../worktrees/worktree-list'
import { CloningRepository } from '../../models/cloning-repository'
import { showContextualMenu } from '../../lib/menu-item'
import { generateWorktreeContextMenuItems } from '../worktrees/worktree-list-item-context-menu'
import { PopupType } from '../../models/popup'
import { Resizable } from '../resizable'
import { enableResizingToolbarButtons } from '../../lib/feature-flag'
import { normalizePath } from '../../lib/helpers/path'
import { setPreferredWorktreePath } from '../../lib/worktree-preferences'

interface IWorktreeDropdownProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly repositoryState: IRepositoryState
  readonly isOpen: boolean
  readonly onDropDownStateChanged: (state: DropdownState) => void
  readonly enableFocusTrap: boolean
  readonly repositories: ReadonlyArray<Repository | CloningRepository>
  readonly worktreeDropdownWidth: IConstrainedValue
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >
}

interface IWorktreeDropdownState {
  readonly filterText: string
  readonly worktreeAddedRepo: Repository | null
}

export class WorktreeDropdown extends React.Component<
  IWorktreeDropdownProps,
  IWorktreeDropdownState
> {
  public constructor(props: IWorktreeDropdownProps) {
    super(props)
    this.state = {
      filterText: '',
      worktreeAddedRepo: null,
    }
  }

  private onWorktreeClick = async (worktree: WorktreeEntry) => {
    const { dispatcher, repositories } = this.props
    const worktreePath = normalizePath(worktree.path)
    const previousWorktreeRepo = this.state.worktreeAddedRepo

    dispatcher.closeFoldout(FoldoutType.Worktree)

    const { allWorktrees } = this.props.repositoryState.worktreesState
    const mainWorktree = allWorktrees.find(wt => wt.type === 'main')

    if (mainWorktree) {
      setPreferredWorktreePath(mainWorktree.path, worktree.path)
    }

    const existingRepo = repositories.find(
      r => r instanceof Repository && normalizePath(r.path) === worktreePath
    )

    if (existingRepo && existingRepo instanceof Repository) {
      await dispatcher.selectRepository(existingRepo)
      this.setState({ worktreeAddedRepo: null })
    } else {
      const addedRepos = await dispatcher.addRepositories(
        [worktree.path],
        this.props.repository.login
      )

      if (addedRepos.length > 0) {
        await dispatcher.selectRepository(addedRepos[0])
        this.setState({ worktreeAddedRepo: addedRepos[0] })
      }
    }

    if (previousWorktreeRepo) {
      await dispatcher.removeRepository(previousWorktreeRepo, false)
      dispatcher.closeFoldout(FoldoutType.Repository)
    }
  }

  // Intentional no-op: navigation happens on click, not selection change
  private onWorktreeSelected = (_worktree: WorktreeEntry) => {}

  private onWorktreeContextMenu = (
    worktree: WorktreeEntry,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const items = generateWorktreeContextMenuItems({
      path: worktree.path,
      isMainWorktree: worktree.type === 'main',
      isLocked: worktree.isLocked,
      onRenameWorktree: this.onRenameWorktree,
      onRemoveWorktree: this.onRemoveWorktree,
      onCopyPath: path => this.props.dispatcher.copyPathToClipboard(path),
    })

    showContextualMenu(items)
  }

  private onRenameWorktree = (path: string) => {
    this.props.dispatcher.closeFoldout(FoldoutType.Worktree)
    this.props.dispatcher.showPopup({
      type: PopupType.RenameWorktree,
      repository: this.props.repository,
      worktreePath: path,
    })
  }

  private onRemoveWorktree = (path: string) => {
    this.props.dispatcher.closeFoldout(FoldoutType.Worktree)

    const { repositories, localRepositoryStateLookup } = this.props
    const normalizedPath = normalizePath(path)
    const matchingRepo = repositories.find(
      r => r instanceof Repository && normalizePath(r.path) === normalizedPath
    )
    const repoState =
      matchingRepo instanceof Repository
        ? localRepositoryStateLookup.get(matchingRepo.id)
        : undefined
    const changedFilesCount = repoState?.changedFilesCount ?? 0

    if (changedFilesCount > 0) {
      this.props.dispatcher.showPopup({
        type: PopupType.CantDeleteWorktreeUncommittedChanges,
        worktreePath: path,
      })
      return
    }

    this.props.dispatcher.showPopup({
      type: PopupType.DeleteWorktree,
      repository: this.props.repository,
      worktreePath: path,
    })
  }

  private onAddNewWorktree = () => {
    this.props.dispatcher.closeFoldout(FoldoutType.Worktree)
    this.props.dispatcher.showPopup({
      type: PopupType.AddWorktree,
      repository: this.props.repository,
    })
  }

  private onFilterTextChanged = (text: string) => {
    this.setState({ filterText: text })
  }

  private renderWorktreeFoldout = (): JSX.Element | null => {
    const { allWorktrees, currentWorktree } =
      this.props.repositoryState.worktreesState

    return (
      <WorktreeList
        worktrees={allWorktrees}
        currentWorktree={currentWorktree}
        selectedWorktree={null}
        onWorktreeSelected={this.onWorktreeSelected}
        onWorktreeClick={this.onWorktreeClick}
        filterText={this.state.filterText}
        onFilterTextChanged={this.onFilterTextChanged}
        canCreateNewWorktree={true}
        onAddNewWorktree={this.onAddNewWorktree}
        onWorktreeContextMenu={this.onWorktreeContextMenu}
      />
    )
  }

  private getCurrentWorktree(): WorktreeEntry | null {
    return this.props.repositoryState.worktreesState.currentWorktree
  }

  private onResize = (width: number) => {
    this.props.dispatcher.setWorktreeDropdownWidth(width)
  }

  private onReset = () => {
    this.props.dispatcher.resetWorktreeDropdownWidth()
  }

  private onWorktreeToolbarButtonContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault()

    const currentWorktree = this.getCurrentWorktree()

    if (currentWorktree === null) {
      return
    }

    const items = generateWorktreeContextMenuItems({
      path: currentWorktree.path,
      isMainWorktree: currentWorktree.type === 'main',
      isLocked: currentWorktree.isLocked,
      onRenameWorktree: this.onRenameWorktree,
      onRemoveWorktree: this.onRemoveWorktree,
      onCopyPath: path => this.props.dispatcher.copyPathToClipboard(path),
    })

    showContextualMenu(items)
  }

  public render() {
    const { isOpen, enableFocusTrap } = this.props
    const currentState: DropdownState = isOpen ? 'open' : 'closed'
    const currentWorktree = this.getCurrentWorktree()
    const title = currentWorktree
      ? Path.basename(currentWorktree.path)
      : this.props.repository.name
    const description = __DARWIN__ ? 'Current Worktree' : 'Current worktree'

    const toolbarDropdown = (
      <ToolbarDropdown
        className="worktree-button"
        icon={octicons.fileDirectory}
        title={title}
        description={description}
        onContextMenu={this.onWorktreeToolbarButtonContextMenu}
        tooltip={isOpen ? undefined : `Current worktree is ${title}`}
        onDropdownStateChanged={this.props.onDropDownStateChanged}
        dropdownContentRenderer={this.renderWorktreeFoldout}
        dropdownState={currentState}
        showDisclosureArrow={true}
        enableFocusTrap={enableFocusTrap}
        foldoutStyleOverrides={
          enableResizingToolbarButtons()
            ? {
                width: this.props.worktreeDropdownWidth.value,
                maxWidth: this.props.worktreeDropdownWidth.max,
                minWidth: 365,
              }
            : undefined
        }
      />
    )

    if (!enableResizingToolbarButtons()) {
      return toolbarDropdown
    }

    return (
      <Resizable
        width={this.props.worktreeDropdownWidth.value}
        onReset={this.onReset}
        onResize={this.onResize}
        maximumWidth={this.props.worktreeDropdownWidth.max}
        minimumWidth={this.props.worktreeDropdownWidth.min}
        description="Current worktree dropdown button"
      >
        {toolbarDropdown}
      </Resizable>
    )
  }
}
