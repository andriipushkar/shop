'use client';

import { useState, useEffect } from 'react';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used: string | null;
  created_at: string;
  permissions: string[];
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'disabled' | 'failing';
  secret: string;
  created_at: string;
  last_triggered: string | null;
  failure_count: number;
}

export default function APISettingsPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; secret: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        fetch('/api/settings/api-keys'),
        fetch('/api/settings/webhooks'),
      ]);

      if (keysRes.ok) setApiKeys(await keysRes.json());
      if (webhooksRes.ok) setWebhooks(await webhooksRes.json());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (name: string, permissions: string[]) => {
    const res = await fetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions }),
    });

    if (res.ok) {
      const result = await res.json();
      setNewKeyResult(result);
      fetchData();
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure? This API key will stop working immediately.')) return;

    await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleCreateWebhook = async (url: string, events: string[]) => {
    const res = await fetch('/api/settings/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events }),
    });

    if (res.ok) {
      setShowNewWebhookModal(false);
      fetchData();
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;

    await fetch(`/api/settings/webhooks/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleToggleWebhook = async (id: string, status: 'active' | 'disabled') => {
    await fetch(`/api/settings/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          API Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage API keys and webhooks for your integrations
        </p>
      </div>

      {/* API Keys Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              API Keys
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create keys to authenticate API requests
            </p>
          </div>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon />
            Create API Key
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {apiKeys.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No API keys created yet
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {key.name}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {key.key_prefix}...
                    </code>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Created {formatDate(key.created_at)}
                    </span>
                    {key.last_used && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Last used {formatRelative(key.last_used)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {key.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Webhooks Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Webhooks
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Get notified when events happen in your store
            </p>
          </div>
          <button
            onClick={() => setShowNewWebhookModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon />
            Add Webhook
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {webhooks.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No webhooks configured yet
            </div>
          ) : (
            webhooks.map((webhook) => (
              <div key={webhook.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-medium text-gray-900 dark:text-white text-sm">
                        {webhook.url}
                      </code>
                      <StatusBadge status={webhook.status} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {webhook.last_triggered && (
                        <span>Last triggered {formatRelative(webhook.last_triggered)}</span>
                      )}
                      {webhook.failure_count > 0 && (
                        <span className="text-red-600">
                          {webhook.failure_count} failures
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleToggleWebhook(
                          webhook.id,
                          webhook.status === 'active' ? 'disabled' : 'active'
                        )
                      }
                      className={`px-3 py-1 rounded text-sm ${
                        webhook.status === 'active'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {webhook.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Documentation Link */}
      <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BookIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              API Documentation
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Learn how to integrate with our API using these keys.
            </p>
            <a
              href="/api/docs"
              target="_blank"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 mt-2"
            >
              View API Docs
              <ArrowRightIcon />
            </a>
          </div>
        </div>
      </section>

      {/* Modals */}
      {showNewKeyModal && (
        <CreateAPIKeyModal
          onClose={() => setShowNewKeyModal(false)}
          onCreate={handleCreateKey}
        />
      )}

      {newKeyResult && (
        <NewKeyResultModal
          apiKey={newKeyResult.key}
          secretKey={newKeyResult.secret}
          onClose={() => setNewKeyResult(null)}
        />
      )}

      {showNewWebhookModal && (
        <CreateWebhookModal
          onClose={() => setShowNewWebhookModal(false)}
          onCreate={handleCreateWebhook}
        />
      )}
    </div>
  );
}

// Sub-components

function CreateAPIKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, permissions: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read:products', 'read:orders']);

  const allPermissions = [
    'read:products',
    'write:products',
    'read:orders',
    'write:orders',
    'read:customers',
    'write:customers',
    'read:analytics',
    'admin',
  ];

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  return (
    <Modal title="Create API Key" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Key Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            placeholder="e.g., Production App"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Permissions
          </label>
          <div className="grid grid-cols-2 gap-2">
            {allPermissions.map((perm) => (
              <label
                key={perm}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{perm}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onCreate(name, permissions);
              onClose();
            }}
            disabled={!name || permissions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Create Key
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewKeyResultModal({
  apiKey,
  secretKey,
  onClose,
}: {
  apiKey: string;
  secretKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`API_KEY=${apiKey}\nSECRET_KEY=${secretKey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="API Key Created" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-400 text-sm">
            Make sure to copy your API keys now. You won't be able to see the secret key again!
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Key
          </label>
          <code className="block p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono break-all">
            {apiKey}
          </code>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Secret Key
          </label>
          <code className="block p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono break-all">
            {secretKey}
          </code>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {copied ? 'Copied!' : 'Copy Both'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateWebhookModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (url: string, events: string[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['order.created']);

  const allEvents = [
    'order.created',
    'order.updated',
    'order.completed',
    'order.cancelled',
    'product.created',
    'product.updated',
    'product.deleted',
    'customer.created',
    'customer.updated',
    'inventory.low',
    'payment.received',
    'refund.created',
  ];

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <Modal title="Add Webhook" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Endpoint URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            placeholder="https://your-server.com/webhook"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Events to Subscribe
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {allEvents.map((event) => (
              <label
                key={event}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(url, events)}
            disabled={!url || events.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add Webhook
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XIcon />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Webhook['status'] }) {
  const styles = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    disabled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    failing: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}

// Helper functions
function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

function formatRelative(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
