export function extractCountryCodeAndPhoneNumber(phoneNumber) {
  const regex = /^\+(\d{3})(\d+)/; // Match the '+' followed by 3 digits and capture the rest of the number

  const match = phoneNumber.match(regex);

  if (match) {
    return {
      countryCode: match[1], // The first 3 digits after the '+'
      phoneNumberWithoutCode: match[2], // The rest of the phone number
    };
  } else {
    return { countryCode: null, phoneNumberWithoutCode: phoneNumber }; // Return null if no match is found
  }
}