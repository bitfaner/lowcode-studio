import * as React from 'react';
import { Button, Form, Input, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import {
  createPage,
  currentPageId,
  deletePage,
  fetchVersions,
  publishPage,
  rollbackPage,
  runtimeUrl,
  saveDraft,
  studioSession,
  type PageMeta,
  type PageVersionMeta,
} from '../api.js';
import { designerBridge } from '../designer/designer-bridge.js';

const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_MAX_MS = 30_000;
const AUTOSAVE_RETRY_MS = 10_000;

function clock(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('zh-CN', { hour12: false });
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function randomSlug(): string {
  return `page-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function StudioHeader(): React.ReactElement {
  const [pages, setPages] = React.useState<PageMeta[]>([]);
  const [pageName, setPageName] = React.useState('加载中…');
  const [pageMeta, setPageMeta] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [statusError, setStatusError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(() => designerBridge.isReady);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [createForm] = Form.useForm();

  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<PageVersionMeta[]>([]);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [versionsError, setVersionsError] = React.useState('');
  const [rollbackBusy, setRollbackBusy] = React.useState(false);

  const autosaveEnabled = React.useMemo(
    () => new URLSearchParams(window.location.search).get('autosave') !== '0',
    [],
  );
  const changeSeq = React.useRef(0);
  const savePromise = React.useRef<Promise<boolean> | null>(null);
  const timers = React.useRef<{ debounce?: number; max?: number; retry?: number }>({});

  const setStatusMessage = React.useCallback((text: string, isError = false) => {
    setStatus(text);
    setStatusError(isError);
  }, []);

  const clearAutoSaveTimers = React.useCallback(() => {
    window.clearTimeout(timers.current.debounce);
    window.clearTimeout(timers.current.max);
    window.clearTimeout(timers.current.retry);
    timers.current = {};
  }, []);

  const doSave = React.useCallback(
    async (source: 'manual' | 'auto'): Promise<boolean> => {
      const isReady = designerBridge.isReady;
      setReady(isReady);
      if (!isReady) {
        if (source === 'manual') setStatusMessage('设计器尚未就绪，请稍候', true);
        return false;
      }
      const seq = changeSeq.current;
      let schema;
      try {
        schema = designerBridge.exportSchema();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error), true);
        return false;
      }
      if (source === 'manual') setBusy(true);
      try {
        await saveDraft(currentPageId(), schema);
        if (changeSeq.current === seq) designerBridge.markDirty(false);
        setStatusMessage(source === 'auto' ? `已自动保存 ${clock()}` : `草稿已保存 ${clock()}`);
        return true;
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error), true);
        return false;
      } finally {
        if (source === 'manual') setBusy(false);
      }
    },
    [setStatusMessage],
  );

  const handleSave = React.useCallback(
    (source: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
      if (savePromise.current) return savePromise.current;
      const promise = doSave(source).finally(() => {
        savePromise.current = null;
      });
      savePromise.current = promise;
      return promise;
    },
    [doSave],
  );

  const scheduleRetry = React.useCallback(
    (delay: number) => {
      window.clearTimeout(timers.current.retry);
      timers.current.retry = window.setTimeout(() => void runAutoSave(), delay);
    },
    // runAutoSave 在下方定义，通过 ref 规避循环依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSave],
  );

  const runAutoSave = React.useCallback(async () => {
    clearAutoSaveTimers();
    const saved = await handleSave('auto');
    if (saved && designerBridge.isDirty) scheduleRetry(AUTOSAVE_DEBOUNCE_MS);
    else if (!saved) scheduleRetry(AUTOSAVE_RETRY_MS);
  }, [clearAutoSaveTimers, handleSave, scheduleRetry]);

  const noteEdit = React.useCallback(() => {
    changeSeq.current += 1;
    if (!autosaveEnabled) return;
    window.clearTimeout(timers.current.debounce);
    timers.current.debounce = window.setTimeout(() => void runAutoSave(), AUTOSAVE_DEBOUNCE_MS);
    if (timers.current.max === undefined) {
      timers.current.max = window.setTimeout(() => void runAutoSave(), AUTOSAVE_MAX_MS);
    }
  }, [autosaveEnabled, runAutoSave]);

  // 订阅设计器与页面会话
  React.useEffect(() => {
    setReady(designerBridge.isReady);
    const offReady = designerBridge.onReady(() => setReady(true));
    const offEdit = designerBridge.onEdit(() => noteEdit());
    const offDirty = designerBridge.onDirtyChange((dirty) => {
      if (!dirty) clearAutoSaveTimers();
    });
    const offSession = studioSession.subscribe(() => {
      const { page, pages: nextPages, error } = studioSession.state;
      setPages(nextPages);
      if (page) {
        setPageName(page.name);
        const version = page.currentVersion ? `v${page.currentVersion}` : '未发布';
        setPageMeta(
          `${page.appSlug ?? page.appId}/${page.slug} · ${page.type === 'form' ? '表单页' : '列表页'} · ${version}`,
        );
      }
      if (error) setStatusMessage(error, true);
    });
    const { page, pages: initialPages, error } = studioSession.state;
    setPages(initialPages);
    if (page) setPageName(page.name);
    if (error) setStatusMessage(error, true);
    return () => {
      offReady();
      offEdit();
      offDirty();
      offSession();
      clearAutoSaveTimers();
    };
  }, [clearAutoSaveTimers, noteEdit, setStatusMessage]);

  const [messageApi, contextHolder] = message.useMessage();

  const handlePublish = async () => {
    if (busy) return;
    const saved = await handleSave('manual');
    if (!saved) return;
    setBusy(true);
    try {
      const result = await publishPage(currentPageId(), designerBridge.exportSchema());
      setStatusMessage(`已发布 v${result.version} ${clock()}`);
      console.info('[studio] 发布地址：', runtimeUrl({ version: result.version }));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (busy) return;
    const saved = await handleSave('manual');
    if (!saved) return;
    window.open(runtimeUrl({ preview: true }), '_blank', 'noopener');
  };

  const handleExport = () => {
    try {
      const schema = designerBridge.exportSchema();
      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${currentPageId()}.schema.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error), true);
    }
  };

  const handlePageChange = (next: string) => {
    if (!next || next === currentPageId()) return;
    if (designerBridge.isDirty && !window.confirm('当前页面有未保存的修改，确定切换？')) return;
    const url = new URL(window.location.href);
    url.searchParams.set('pageId', next);
    window.location.href = url.toString();
  };

  const handleDelete = async () => {
    const { page, pages: all } = studioSession.state;
    if (!page || busy) return;
    if (all.length <= 1) {
      setStatusMessage('应用至少需要保留一个页面', true);
      return;
    }
    if (!window.confirm(`确定删除页面「${page.name}」及其全部发布版本？`)) return;
    setBusy(true);
    try {
      await deletePage(page.id);
      const next = all.find((item) => item.id !== page.id);
      if (!next) {
        setStatusMessage('没有可切换的页面', true);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('pageId', next.id);
      window.location.href = url.toString();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    if (busy) return;
    if (!studioSession.state.page) {
      setStatusMessage('页面信息尚未加载，请稍候', true);
      return;
    }
    setCreateError('');
    createForm.setFieldsValue({
      name: '',
      slug: randomSlug(),
      type: studioSession.state.page?.type ?? 'form',
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (creating) return;
    const values = await createForm.validateFields().catch(() => null);
    if (!values) return;
    const appId = studioSession.state.page?.appId;
    if (!appId) {
      setCreateError('当前应用信息缺失，请刷新后重试');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const page = await createPage(appId, {
        name: values.name,
        slug: values.slug,
        type: values.type === 'list' ? 'list' : 'form',
      });
      const url = new URL(window.location.href);
      url.searchParams.set('pageId', page.id);
      window.location.href = url.toString();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const openVersions = async () => {
    if (busy) return;
    setVersionsOpen(true);
    setVersionsError('');
    setVersions([]);
    setVersionsLoading(true);
    try {
      setVersions(await fetchVersions(currentPageId()));
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : String(error));
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (rollbackBusy) return;
    if (!window.confirm(`确定回滚到 v${version}？当前发布版本会被切换，历史版本仍会保留。`)) return;
    setRollbackBusy(true);
    setVersionsError('');
    try {
      await rollbackPage(currentPageId(), version);
      setVersions(await fetchVersions(currentPageId()));
      setStatusMessage(`已回滚到 v${version} ${clock()}`);
      messageApi.success(`已回滚到 v${version}`);
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : String(error));
    } finally {
      setRollbackBusy(false);
    }
  };

  const disabled = !ready || busy;
  const hasPage = pages.length > 0 || pageName !== '加载中…';

  return (
    <>
      {contextHolder}
      <div
        className="lc-studio-header"
        style={{
          height: 52, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px',
          background: '#fff', borderBottom: '1px solid #e5e6eb', flex: '0 0 auto',
        }}
      >
        <Space size={8} style={{ minWidth: 200 }}>
          <Tag color="blue" style={{ marginInlineEnd: 0, fontWeight: 700 }}>LC</Tag>
          <Typography.Text strong>LowCode Studio</Typography.Text>
        </Space>
        <Space size={10} style={{ flex: 1, minWidth: 0 }}>
          {pages.length > 1 ? (
            <Select
              size="small"
              style={{ minWidth: 140 }}
              value={currentPageId()}
              onChange={handlePageChange}
              options={pages.map((page) => ({ label: page.name, value: page.id }))}
            />
          ) : (
            <Typography.Text strong>{pageName}</Typography.Text>
          )}
          {pageMeta ? <Typography.Text type="secondary" style={{ fontSize: 11 }}>{pageMeta}</Typography.Text> : null}
        </Space>
        <Space size={8}>
          {status ? (
            <Typography.Text type={statusError ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
              {status}
            </Typography.Text>
          ) : null}
          <Button size="small" disabled={disabled || !hasPage} onClick={openCreate}>新建</Button>
          <Button size="small" danger disabled={disabled || !hasPage || pages.length <= 1} onClick={handleDelete}>
            删除
          </Button>
          <Button size="small" disabled={disabled || !hasPage} onClick={() => void openVersions()}>
            版本
          </Button>
          <Button size="small" onClick={handleExport}>导出</Button>
          <Button size="small" disabled={disabled} onClick={() => void handlePreview()}>预览</Button>
          <Button size="small" disabled={disabled} onClick={() => void handleSave('manual')}>保存</Button>
          <Button size="small" type="primary" disabled={disabled} onClick={() => void handlePublish()}>
            {busy ? '处理中…' : '发布'}
          </Button>
        </Space>
      </div>

      <Modal
        title="新建页面"
        open={createOpen}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        onOk={() => void submitCreate()}
        onCancel={() => setCreateOpen(false)}
      >
        <Form form={createForm} layout="vertical" onValuesChange={() => setCreateError('')}>
          <Form.Item name="name" label="页面名称" rules={[{ required: true, message: '请输入页面名称' }]}>
            <Input
              maxLength={40}
              placeholder="例如：用户管理"
              onChange={(event) => {
                if (createForm.getFieldValue('slugTouched')) return;
                const slug = slugify(event.target.value);
                if (slug) createForm.setFieldValue('slug', slug);
              }}
            />
          </Form.Item>
          <Form.Item
            name="slug"
            label="页面标识"
            extra="用于运行时 URL，只能包含字母、数字、下划线和连字符"
            rules={[{ required: true, message: '请输入页面标识' }]}
          >
            <Input maxLength={64} placeholder="例如：users" onChange={() => createForm.setFieldValue('slugTouched', true)} />
          </Form.Item>
          <Form.Item name="type" label="页面类型">
            <Select options={[{ label: '表单页', value: 'form' }, { label: '列表页', value: 'list' }]} />
          </Form.Item>
          {createError ? <Typography.Text type="danger">{createError}</Typography.Text> : null}
        </Form>
      </Modal>

      <Modal
        title="版本历史"
        open={versionsOpen}
        footer={<Button onClick={() => setVersionsOpen(false)}>关闭</Button>}
        onCancel={() => setVersionsOpen(false)}
      >
        {versionsLoading ? (
          <Typography.Text type="secondary">加载中…</Typography.Text>
        ) : versionsError ? (
          <Typography.Text type="danger">{versionsError}</Typography.Text>
        ) : versions.length === 0 ? (
          <Typography.Text type="secondary">该页面尚未发布，暂无历史版本。</Typography.Text>
        ) : (
          <List
            size="small"
            dataSource={versions}
            renderItem={(item) => (
              <List.Item
                actions={
                  item.current
                    ? [<Tag key="cur" color="blue">当前</Tag>]
                    : [
                        <Button
                          key="rb"
                          size="small"
                          disabled={rollbackBusy}
                          onClick={() => void handleRollback(item.version)}
                        >
                          回滚
                        </Button>,
                      ]
                }
              >
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>v{item.version}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {formatTime(item.createdAt)} · 物料 {item.assetsVersion ?? '—'}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}
