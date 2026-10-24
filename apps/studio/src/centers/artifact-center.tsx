import * as React from 'react';
import { Alert, Button, Card, Col, Input, Row, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchArtifacts, publishDraft, runtimeUrl, type ArtifactMeta } from '../api.js';

type Filter = 'all' | 'draft' | 'published';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('zh-CN', { hour12: false });
}

export function ArtifactCenter(): React.ReactElement {
  const [artifacts, setArtifacts] = React.useState<ArtifactMeta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [busyPageId, setBusyPageId] = React.useState('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setArtifacts(await fetchArtifacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener('lc-refresh-artifacts', onRefresh);
    return () => window.removeEventListener('lc-refresh-artifacts', onRefresh);
  }, [refresh]);

  const openDesigner = (item: ArtifactMeta) => {
    window.dispatchEvent(new CustomEvent('lc-open-designer', { bubbles: true, detail: { pageId: item.id } }));
  };

  const preview = (item: ArtifactMeta) => {
    if (!item.hasDraft) {
      setNotice('该页面尚未保存草稿，请先进入设计中心保存。');
      return;
    }
    window.open(runtimeUrl({ pageId: item.id, preview: true }), '_blank', 'noopener');
  };

  const renderArtifact = (item: ArtifactMeta) => {
    if (item.currentVersion == null) {
      setNotice('该页面尚未发布，暂时没有可渲染的正式产物。');
      return;
    }
    window.open(runtimeUrl({ pageId: item.id, version: item.currentVersion }), '_blank', 'noopener');
  };

  const publish = async (item: ArtifactMeta) => {
    if (busyPageId) return;
    if (!item.hasDraft) {
      setNotice('该页面尚未保存草稿，请先进入设计中心保存。');
      return;
    }
    if (!window.confirm(`确定发布「${item.name}」当前草稿的新版本？`)) return;
    setBusyPageId(item.id);
    setError('');
    try {
      const result = await publishDraft(item.id);
      setNotice(`「${item.name}」已发布 v${result.version}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPageId('');
    }
  };

  const list = React.useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return artifacts.filter((item) => {
      if (filter === 'draft' && !item.hasDraft) return false;
      if (filter === 'published' && item.currentVersion == null) return false;
      if (!text) return true;
      return [item.name, item.slug, item.appName, item.appSlug].some((value) =>
        String(value).toLowerCase().includes(text),
      );
    });
  }, [artifacts, filter, keyword]);

  const stats = React.useMemo(
    () => ({
      total: artifacts.length,
      published: artifacts.filter((item) => item.currentVersion != null).length,
      drafts: artifacts.filter((item) => item.hasDraft).length,
      versions: artifacts.reduce((sum, item) => sum + item.versionCount, 0),
    }),
    [artifacts],
  );

  const columns: ColumnsType<ArtifactMeta> = [
    {
      title: '页面',
      dataIndex: 'name',
      render: (_: unknown, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {item.appName} / {item.slug}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (value: string) => <Tag>{value === 'form' ? '表单页' : '列表页'}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      render: (_: unknown, item) => (
        <Space size={4}>
          {item.currentVersion != null ? <Tag color="blue">v{item.currentVersion}</Tag> : <Tag>未发布</Tag>}
          {item.hasDraft ? <Tag color="orange">草稿</Tag> : null}
        </Space>
      ),
    },
    { title: '版本数', dataIndex: 'versionCount', width: 80 },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: unknown, item) => (
        <Space size={4} wrap>
          <Button size="small" type="link" onClick={() => openDesigner(item)}>设计</Button>
          <Button size="small" type="link" onClick={() => preview(item)}>预览</Button>
          <Button size="small" type="link" onClick={() => renderArtifact(item)}>渲染</Button>
          <Button
            size="small"
            type="link"
            loading={busyPageId === item.id}
            onClick={() => void publish(item)}
          >
            发布
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="lc-artifact-center" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
            ARTIFACT CENTER
          </Typography.Text>
          <Typography.Title level={3} style={{ margin: '4px 0' }}>
            产物中心
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            设计中心保存的页面会进入这里，可预览草稿、渲染正式版本或发布新版本。
          </Typography.Paragraph>
        </div>
        <Button loading={loading} onClick={() => void refresh()}>
          {loading ? '刷新中…' : '刷新产物'}
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '页面产物', value: stats.total },
          { label: '已发布', value: stats.published },
          { label: '待发布草稿', value: stats.drafts },
          { label: '版本快照', value: stats.versions },
        ].map((item) => (
          <Col span={6} key={item.label}>
            <Card size="small">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Typography.Text>
              <Typography.Title level={3} style={{ margin: '4px 0 0' }}>{item.value}</Typography.Title>
            </Card>
          </Col>
        ))}
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={[
            { label: '全部', value: 'all' },
            { label: '有草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
          ]}
        />
        <Input.Search
          allowClear
          placeholder="页面、标识或应用"
          style={{ width: 240 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Space>

      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : notice ? (
        <Alert type="info" showIcon message={notice} closable onClose={() => setNotice('')} style={{ marginBottom: 12 }} />
      ) : null}

      <Table<ArtifactMeta>
        className="artifact-table"
        size="middle"
        rowKey="id"
        loading={loading && artifacts.length === 0}
        columns={columns}
        dataSource={list}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        locale={{ emptyText: loading ? '正在读取页面产物…' : '暂无页面产物' }}
      />
    </div>
  );
}
