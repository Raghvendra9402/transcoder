import type { EventBridgeHandler } from "aws-lambda";
import { prisma } from "./lib/prisma";

interface OutputGroupDetail {
  outputDetails?: Array<{
    outputFilePaths?: string[];
    durationInMs?: number;
  }>;
}

interface MediaConvertJobStateDetail {
  status: "COMPLETE" | "ERROR" | "CANCELED";
  jobId: string;
  userMetadata?: Record<string, string>;
  errorMessage?: string;
  errorCode?: number;
  outputGroupDetails?: OutputGroupDetail[];
}

export const handler: EventBridgeHandler<
  "MediaConvert Job State Change",
  MediaConvertJobStateDetail,
  void
> = async (event) => {
  const {
    status,
    jobId,
    userMetadata,
    errorMessage,
    errorCode,
    outputGroupDetails,
  } = event.detail;

  const sourceKey = userMetadata?.sourceKey!;

  console.log("ON-COMPLETE sourceKey:", JSON.stringify(sourceKey));

  if (!sourceKey) {
    console.error(
      `Job ${jobId} completed but has no sourceKey in userMetadata`,
    );
    return;
  }

  console.log(`Job ${jobId} (${sourceKey ?? "unknown source"}) -> ${status}`);

  if (status === "COMPLETE") {
    const outputPaths = outputGroupDetails
      ?.flatMap((group) => group.outputDetails ?? [])
      .flatMap((detail) => detail.outputFilePaths ?? []);

    console.log("Output files:", outputPaths);

    // TODO: update your DB record for sourceKey
    try {
      console.log("Updating DB for:", sourceKey);

      const result = await prisma.chapterContent.update({
        where: {
          sourceKey,
        },
        data: {
          status: "READY",
          mediaConvertJobId: jobId,
          hlsManifestUrl: outputPaths?.find((p) => p.endsWith(".m3u8")),
          thumbnailUrls:
            outputPaths?.filter((p) => p.includes("/thumbs/")) ?? [],
        },
      });

      console.log("Updated:", result.id);
    } catch (err) {
      console.error("Prisma error:", err);
    }

    return;
  }

  if (status === "ERROR") {
    console.error(`Job ${jobId} failed: [${errorCode}] ${errorMessage}`);

    // TODO: update DB record for sourceKey
    await prisma.chapterContent.update({
      where: { sourceKey },
      data: {
        status: "FAILED",
        mediaConvertJobId: jobId,
        errorMessage: errorMessage,
      },
    });
    // await updateVideoRecord(sourceKey, { status: "failed", errorMessage });

    return;
  }

  // CANCELED — rare, but handle it so it doesn't fall through silently
  console.warn(`Job ${jobId} was canceled`);
};
