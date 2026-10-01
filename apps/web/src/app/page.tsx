import { fetchItems } from "../lib/api";
import { revalidatePath } from "next/cache";

async function addItem(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

  await fetch(`${API_BASE}/api/v1/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });

  revalidatePath("/");
}

export default async function Page() {
  let items: any[] = [];
  let errorMsg = "";

  try {
    items = await fetchItems();
  } catch (err: any) {
    errorMsg = "API Tier unreachable or Database disconnected.";
  }

  return (
    <main>
      <h1>Inventory (3-Tier Architecture)</h1>
      
      {errorMsg ? (
        <p style={{ color: "red" }}>{errorMsg}</p>
      ) : (
        <>
          <form action={addItem}>
            <input name="title" placeholder="Item Title" required />
            <textarea name="description" placeholder="Description (optional)" />
            <button type="submit">Add Record</button>
          </form>

          <h2>Items in PostgreSQL</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                {item.description && <p>{item.description}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
