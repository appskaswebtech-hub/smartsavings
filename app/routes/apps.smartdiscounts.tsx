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



// import { json } from "@remix-run/node";

// export const loader = async ({ request }: any) => {
//   try {
//     const origin = new URL(request.url).origin;

//     const cartRes = await fetch(`${origin}/cart.js`, {
//       headers: {
//         cookie: request.headers.get("cookie") || "",
//       },
//     });

//     if (!cartRes.ok) {
//       throw new Error("Failed to fetch cart");
//     }

//     const cart = await cartRes.json();

//     const items = (cart.items || []).map((item: any) => {
//       const qty = item.quantity || 1;

//       const originalTotal = item.original_line_price || 0;

//       // ✅ Correct discount source
//       const discount =
//         item.discount_allocations?.reduce(
//           (sum: number, d: any) => sum + (d.amount || 0),
//           0
//         ) || 0;

//       // ✅ Safe final total calculation
//       const finalTotal =
//         discount > 0
//           ? originalTotal - discount
//           : item.line_price || originalTotal;

//       return {
//         key: item.key,
//         variant_id: item.variant_id,
//         qty,

//         originalUnit: item.original_price || 0,
//         finalUnit: qty > 0 ? Math.round(finalTotal / qty) : 0,

//         originalTotal,
//         finalTotal,
//       };
//     });

//     return json({ success: true, items });
//   } catch (err) {
//     console.error("Cart API error:", err);
//     return json({ success: false, items: [] });
//   }
// };


import { json } from "@remix-run/node";

export const loader = async ({ request }: any) => {
  try {
    console.log("========== SmartDiscounts Loader ==========");
    console.log("Request URL:", request.url);

    const origin = new URL(request.url).origin;

    console.log("Origin:", origin);
    console.log("Fetching cart from:", `${origin}/cart.js`);

    const cartRes = await fetch(`${origin}/cart.js`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    console.log("Cart Response Status:", cartRes.status);
    console.log("Cart Response URL:", cartRes.url);

    if (!cartRes.ok) {
      const errorText = await cartRes.text().catch(() => "");

      console.error("Cart fetch failed");
      console.error("Status:", cartRes.status);
      console.error("Body:", errorText);

      throw new Error(`Failed to fetch cart (${cartRes.status})`);
    }

    const cart = await cartRes.json();

    console.log("Cart loaded successfully");
    console.log("Items in cart:", cart.items?.length || 0);

    const items = (cart.items || []).map((item: any) => {
      const qty = item.quantity || 1;

      const originalTotal = item.original_line_price || 0;

      const discount =
        item.discount_allocations?.reduce(
          (sum: number, d: any) => sum + (d.amount || 0),
          0
        ) || 0;

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

    console.log("Returning", items.length, "items");
    console.log("===========================================");

    return json({
      success: true,
      items,
    });

  } catch (err: any) {
    console.error("========== SmartDiscounts ERROR ==========");
    console.error(err);

    if (err instanceof Error) {
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);
    }

    console.error("==========================================");

    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        items: [],
      },
      { status: 500 }
    );
  }
};