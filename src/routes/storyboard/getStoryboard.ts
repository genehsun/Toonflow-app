import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

function toSignedStoryboardPath(filePath: string | null | undefined) {
  const normalizedPath = u.oss.normalizeStoredPath(filePath ?? "");
  if (!normalizedPath) {
    return "";
  }
  return u.oss.getFileUrl(normalizedPath);
}

function toNormalizedStoryboardPath(filePath: string | null | undefined) {
  return u.oss.normalizeStoredPath(filePath ?? "");
}

// 获取分镜
export default router.post(
  "/",
  validateFields({
    scriptId: z.number(),
    projectId: z.number(),
  }),
  async (req, res) => {
    const { scriptId } = req.body;

    const assets = await u
      .db("t_assets")
      .where("scriptId", scriptId)
      .where("type", "分镜")
      .select("id", "name", "intro", "prompt", "filePath", "duration", "videoPrompt", "scriptId", "type", "segmentId", "shotIndex").orderBy("segmentId", "asc").orderBy("shotIndex", "asc");

    const assetsIds = assets.map((item: any) => item.id);

    const generateImg = await u.db("t_image").whereIn("assetsId", assetsIds).where("type", "分镜").select("assetsId", "filePath");

    for (const item of assets) {
      item.filePath = await toSignedStoryboardPath(item.filePath);
    }

    const data = await Promise.all(
      assets.map(async (item: any) => {
        const mainFilePath = toNormalizedStoryboardPath(item.filePath);
        const uniqueImagePaths = new Set<string>();
        const imgArr = await Promise.all(
          generateImg
            .filter((img: any) => Number(img.assetsId) === Number(item.id))
            .filter((img: any) => {
              const normalizedPath = toNormalizedStoryboardPath(img.filePath);
              if (!normalizedPath || normalizedPath === mainFilePath || uniqueImagePaths.has(normalizedPath)) {
                return false;
              }
              uniqueImagePaths.add(normalizedPath);
              return true;
            })
            .map(async (img: any) => {
              return {
                ...img,
                filePath: await toSignedStoryboardPath(img.filePath),
              };
            })
        );

        return {
          id: item.id,
          name: item.name,
          intro: item.intro,
          prompt: item.prompt,
          videoPrompt: item.videoPrompt,
          filePath: item.filePath,
          type: item.type,
          scriptId: item.scriptId,
          duration: item.duration,
          segmentId: item.segmentId ?? 1,
          shotIndex: item.shotIndex ?? 1,
          generateImg: imgArr,
        };
      })
    );

    res.status(200).send(success(data));
  }
);
