import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";

const s3 = new S3Client();

async function putS3Bucket(key: string, body: PutObjectCommandInput["Body"]) {
  try {
    const res = await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: body,
      }),
    );
    return res;
  } catch (error) {
    console.log(error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to put HTML to bucket - key:${key}`,
    });
  }
}

async function getFromS3Bucket(key: string) {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }),
    );
    return res;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}}`,
    });
  }
}
async function getSignedUrlS3(key: string) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 60 * 24 * 7,
    });
    return signedUrl;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get HTML from bucket - key:${key}`,
    });
  }
}

export { putS3Bucket, getFromS3Bucket, getSignedUrlS3 };
