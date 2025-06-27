export const decimalToBigInt = (decimalValue, decimals) => {
  const strValue = decimalValue.toString();
  const decimalPointIndex = strValue.indexOf(".") || strValue.indexOf(",");

  let integerPart, fractionalPart;

  if (decimalPointIndex === -1) {
    integerPart = strValue;
    fractionalPart = "";
  } else {
    integerPart = strValue.substring(0, decimalPointIndex);
    fractionalPart = strValue.substring(decimalPointIndex + 1);
  }

  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.substring(0, decimals);
  } else if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, "0");
  }

  const combinedStr = integerPart + fractionalPart;
  const normalizedStr = combinedStr.replace(/^0+/, "") || "0";

  return BigInt(normalizedStr);
};
