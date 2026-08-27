import {
  MediaConvertClient,
  CreateJobCommand,
  type Output,
} from "@aws-sdk/client-mediaconvert";
import type { S3Event, S3Handler } from "aws-lambda";
import { prisma } from "./lib/prisma";

const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT!;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN!;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET!;

const renditionOutput = (
  width: number,
  height: number,
  bitrate: number,
  nameModifier: string,
): Output => ({
  NameModifier: `_${nameModifier}`,
  ContainerSettings: { Container: "M3U8" },
  VideoDescription: {
    Width: width,
    Height: height,
    CodecSettings: {
      Codec: "H_264",
      H264Settings: {
        Bitrate: bitrate,
        RateControlMode: "CBR",
      },
    },
  },
  AudioDescriptions: [
    {
      AudioSourceName: "Audio Selector 1",
      CodecSettings: {
        Codec: "AAC",
        AacSettings: {
          Bitrate: 96000,
          CodingMode: "CODING_MODE_2_0",
          SampleRate: 48000,
        },
      },
    },
  ],
});

const client = new MediaConvertClient({
  endpoint: MEDIACONVERT_ENDPOINT,
  region: process.env.AWS_REGION,
});

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log("TRIGGER sourceKey:", JSON.stringify(key));

    const inputPath = `s3://${bucket}/${key}`;
    const relativePath = key.replace(/^uploads\//, "").replace(/\.[^/.]+$/, "");
    const outputPrefix = `s3://${OUTPUT_BUCKET}/${relativePath}/`;

    const command = new CreateJobCommand({
      Role: MEDIACONVERT_ROLE_ARN,
      UserMetadata: {
        sourceKey: key,
      },
      Settings: {
        Inputs: [
          {
            FileInput: inputPath,
            AudioSelectors: {
              "Audio Selector 1": { DefaultSelection: "DEFAULT" },
            },
          },
        ],
        OutputGroups: [
          {
            Name: "HLS",
            OutputGroupSettings: {
              Type: "HLS_GROUP_SETTINGS",
              HlsGroupSettings: {
                Destination: outputPrefix + "hls/",
                SegmentLength: 6,
                MinSegmentLength: 0,
              },
            },
            Outputs: [
              renditionOutput(1920, 1080, 5000000, "1080p"),
              renditionOutput(1280, 720, 2800000, "720p"),
              renditionOutput(854, 480, 1400000, "480p"),
            ],
          },
          {
            Name: "Thumbnails",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: { Destination: outputPrefix + "thumbs/" },
            },
            Outputs: [
              {
                ContainerSettings: { Container: "RAW" },
                VideoDescription: {
                  Width: 640,
                  Height: 360,
                  CodecSettings: {
                    Codec: "FRAME_CAPTURE",
                    FrameCaptureSettings: {
                      FramerateNumerator: 1,
                      FramerateDenominator: 10,
                      MaxCaptures: 5,
                      Quality: 80,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    });

    try {
      const response = await client.send(command);
      await prisma.chapterContent.update({
        where: {
          sourceKey: key,
        },
        data: {
          status: "PROCESSING",
          mediaConvertJobId: response.Job?.Id,
        },
      });
      console.log(`Job created: ${response.Job?.Id} for ${key}`);
    } catch (error) {
      console.log(`Failed to create job for ${key}: `, error);
      throw error;
    }
  }
};
