import { API_URL, getAuthToken } from '../config';

export const USE_AI_JOB_QUEUE = process.env.REACT_APP_USE_AI_JOB_QUEUE === 'true';

const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_POLL_INTERVAL_MS = 1500;

const authHeaders = (extra = {}) => {
  const token = getAuthToken();
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extra,
  };
};

export async function pollAIJob(jobId, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();
  let job = { id: jobId, status: 'queued' };

  while (job.status === 'queued' || job.status === 'running' || job.status === 'retrying') {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('AI job timed out while waiting for a result');
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const response = await fetch(`${API_URL}/ai/jobs/${jobId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    job = await response.json();
    if (typeof options.onProgress === 'function') {
      options.onProgress(job);
    }
  }

  if (job.status !== 'completed') {
    throw new Error(job.error || 'AI job failed');
  }
  return job.result || {};
}

export async function createAIJob(payload) {
  const response = await fetch(`${API_URL}/ai/jobs`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function queueChatCompletion(payload, options = {}) {
  const job = await createAIJob({
    job_type: 'chat_completion',
    use_semantic_cache: true,
    cache_scope: 'user',
    ...payload,
  });
  return pollAIJob(job.id, options);
}

export async function queueLegacyAIEndpoint(path, options = {}) {
  const response = await fetch(`${API_URL}/ai/route-jobs`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      method: options.method || 'POST',
      path,
      body_type: options.bodyType || 'json',
      json_body: options.jsonBody || null,
      form_body: options.formBody || null,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }
  const job = await response.json();
  const result = await pollAIJob(job.id, options);
  return result.route_result || result;
}

export async function queuedAIJsonFetch(path, fetchOptions = {}, queueOptions = {}) {
  if (!USE_AI_JOB_QUEUE) {
    return fetch(path.startsWith('http') ? path : `${API_URL}${path}`, fetchOptions);
  }

  const apiPath = path.startsWith('http')
    ? new URL(path).pathname
    : (path.startsWith('/api/') ? path : `${API_URL}${path}`.replace(/^https?:\/\/[^/]+/, ''));
  const body = fetchOptions.body ? JSON.parse(fetchOptions.body) : {};
  const method = fetchOptions.method || (fetchOptions.body ? 'POST' : 'GET');
  const result = await queueLegacyAIEndpoint(apiPath, {
    method,
    bodyType: 'json',
    jsonBody: body,
    ...queueOptions,
  });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function queuedAIFormFetch(path, formBody = {}, queueOptions = {}) {
  if (!USE_AI_JOB_QUEUE) {
    const formData = new FormData();
    Object.entries(formBody).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, value);
    });
    return fetch(path.startsWith('http') ? path : `${API_URL}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
  }

  const apiPath = path.startsWith('http')
    ? new URL(path).pathname
    : (path.startsWith('/api/') ? path : `${API_URL}${path}`.replace(/^https?:\/\/[^/]+/, ''));
  const result = await queueLegacyAIEndpoint(apiPath, {
    method: 'POST',
    bodyType: 'form',
    formBody,
    ...queueOptions,
  });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function queueLegacyAIFileEndpoint(path, formBody = {}, files = [], options = {}) {
  const formData = new FormData();
  formData.append('path', path);
  formData.append('method', 'POST');
  formData.append('form_body', JSON.stringify(formBody || {}));
  files.forEach((entry) => {
    const file = entry?.file || entry;
    const fieldName = entry?.fieldName || 'files';
    if (entry?.filename) {
      formData.append('files', file, entry.filename);
    } else {
      formData.append('files', file);
    }
    formData.append('file_field_names', fieldName);
  });

  const response = await fetch(`${API_URL}/ai/file-route-jobs`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }
  const job = await response.json();
  const result = await pollAIJob(job.id, options);
  return result.route_result || result;
}
