export function isPresignedUrlExpired(presignedUrl: string): boolean {
  try {
    const url = new URL(presignedUrl);

    const expiresParam = url.searchParams.get("X-Amz-Expires");

    if (!expiresParam) {
      console.warn(
        "URL does not have an 'Expires' parameter. It might not be a pre-signed URL.",
      );
      return true; // Or handle as an error
    }

    const expirationTimestamp = parseInt(expiresParam, 10);
    if (isNaN(expirationTimestamp)) {
      console.error("Invalid 'X-Amz-Expires' parameter in URL.");
      return true; // Or handle as an error
    }

    const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds

    return currentTimestamp >= expirationTimestamp;
  } catch (error) {
    console.error("Error parsing URL:", error);
    return true; // Handle invalid URL format
  }
}
