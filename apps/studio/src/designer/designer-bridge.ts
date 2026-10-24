import type { ProjectSchema } from '@lc/schema';

interface DocumentLike {
  exportSchema(): ProjectSchema;
}

interface ProjectLike {
  importSchema(schema: unknown): Promise<void> | void;
  exportSchema(): ProjectSchema;
  getCurrentDocument?(): DocumentLike | null;
}

/**
 * Lit 外壳与 React 设计器之间的唯一通信面。
 * 只暴露 schema 导入导出，不向上层泄漏 lowcode-engine 的内部模型。
 */
class DesignerBridge {
  private project: ProjectLike | null = null;
  private dirty = false;
  private listeners = new Set<(dirty: boolean) => void>();
  private editListeners = new Set<() => void>();
  private readyListeners = new Set<() => void>();

  attach(project: ProjectLike): void {
    this.project = project;
    this.readyListeners.forEach((listener) => listener());
    this.readyListeners.clear();
  }

  onReady(listener: () => void): () => void {
    if (this.project) {
      listener();
      return () => undefined;
    }
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  get isReady(): boolean {
    return this.project !== null;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  markDirty(dirty = true): void {
    // 每次修改都通知一次（即使已处于脏状态），自动保存据此判断
    // 本次保存期间是否又有新的编辑，避免把新改动误标为已保存。
    if (dirty) this.editListeners.forEach((listener) => listener());
    if (this.dirty === dirty) return;
    this.dirty = dirty;
    this.listeners.forEach((listener) => listener(dirty));
  }

  onDirtyChange(listener: (dirty: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEdit(listener: () => void): () => void {
    this.editListeners.add(listener);
    return () => this.editListeners.delete(listener);
  }

  exportSchema(): ProjectSchema {
    const project = this.project;
    if (!project) throw new Error('设计器尚未初始化');
    // document.exportSchema() 只返回根节点，保存草稿需要完整的 ProjectSchema
    return project.exportSchema() as ProjectSchema;
  }

  async importSchema(schema: ProjectSchema): Promise<void> {
    const project = this.project;
    if (!project) throw new Error('设计器尚未初始化');
    await project.importSchema(schema);
    this.markDirty(false);
  }
}

export const designerBridge = new DesignerBridge();
