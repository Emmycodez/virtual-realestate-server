export const retry = async (fn, retries = 5, delay = 3000) => {
  try {
    return await fn();
  } catch (err) {
    console.error(`Error: ${err.message}. Retries left: ${retries}`);
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay);
  }
};
