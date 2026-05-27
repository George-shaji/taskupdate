import { useState } from 'react';

const STATUS_ROWS = [
  { scenario: 'Success', code: '200' },
  { scenario: 'Created', code: '201' },
  { scenario: 'Accepted queue processing', code: '202' },
  { scenario: 'No Content', code: '204' },
  { scenario: 'Missing headers or bad request', code: '400' },
  { scenario: 'Invalid auth', code: '401' },
  { scenario: 'Forbidden access', code: '403' },
  { scenario: 'Resource not found', code: '404' },
  { scenario: 'Method Not Allowed', code: '405' },
  { scenario: 'Duplicate request or conflict', code: '409' },
  { scenario: 'Content Too Large', code: '413' },
  { scenario: 'Unsupported content type', code: '415' },
  { scenario: 'Invalid payload or validation failed', code: '422' },
  { scenario: 'Rate limit exceeded', code: '429' },
  { scenario: 'Server error', code: '500' },
  { scenario: 'Bad gateway', code: '502' },
  { scenario: 'Service unavailable', code: '503' },
  { scenario: 'Gateway timeout', code: '504' }
];

const RESPONSE_EXAMPLES = [
  {
    code: '200',
    title: 'Success',
    label: 'OK',
    tone: 'success',
    description: 'The request was successfully processed.',
    body: {
      status: 'success',
      message: 'Payload processed successfully.'
    }
  },
  {
    code: '201',
    title: 'Created',
    label: 'Created',
    tone: 'success',
    description: 'A new resource was successfully created.',
    body: {
      status: 'success',
      message: 'Resource created successfully.'
    }
  },
  {
    code: '202',
    title: 'Accepted',
    label: 'Queue Processing',
    tone: 'success',
    description: 'The request was accepted and will be processed asynchronously.',
    body: {
      status: 'success',
      message: 'Request accepted and queued for processing.'
    }
  },
  {
    code: '204',
    title: 'No Content',
    label: 'No Body',
    tone: 'neutral',
    description: 'The request succeeded and no response body is returned. Common for delete, logout, or silent update operations.',
    noBody: true
  },
  {
    code: '400',
    title: 'Bad Request',
    label: 'Missing Headers',
    tone: 'warning',
    description: 'Required authentication headers are missing or the request format is invalid.',
    cases: ['username header missing', 'secret header missing', 'api_token missing', 'Invalid request structure'],
    body: {
      status: 'error',
      message: 'Invalid request. Required authentication headers are missing.',
      error_code: 'MISSING_AUTH_HEADERS'
    }
  },
  {
    code: '401',
    title: 'Unauthorized',
    label: 'Invalid Authentication',
    tone: 'danger',
    description: 'Authentication credentials were provided but are invalid.',
    cases: ['Invalid username', 'Invalid secret', 'Invalid API token'],
    body: {
      status: 'error',
      message: 'Authentication failed. Invalid credentials provided.',
      error_code: 'AUTHENTICATION_FAILED'
    }
  },
  {
    code: '403',
    title: 'Forbidden',
    label: 'Access Denied',
    tone: 'danger',
    description: 'Authentication succeeded, but the user does not have permission for this action.',
    cases: ['User lacks permission', 'Restricted endpoint access'],
    body: {
      status: 'error',
      message: 'Access denied. You do not have permission to perform this action.',
      error_code: 'ACCESS_FORBIDDEN'
    }
  },
  {
    code: '404',
    title: 'Not Found',
    label: 'Missing Resource',
    tone: 'neutral',
    description: 'The requested API endpoint or resource does not exist.',
    cases: ['Invalid route', 'Resource ID not found'],
    body: {
      status: 'error',
      message: 'The requested resource was not found.',
      error_code: 'RESOURCE_NOT_FOUND'
    }
  },
  {
    code: '405',
    title: 'Method Not Allowed',
    label: 'Wrong Method',
    tone: 'warning',
    description: 'The HTTP method is not supported for the endpoint.',
    cases: ['Sending GET instead of POST', 'Sending PUT to a POST-only API'],
    body: {
      status: 'error',
      message: 'The requested HTTP method is not allowed for this endpoint.',
      error_code: 'METHOD_NOT_ALLOWED'
    }
  },
  {
    code: '409',
    title: 'Conflict',
    label: 'Duplicate Request',
    tone: 'warning',
    description: 'A resource already exists or a duplicate request was detected.',
    cases: ['Duplicate record', 'Existing transaction reference'],
    body: {
      status: 'error',
      message: 'Conflict detected. Resource already exists.',
      error_code: 'RESOURCE_CONFLICT'
    }
  },
  {
    code: '413',
    title: 'Payload Too Large',
    label: 'Content Too Large',
    tone: 'warning',
    description: 'The request payload exceeds the allowed size.',
    cases: ['JSON payload exceeds 5 MB', 'Uploaded content too large'],
    body: {
      status: 'error',
      message: 'Payload size exceeds the allowed limit of 5 MB.',
      error_code: 'PAYLOAD_TOO_LARGE'
    }
  },
  {
    code: '415',
    title: 'Unsupported Media Type',
    label: 'Unsupported Content',
    tone: 'warning',
    description: 'The request content type is not supported.',
    cases: ['Missing Content-Type: application/json', 'Sending XML instead of JSON'],
    body: {
      status: 'error',
      message: 'Unsupported media type. Content-Type must be application/json.',
      error_code: 'UNSUPPORTED_MEDIA_TYPE'
    }
  },
  {
    code: '422',
    title: 'Unprocessable Entity',
    label: 'Validation Failed',
    tone: 'danger',
    description: 'The payload was received, but validation failed.',
    cases: ['Required fields missing', 'Invalid data format', 'Incorrect field values'],
    body: {
      status: 'error',
      message: 'Validation failed. Invalid payload data.',
      error_code: 'INVALID_PAYLOAD'
    }
  },
  {
    code: '429',
    title: 'Too Many Requests',
    label: 'Rate Limited',
    tone: 'warning',
    description: 'Too many requests were sent in a short period.',
    cases: ['API throttling exceeded', 'Too many retries'],
    body: {
      status: 'error',
      message: 'Too many requests. Please try again later.',
      error_code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  {
    code: '500',
    title: 'Internal Server Error',
    label: 'Server Error',
    tone: 'danger',
    description: 'An unexpected server-side error occurred.',
    cases: ['Unhandled exception', 'Database issue', 'Unexpected failure'],
    body: {
      status: 'error',
      message: 'An unexpected server error occurred.',
      error_code: 'INTERNAL_SERVER_ERROR'
    }
  },
  {
    code: '502',
    title: 'Bad Gateway',
    label: 'Upstream Failure',
    tone: 'danger',
    description: 'A gateway or proxy received an invalid response from an upstream service.',
    body: {
      status: 'error',
      message: 'Bad gateway. Upstream service returned an invalid response.',
      error_code: 'BAD_GATEWAY'
    }
  },
  {
    code: '503',
    title: 'Service Unavailable',
    label: 'Unavailable',
    tone: 'danger',
    description: 'The service is temporarily unavailable.',
    cases: ['Maintenance mode', 'Server overload', 'Dependency unavailable'],
    body: {
      status: 'error',
      message: 'Service temporarily unavailable. Please try again later.',
      error_code: 'SERVICE_UNAVAILABLE'
    }
  },
  {
    code: '504',
    title: 'Gateway Timeout',
    label: 'Timeout',
    tone: 'danger',
    description: 'An external dependency took too long to respond.',
    cases: ['Third-party API timeout', 'Payment gateway delay', 'CRM service timeout'],
    body: {
      status: 'error',
      message: 'The request timed out while waiting for an external service.',
      error_code: 'GATEWAY_TIMEOUT'
    }
  }
];

const formatJson = (body) => JSON.stringify(body, null, 2);

export default function ApiDocumentation({ onBack }) {
  const [copiedKey, setCopiedKey] = useState('');

  const copyText = async (key, text) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1200);
  };

  const requestExample = `POST /api/v1/tasks HTTP/1.1
Content-Type: application/json
username: george
secret: your-secret
api_token: your-api-token

{
  "projectName": "CRCS072",
  "heading": "Deploy task update flow",
  "details": "Validated webhook response handling.",
  "status": "Completed",
  "timeTaken": 1.5
}`;

  return (
    <main className="docs-page">
      <section className="docs-hero">
        <div>
          <span className="docs-kicker">API Standards</span>
          <h2>Recommended API Response</h2>
          <p>
            A consistent response guide for success, validation, authentication,
            rate limiting, and server-side failure states.
          </p>
        </div>

        <button className="btn-secondary docs-back-btn" onClick={onBack}>
          Back to Tasks
        </button>
      </section>

      <section className="docs-summary-grid">
        <div className="docs-stat">
          <strong>18</strong>
          <span>Status codes</span>
        </div>
        <div className="docs-stat">
          <strong>2xx</strong>
          <span>Successful outcomes</span>
        </div>
        <div className="docs-stat">
          <strong>4xx</strong>
          <span>Client-side issues</span>
        </div>
        <div className="docs-stat">
          <strong>5xx</strong>
          <span>Server and gateway issues</span>
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-heading">
          <span>Request Contract</span>
          <h3>Authentication Headers</h3>
        </div>

        <div className="docs-contract-grid">
          <div className="docs-contract-card">
            <h4>Required headers</h4>
            <div className="docs-cases">
              <span>Content-Type: application/json</span>
              <span>username</span>
              <span>secret</span>
              <span>api_token</span>
            </div>
          </div>

          <div className="docs-contract-card">
            <h4>Recommended response shape</h4>
            <p>Use `status`, `message`, and `error_code` consistently across all endpoints. Return data only when the client needs it.</p>
          </div>
        </div>

        <div className="docs-code-panel">
          <button className="copy-btn docs-copy-btn" onClick={() => copyText('request', requestExample)}>
            {copiedKey === 'request' ? 'Copied' : 'Copy'}
          </button>
          <pre className="docs-code"><code>{requestExample}</code></pre>
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-heading">
          <span>Reference Table</span>
          <h3>Status Code Matrix</h3>
        </div>

        <div className="docs-table-wrap">
          <table className="docs-status-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Status Code</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ROWS.map(row => (
                <tr key={`${row.code}-${row.scenario}`}>
                  <td>{row.scenario}</td>
                  <td>
                    <span className={`status-code-pill status-${row.code.charAt(0)}`}>
                      {row.code}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-heading">
          <span>Response Examples</span>
          <h3>Standard JSON Bodies</h3>
        </div>

        <div className="docs-response-grid">
          {RESPONSE_EXAMPLES.map(example => (
            <article className="docs-response-card" key={example.code}>
              <header className="docs-response-header">
                <div>
                  <span className={`status-code-pill status-${example.code.charAt(0)}`}>
                    {example.code}
                  </span>
                  <h4>{example.title}</h4>
                </div>
                <span className={`docs-label ${example.tone}`}>{example.label}</span>
              </header>

              <p>{example.description}</p>

              {example.cases && (
                <div className="docs-cases">
                  {example.cases.map(item => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              )}

              {example.noBody ? (
                <div className="docs-no-body">No response body returned.</div>
              ) : (
                <div className="docs-code-panel">
                  <button className="copy-btn docs-copy-btn" onClick={() => copyText(example.code, formatJson(example.body))}>
                    {copiedKey === example.code ? 'Copied' : 'Copy'}
                  </button>
                  <pre className="docs-code"><code>{formatJson(example.body)}</code></pre>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
