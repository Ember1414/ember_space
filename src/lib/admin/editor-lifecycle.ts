export type EditablePostStatus = 'draft' | 'published' | 'archived';

type EditorPhase = 'loading' | 'ready' | 'failed';

export class EditorLifecycle {
  private phase: EditorPhase;
  private revision = 0;
  private savedRevision = 0;
  private saving = false;

  constructor(requiresLoad: boolean) {
    this.phase = requiresLoad ? 'loading' : 'ready';
  }

  get interactive(): boolean {
    return this.phase === 'ready';
  }

  get dirty(): boolean {
    return this.revision !== this.savedRevision;
  }

  get isSaving(): boolean {
    return this.saving;
  }

  loadSucceeded(): void {
    this.phase = 'ready';
    this.revision = 0;
    this.savedRevision = 0;
    this.saving = false;
  }

  loadFailed(): void {
    this.phase = 'failed';
    this.revision = 0;
    this.savedRevision = 0;
    this.saving = false;
  }

  markChanged(): boolean {
    if (!this.interactive) return false;
    this.revision += 1;
    return true;
  }

  beginSave(): number | null {
    if (!this.interactive || this.saving) return null;
    this.saving = true;
    return this.revision;
  }

  completeSave(revision: number): void {
    this.savedRevision = revision;
    this.saving = false;
  }

  failSave(): void {
    this.saving = false;
  }

  shouldAutosave(status: EditablePostStatus): boolean {
    return this.interactive && !this.saving && this.dirty && status === 'draft';
  }
}
