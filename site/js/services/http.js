export async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}

export async function getText(url, errorMessage = "Request failed") {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${errorMessage} (${response.status})`);
  return response.text();
}
