export const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const normalizeGatewayUrl = (input: string) => {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `http://${trimmed}`;

  return withProtocol.replace(/\/+$/, '');
};

export const buildGatewayUrl = (baseUrl: string, path: string) => {
  const normalizedBase = normalizeGatewayUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
};

export const fetchWithTimeout = async (
  input: string,
  init: RequestInit = {},
  timeoutMs = 4500,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const maskSecret = (value: string | null | undefined) => {
  if (!value) {
    return 'Not paired';
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}••••${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};
