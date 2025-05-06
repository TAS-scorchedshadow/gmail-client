export function isPresignedUrlExpired(presignedUrl: string): boolean {
  try {
    const url = new URL(presignedUrl);

    const expiresParam = url.searchParams.get("X-Amz-Date");

    if (!expiresParam) {
      console.warn(
        "URL does not have an 'Expires' parameter. It might not be a pre-signed URL.",
      );
      return true; // Or handle as an error
    }

    const expirationTimestamp = new Date(
      expiresParam.replace(
        /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
        "$1-$2-$3T$4:$5:$6Z",
      ),
    );

    const currentTimestamp = new Date(); // Current time in seconds

    return expirationTimestamp > currentTimestamp;
  } catch (error) {
    console.error("Error parsing URL:", error);
    return true; // Handle invalid URL format
  }
}
