// import { json } from "@remix-run/node";

// export const loader = async ({ request }) => {
//   try {
//     const cartRes = await fetch(`${new URL(request.url).origin}/cart.js`, {
//       headers: {
//         cookie: request.headers.get("cookie") || "",
//       },
//     });

//     const cart = await cartRes.json();

//     const items = cart.items.map((item: any) => {
//       const qty = item.quantity || 1;

//       const originalTotal = item.original_line_price;

//       // ✅ SAFE discount
//       const discount =
//         item.discounts?.reduce((s: number, d: any) => s + (d.amount || 0), 0) || 0;

//       // fallback (VERY IMPORTANT)
//       const finalTotal = discount > 0
//         ? originalTotal - discount
//         : item.line_price;

//       return {
//         key: item.key,
//         variant_id: item.variant_id,
//         qty,

//         originalUnit: item.original_price,
//         finalUnit: Math.round(finalTotal / qty),

//         originalTotal,
//         finalTotal,
//       };
//     });

//     return json({ success: true, items });
//   } catch (err) {
//     console.error(err);
//     return json({ success: false });
//   }
// };



import { json } from "@remix-run/node";

export const loader = async ({ request }: any) => {
  try {
    const origin = new URL(request.url).origin;

    const cartRes = await fetch(`${origin}/cart.js`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!cartRes.ok) {
      throw new Error("Failed to fetch cart");
    }

    const cart = await cartRes.json();

    const items = (cart.items || []).map((item: any) => {
      const qty = item.quantity || 1;

      const originalTotal = item.original_line_price || 0;

      // ✅ Correct discount source
      const discount =
        item.discount_allocations?.reduce(
          (sum: number, d: any) => sum + (d.amount || 0),
          0
        ) || 0;

      // ✅ Safe final total calculation
      const finalTotal =
        discount > 0
          ? originalTotal - discount
          : item.line_price || originalTotal;

      return {
        key: item.key,
        variant_id: item.variant_id,
        qty,

        originalUnit: item.original_price || 0,
        finalUnit: qty > 0 ? Math.round(finalTotal / qty) : 0,

        originalTotal,
        finalTotal,
      };
    });

    return json({ success: true, items });
  } catch (err) {
    console.error("Cart API error:", err);
    return json({ success: false, items: [] });
  }
};