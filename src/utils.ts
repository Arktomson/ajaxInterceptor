export const getDescriptor = Object.getOwnPropertyDescriptor.bind(Object);

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getType = Object.prototype.toString.call.bind(
  Object.prototype.toString
);

export const resolveUrl = (url) => {
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
