import { describe, expect, it } from 'vitest';
import { EditorLifecycle } from './editor-lifecycle';

describe('admin editor lifecycle', () => {
  it('cannot become dirty or autosave while an existing post is still loading', () => {
    const editor = new EditorLifecycle(true);

    expect(editor.interactive).toBe(false);
    expect(editor.markChanged()).toBe(false);
    expect(editor.shouldAutosave('draft')).toBe(false);

    editor.loadSucceeded();
    expect(editor.interactive).toBe(true);
    expect(editor.dirty).toBe(false);
  });

  it('remains locked after an existing post fails to load', () => {
    const editor = new EditorLifecycle(true);
    editor.loadFailed();

    expect(editor.interactive).toBe(false);
    expect(editor.markChanged()).toBe(false);
    expect(editor.beginSave()).toBeNull();
  });

  it('autosaves only dirty drafts and preserves edits made during a save', () => {
    const editor = new EditorLifecycle(false);
    expect(editor.markChanged()).toBe(true);
    expect(editor.shouldAutosave('published')).toBe(false);
    expect(editor.shouldAutosave('draft')).toBe(true);

    const savedRevision = editor.beginSave();
    expect(savedRevision).toBe(1);
    expect(editor.markChanged()).toBe(true);
    editor.completeSave(savedRevision!);

    expect(editor.dirty).toBe(true);
    expect(editor.shouldAutosave('draft')).toBe(true);
  });
});
