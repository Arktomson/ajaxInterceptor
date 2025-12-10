export const getDescriptor = Object.getOwnPropertyDescriptor.bind(Object);

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getType = Object.prototype.toString.call.bind(
  Object.prototype.toString
);

export const resolveUrl = (url: string | URL = '') => {
  if (url instanceof URL) {
    return url.toString();
  }
  const isAbsolute = url.startsWith('http');
  if(isAbsolute) {
    return url;
  }
  return new URL(url, window.location.origin).toString();
};

export const safeStringify = (value: any) => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) || String(value);
  } catch (error) {
    return '';
  }
};
