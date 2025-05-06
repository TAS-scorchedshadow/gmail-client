import type { AddressObject } from "mailparser";
import type { DBAddress } from "~/server/types";

export function parseAddress(address: AddressObject): DBAddress[] {
  return address.value.map((val) => {
    return {
      name: val.name,
      email: val.address,
    };
  });
}

export function parseAddressMany(
  addresses: AddressObject[] | AddressObject,
): DBAddress[] {
  if (!Array.isArray(addresses)) {
    addresses = [addresses];
  }
  const rtn: DBAddress[] = [];
  addresses.forEach((address) => {
    rtn.push(...parseAddress(address));
  });
  return rtn;
}
