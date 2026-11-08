import { cookies } from "next/headers";
import { CUSTOMER_COOKIE, readCustomerToken } from "./auth";
import { store, type Customer } from "./store";

/** The signed-in customer for this request, if any. */
export async function currentCustomer(): Promise<Customer | undefined> {
  const id = readCustomerToken((await cookies()).get(CUSTOMER_COOKIE)?.value);
  return id ? store.getCustomer(id) : undefined;
}
