export interface Item {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/api/v1/items`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to retrieve items");
  return res.json();
}

export async function createItem(data: { title: string; description?: string }): Promise<Item> {
  const res = await fetch(`${API_BASE}/api/v1/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create item");
  return res.json();
}
